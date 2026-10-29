import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { describe, it } from 'mocha';

const execute = promisify(execFile);
const live = process.env.SMART_DEPLOYMENT_LIVE_FLEXIPAGE_OVERRIDE === '1' ? describe : describe.skip;
const targetOrg = 'cg-demo';
const orgId = '00Dak0000189OhPEAU';

live('isolated FlexiPage override omission', () => {
  it('observes whether an omitted override survives a partial custom object deploy', async function () {
    this.timeout(900_000);
    expect(process.env.SMART_DEPLOYMENT_LIVE_FLEXIPAGE_APPROVAL).to.equal('I_APPROVE_CG_DEMO_FLEXIPAGE_CREATE_DELETE');
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const objectName = `SD_FlexProbe_${suffix}__c`;
    const pageName = `SD_FlexProbe_${suffix}_Page`;
    const root = await mkdtemp(path.join(tmpdir(), 'sd-flexipage-probe-'));
    let primaryError: unknown;
    let cleanupVerified = false;
    let ownsFixture = false;

    try {
      const org = await sf(['org', 'display', '--target-org', targetOrg, '--json']);
      if (org.result?.id !== orgId || org.result?.connectedStatus !== 'Connected') {
        throw new Error('Target org identity or connection changed; refusing deploy');
      }
      expect(await count('EntityDefinition', 'QualifiedApiName', objectName)).to.equal(0);
      expect(await count('FlexiPage', 'DeveloperName', pageName)).to.equal(0);
      ownsFixture = true;

      await mkdir(path.join(root, 'force-app/main/default/objects', objectName), { recursive: true });
      await mkdir(path.join(root, 'force-app/main/default/flexipages'), { recursive: true });
      await writeFile(
        path.join(root, 'sfdx-project.json'),
        JSON.stringify({
          packageDirectories: [{ path: 'force-app', default: true }],
          sourceApiVersion: '67.0',
        })
      );
      const objectFile = path.join(root, 'force-app/main/default/objects', objectName, `${objectName}.object-meta.xml`);
      const pageFile = path.join(root, 'force-app/main/default/flexipages', `${pageName}.flexipage-meta.xml`);
      await writeFile(objectFile, objectXml('Before omission'));
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
      expect(await count('EntityDefinition', 'QualifiedApiName', objectName)).to.equal(1);
      await deploy(pageFile);
      expect(await count('FlexiPage', 'DeveloperName', pageName)).to.equal(1);
      await writeFile(objectFile, objectXml('Before omission', true));
      await deploy(objectFile);
      const before = await retrieve();
      expect(before).to.include(`<content>${pageName}</content>`);
      expect(before).to.include('<formFactor>Large</formFactor>');
      expect(before).to.include('<formFactor>Small</formFactor>');

      await writeFile(objectFile, objectXml('After omission'));
      await deploy(objectFile);
      const after = await retrieve();
      expect(after).to.include('<label>After omission</label>');
      const overrides = [...after.matchAll(/<actionOverrides>([^]*?)<\/actionOverrides>/g)].map((match) => match[1]);
      const preserved = ['Large', 'Small'].every((formFactor) =>
        overrides.some(
          (override) =>
            override.includes('<actionName>View</actionName>') &&
            override.includes(`<content>${pageName}</content>`) &&
            override.includes(`<formFactor>${formFactor}</formFactor>`) &&
            override.includes('<type>Flexipage</type>')
        )
      );
      process.stdout.write(
        `${JSON.stringify({
          objectName,
          pageName,
          orgId,
          beforeHasOverrides: true,
          preservedAfterOmission: preserved,
        })}\n`
      );
    } catch (error) {
      primaryError = error;
    }

    try {
      if (ownsFixture) {
        const objectCount = await count('EntityDefinition', 'QualifiedApiName', objectName);
        if (objectCount === 1)
          await sf(
            [
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
            ],
            root
          );
        else if (objectCount !== 0) throw new Error('Object identity ambiguous; refusing deletion');
        const pageCount = await count('FlexiPage', 'DeveloperName', pageName);
        if (pageCount === 1)
          await sf(
            [
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
            ],
            root
          );
        else if (pageCount !== 0) throw new Error('Page identity ambiguous; refusing deletion');
        cleanupVerified =
          (await count('EntityDefinition', 'QualifiedApiName', objectName)) === 0 &&
          (await count('FlexiPage', 'DeveloperName', pageName)) === 0;
      } else cleanupVerified = true;
      if (!cleanupVerified) throw new Error('Fixture cleanup could not be verified');
    } catch (error) {
      primaryError = primaryError
        ? new AggregateError([primaryError, error], `Probe failed and cleanup is unverified; workspace: ${root}`)
        : new Error(`Probe cleanup unverified; workspace: ${root}`, { cause: error });
    }
    if (cleanupVerified) await rm(root, { recursive: true, force: true });
    if (primaryError) throw primaryError;

    function objectXml(label: string, withOverride = false): string {
      return `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>${label}</label><pluralLabel>SD Flex Probes</pluralLabel>
    <nameField><label>Probe Name</label><type>Text</type></nameField>
    <deploymentStatus>Deployed</deploymentStatus><sharingModel>ReadWrite</sharingModel>
    ${
      withOverride
        ? ['Large', 'Small']
            .map(
              (formFactor) =>
                `<actionOverrides><actionName>View</actionName><content>${pageName}</content><formFactor>${formFactor}</formFactor><type>Flexipage</type></actionOverrides>`
            )
            .join('\n    ')
        : ''
    }
</CustomObject>`;
    }

    async function deploy(file: string): Promise<void> {
      await sf(
        ['project', 'deploy', 'start', '--source-dir', file, '--target-org', targetOrg, '--wait', '20', '--json'],
        root
      );
    }

    async function retrieve(): Promise<string> {
      const output = `retrieved-${randomUUID()}`;
      await mkdir(path.join(root, output));
      await sf(
        [
          'project',
          'retrieve',
          'start',
          '--metadata',
          `CustomObject:${objectName}`,
          '--target-org',
          targetOrg,
          '--output-dir',
          output,
          '--wait',
          '20',
          '--json',
        ],
        root
      );
      return readFile(path.join(root, output, 'objects', objectName, `${objectName}.object-meta.xml`), 'utf8');
    }
  });
});

