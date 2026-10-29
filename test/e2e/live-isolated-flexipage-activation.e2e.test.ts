import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { describe, it } from 'mocha';

const execute = promisify(execFile);
const live = process.env.SMART_DEPLOYMENT_LIVE_FLEXIPAGE_ACTIVATION === '1' ? describe : describe.skip;
const targetOrg = 'cg-demo';
const orgId = '00Dak0000189OhPEAU';
type SfResult = {
  id?: string;
  connectedStatus?: string;
  success?: boolean;
  checkOnly?: boolean;
  records?: Array<Record<string, string>>;
  actionOverrides?: Array<{ name: string; formFactor: string; pageId: string }>;
};

live('isolated FlexiPage activation', () => {
  it('preserves a new object while activating its record page', async function () {
    this.timeout(900_000);
    expect(process.env.SMART_DEPLOYMENT_LIVE_FLEXIPAGE_APPROVAL).to.equal('I_APPROVE_CG_DEMO_FLEXIPAGE_CREATE_DELETE');
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const objectName = `SD_FlexProbe_${suffix}__c`;
    const pageName = `SD_FlexProbe_${suffix}_Page`;
    const root = await mkdtemp(path.join(tmpdir(), 'sd-flexipage-activation-'));
    const objectFile = path.join(root, 'force-app/main/default/objects', objectName, `${objectName}.object-meta.xml`);
    const pageFile = path.join(root, 'force-app/main/default/flexipages', `${pageName}.flexipage-meta.xml`);
    const jobs: string[] = [];
    let ownsFixture = false;
    let primaryError: unknown;
    let cleanupVerified = false;

    const sf = async (args: string[]): Promise<{ status: number; result?: SfResult }> => {
      const { stdout } = await execute('sf', args, { cwd: root, maxBuffer: 10 * 1024 * 1024, timeout: 1_200_000 });
      const response = JSON.parse(stdout) as { status: number; result?: SfResult };
      if (response.status !== 0 || response.result?.success === false)
        throw new Error(`sf ${args.slice(0, 3).join(' ')} failed: ${stdout}`);
      return response;
    };
    const query = async (
      type: 'EntityDefinition' | 'FlexiPage',
      field: string,
      name: string
    ): Promise<Array<Record<string, string>>> => {
      const { result } = await sf([
        'data',
        'query',
        '--use-tooling-api',
        '--target-org',
        targetOrg,
        '--query',
        `SELECT Id, ${field} FROM ${type} WHERE ${field} = '${name}' LIMIT 2`,
        '--json',
      ]);
      if (!Array.isArray(result?.records) || result.records.some((record) => record[field] !== name)) {
        throw new Error(`Ambiguous ${type} identity`);
      }
      return result.records;
    };
    const deploy = async (file: string): Promise<void> => {
      const args = [
        'project',
        'deploy',
        'start',
        '--source-dir',
        file,
        '--target-org',
        targetOrg,
        '--api-version',
        '67.0',
        '--wait',
        '20',
        '--json',
      ];
      const dryRun = await sf([...args, '--dry-run']);
      if (dryRun.result?.checkOnly !== true || dryRun.result.success !== true) throw new Error('Dry-run not verified');
      jobs.push(`dry-run:${dryRun.result.id}`);
      const deployed = await sf(args);
      if (deployed.result?.checkOnly !== false || deployed.result.success !== true)
        throw new Error('Deploy not verified');
      jobs.push(`deploy:${deployed.result.id}`);
    };
    const retrieve = async (): Promise<string> => {
      const output = `retrieved-${randomUUID()}`;
      await mkdir(path.join(root, output));
      await sf([
        'project',
        'retrieve',
        'start',
        '--metadata',
        `CustomObject:${objectName}`,
        '--target-org',
        targetOrg,
        '--output-dir',
        output,
        '--api-version',
        '67.0',
        '--wait',
        '20',
        '--json',
      ]);
      return readFile(path.join(root, output, 'objects', objectName, `${objectName}.object-meta.xml`), 'utf8');
    };

    try {
      const org = await sf(['org', 'display', '--target-org', targetOrg, '--json']);
      if (org.result?.id !== orgId || org.result.connectedStatus !== 'Connected') throw new Error('Wrong target org');
      expect(await query('EntityDefinition', 'QualifiedApiName', objectName)).to.have.length(0);
      expect(await query('FlexiPage', 'DeveloperName', pageName)).to.have.length(0);
      ownsFixture = true;

      await mkdir(path.dirname(objectFile), { recursive: true });
      await mkdir(path.dirname(pageFile), { recursive: true });
      await writeFile(
        path.join(root, 'sfdx-project.json'),
        JSON.stringify({
          packageDirectories: [{ path: 'force-app', default: true }],
          sourceApiVersion: '67.0',
        })
      );
      const foundation = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Activation Probe ${suffix}</label><pluralLabel>Activation Probes</pluralLabel>
    <nameField><label>Probe Name</label><type>Text</type></nameField>
    <deploymentStatus>Deployed</deploymentStatus><sharingModel>ReadWrite</sharingModel>
</CustomObject>`;
      await writeFile(objectFile, foundation);
      await writeFile(
        pageFile,
        `<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>SD Flex Probe ${suffix}</masterLabel>
    <sobjectType>${objectName}</sobjectType>
    <type>RecordPage</type>
    <template><name>flexipage:recordHomeTemplateDesktop</name></template>
    <flexiPageRegions><name>header</name><type>Region</type></flexiPageRegions>
</FlexiPage>`
      );
      await deploy(objectFile);
      expect(await query('EntityDefinition', 'QualifiedApiName', objectName)).to.have.length(1);
      await deploy(pageFile);
      const pages = await query('FlexiPage', 'DeveloperName', pageName);
      expect(pages).to.have.length(1);
      const before = await retrieve();
      expect(before).not.to.include(`<content>${pageName}</content>`);
      const beforeDescribe = await sf([
        'sobject',
        'describe',
        '--sobject',
        objectName,
        '--target-org',
        targetOrg,
        '--json',
      ]);
      expect(
        beforeDescribe.result?.actionOverrides?.filter((override) => override.name === 'View' && override.pageId)
      ).to.have.length(0);

      const overrides = ['Large', 'Small']
        .map(
          (formFactor) =>
            `    <actionOverrides><actionName>View</actionName><content>${pageName}</content><formFactor>${formFactor}</formFactor><type>Flexipage</type></actionOverrides>`
        )
        .join('\n');
      const activation = foundation.replace('</CustomObject>', `${overrides}\n</CustomObject>`);
      expect(activation.replace(`${overrides}\n`, '')).to.equal(foundation);
      await writeFile(objectFile, activation);
      await deploy(objectFile);
      const after = await retrieve();
      const newOverrides = [...after.matchAll(/\s*<actionOverrides>([\s\S]*?)<\/actionOverrides>/g)].filter((match) =>
        match[1].includes(`<content>${pageName}</content>`)
      );
      expect(newOverrides).to.have.length(2);
      for (const formFactor of ['Large', 'Small']) {
        expect(
          newOverrides.some(
            (match) =>
              match[1].includes('<actionName>View</actionName>') &&
              match[1].includes(`<formFactor>${formFactor}</formFactor>`) &&
              match[1].includes('<type>Flexipage</type>')
          )
        ).to.equal(true);
      }
      const withoutPageAssignments = (xml: string): string =>
        xml.replace(/\s*<actionOverrides>[\s\S]*?<\/actionOverrides>/g, (match) =>
          match.includes('<actionName>View</actionName>') &&
          (match.includes('<formFactor>Large</formFactor>') || match.includes('<formFactor>Small</formFactor>'))
            ? ''
            : match
        );
      expect(withoutPageAssignments(after)).to.equal(withoutPageAssignments(before));
      const afterDescribe = await sf([
        'sobject',
        'describe',
        '--sobject',
        objectName,
        '--target-org',
        targetOrg,
        '--json',
      ]);
      expect(
        afterDescribe.result?.actionOverrides
          ?.filter((override) => override.name === 'View')
          .map((override) => [override.formFactor, override.pageId])
          .sort()
      ).to.deep.equal([
        ['LARGE', pages[0].Id],
        ['SMALL', pages[0].Id],
      ]);
      process.stdout.write(
        `${JSON.stringify({
          objectName,
          pageName,
          pageId: pages[0].Id,
          jobs,
          metadataOverrides: newOverrides.length,
          unrelatedMetadataUnchanged: true,
          restOverrides: 2,
        })}\n`
      );
    } catch (error) {
      primaryError = error;
    }

    try {
      if (ownsFixture) {
        const objects = await query('EntityDefinition', 'QualifiedApiName', objectName);
        if (objects.length === 1)
          await sf([
            'project',
            'delete',
            'source',
            '--metadata',
            `CustomObject:${objectName}`,
            '--target-org',
            targetOrg,
            '--no-prompt',
            '--wait',
            '20',
            '--json',
          ]);
        const pages = await query('FlexiPage', 'DeveloperName', pageName);
        if (pages.length === 1)
          await sf([
            'project',
            'delete',
            'source',
            '--metadata',
            `FlexiPage:${pageName}`,
            '--target-org',
            targetOrg,
            '--no-prompt',
            '--wait',
            '20',
            '--json',
          ]);
        cleanupVerified =
          (await query('EntityDefinition', 'QualifiedApiName', objectName)).length === 0 &&
          (await query('FlexiPage', 'DeveloperName', pageName)).length === 0;
      } else cleanupVerified = true;
      if (!cleanupVerified) throw new Error('Cleanup not verified');
    } catch (error) {
      primaryError = primaryError
        ? new AggregateError(
            [primaryError, error],
            `Activation and cleanup failed; fixture: ${objectName}, ${pageName}; workspace: ${root}`
          )
        : new Error(`Cleanup failed; fixture: ${objectName}, ${pageName}; workspace: ${root}`, { cause: error });
    }
    if (cleanupVerified) await rm(root, { recursive: true, force: true });
    if (primaryError) throw primaryError;
  });
});
