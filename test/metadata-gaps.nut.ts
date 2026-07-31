import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  cleanupNutContexts,
  createNutContext,
  createSalesforceProject,
  execNutCommand,
} from './helpers/nut-helpers.js';

type MetadataGapsJson = {
  success: boolean;
  analysisMode: string;
  detectedTypes: Array<{
    metadataType: string;
    supportStatus: string;
    evidence: string[];
    detectedFrom: string[];
  }>;
  gaps: Array<{
    metadataType: string;
    supportStatus: string;
  }>;
};

describe('NUT: metadata gaps capability registry', () => {
  const tempDirs: string[] = [];

  afterEach(async () => cleanupNutContexts(tempDirs));

  it('preserves JSON and human output while reporting registry-backed support deterministically', async () => {
    const context = await createNutContext('metadata-gaps-registry-nut-');
    tempDirs.push(context.tempDir);
    const projectRoot = await createSalesforceProject(context.tempDir, 'project', {
      'force-app/main/default/package.xml': packageXml(['UnknownType', 'CustomApplication', 'ApexPage']),
    });

    const jsonResult = execNutCommand<MetadataGapsJson>(
      `metadata gaps --source-path ${projectRoot} --json`,
      context.homeDir
    );
    const output = (
      JSON.parse(jsonResult.shellOutput.stdout) as {
        result: MetadataGapsJson;
      }
    ).result;

    expect(output.success).to.equal(true);
    expect(output.analysisMode).to.equal('deterministic');
    expect(
      output.detectedTypes.map(({ metadataType, supportStatus }) => ({ metadataType, supportStatus }))
    ).to.deep.equal([
      { metadataType: 'ApexPage', supportStatus: 'supported' },
      { metadataType: 'CustomApplication', supportStatus: 'unsupported' },
      { metadataType: 'UnknownType', supportStatus: 'unsupported' },
    ]);
    expect(Object.keys(output.detectedTypes[0]).sort()).to.deep.equal([
      'detectedFrom',
      'evidence',
      'metadataType',
      'supportStatus',
    ]);

    const humanResult = execNutCommand(`metadata gaps --source-path ${projectRoot}`, context.homeDir);
    expect(humanResult.shellOutput.stdout).to.include('Smart deployment metadata gaps');
    expect(humanResult.shellOutput.stdout).to.include('- CustomApplication: dependency-rule (unsupported)');
    expect(humanResult.shellOutput.stdout).to.include('- UnknownType: registry-only (unsupported)');
  });
});

function packageXml(metadataTypes: string[]): string {
  const types = metadataTypes
    .map((metadataType) => `<types><members>*</members><name>${metadataType}</name></types>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><Package>${types}<version>61.0</version></Package>`;
}