async function count(type: string, field: string, name: string): Promise<number> {
  const output = await sf([
    'data',
    'query',
    '--use-tooling-api',
    '--target-org',
    targetOrg,
    '--query',
    `SELECT ${field} FROM ${type} WHERE ${field} = '${name}' LIMIT 2`,
    '--json',
  ]);
  const records = output.result?.records;
  if (!Array.isArray(records)) throw new Error(`Cannot verify ${type} identity`);
  return records.filter((record) => record[field] === name).length;
}

async function sf(
  args: string[],
  cwd?: string
): Promise<{ result?: { id?: string; connectedStatus?: string; records?: Array<Record<string, string>> } }> {
  let stdout: string;
  try {
    ({ stdout } = await execute('sf', args, { cwd, maxBuffer: 10 * 1024 * 1024, timeout: 1_200_000 }));
  } catch (error) {
    const failure = error as Error & { stdout?: string };
    throw new Error(`sf ${args.slice(0, 3).join(' ')} failed: ${failure.stdout ?? failure.message}`, { cause: error });
  }
  const output = JSON.parse(stdout) as {
    status?: number;
    result?: { id?: string; connectedStatus?: string; records?: Array<Record<string, string>>; success?: boolean };
  };
  if (output.status !== 0 || output.result?.success === false)
    throw new Error(`sf ${args.slice(0, 3).join(' ')} returned failure: ${stdout}`);
  return output;
}
