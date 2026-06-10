import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { MetadataGapAnalysisService } from '../../../src/analysis/metadata-gap-analysis-service.js';

describe('MetadataGapAnalysisService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('reports deterministic gaps from package manifests and source paths', async () => {
    const projectRoot = await createProject();
    await writePackageXml(projectRoot, ['ApexClass', 'CustomApplication', 'MatchingRule', 'GenAiPlugin']);
    await writeFile(
      path.join(projectRoot, 'force-app/main/default/applications/Sales.app-meta.xml'),
      '<CustomApplication />'
    );
    await writeFile(
      path.join(projectRoot, 'force-app/main/default/matchingRules/Account.matchingRule-meta.xml'),
      '<MatchingRule />'
    );

    const result = await new MetadataGapAnalysisService().analyze({ sourcePath: projectRoot });

    expect(result.analysisMode).to.equal('deterministic');
    expect(result.summary.detectedTypeCount).to.equal(4);
    expect(result.summary.supportedTypeCount).to.equal(1);
    expect(result.gaps.map((gap) => gap.metadataType)).to.deep.equal([
      'CustomApplication',
      'GenAiPlugin',
      'MatchingRule',
    ]);
    expect(result.gaps.find((gap) => gap.metadataType === 'MatchingRule')).to.deep.include({
      classification: 'dependency-rule',
      supportStatus: 'unsupported',
      requiresHumanReview: false,
    });
    expect(result.gaps.find((gap) => gap.metadataType === 'GenAiPlugin')).to.deep.include({
      classification: 'provider-owned',
      supportStatus: 'ordered-only',
      requiresHumanReview: true,
    });
  });

  it('adds workflow-ready AI context without direct provider access', async () => {
    const projectRoot = await createProject();
    await writePackageXml(projectRoot, ['CustomApplication']);

    const result = await new MetadataGapAnalysisService().analyze({ sourcePath: projectRoot, aiExplain: true });

    expect(result.analysisMode).to.equal('deterministic-with-ai-context');
    expect(result.aiContext).to.deep.include({
      mode: 'workflow-prompt',
      directProviderApiAllowed: false,
      recommendedCommand: 'sf setup-agents workflow run --story PLUGIN-AI-METADATA-GAP-DETECTION',
    });
    expect(result.aiContext?.prompt).to.include('CustomApplication');
    expect(result.aiContext?.prompt).to.include('Do not call provider APIs from the plugin runtime.');
  });

  async function createProject(): Promise<string> {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'metadata-gaps-'));
    tempDirs.push(projectRoot);
    await mkdir(path.join(projectRoot, 'force-app/main/default/applications'), { recursive: true });
    await mkdir(path.join(projectRoot, 'force-app/main/default/classes'), { recursive: true });
    await mkdir(path.join(projectRoot, 'force-app/main/default/matchingRules'), { recursive: true });
    await writeFile(
      path.join(projectRoot, 'sfdx-project.json'),
      JSON.stringify(
        {
          packageDirectories: [{ path: 'force-app', default: true }],
          sourceApiVersion: '61.0',
        },
        null,
        2
      )
    );
    await writeFile(
      path.join(projectRoot, 'force-app/main/default/classes/AccountService.cls-meta.xml'),
      '<ApexClass />'
    );
    return projectRoot;
  }

  async function writePackageXml(projectRoot: string, metadataTypes: string[]): Promise<void> {
    const typesXml = metadataTypes
      .map((metadataType) => `<types><members>*</members><name>${metadataType}</name></types>`)
      .join('');
    await writeFile(
      path.join(projectRoot, 'force-app/main/default/package.xml'),
      `<?xml version="1.0" encoding="UTF-8"?><Package>${typesXml}<version>61.0</version></Package>`
    );
  }
});
