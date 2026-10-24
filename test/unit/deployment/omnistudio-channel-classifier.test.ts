import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import {
  classifyOmniStudioChannels,
  type OmniStudioChannelClassification,
} from '../../../src/deployment/omnistudio-channel-classifier.js';

const PROJECT_ROOT = '/tmp/sfdx-project';

function dataPackJson(
  vlocityDataPackType: string,
  vlocityRecordSObjectType: string,
  extra: Record<string, string> = {}
): string {
  return JSON.stringify({
    VlocityDataPackType: vlocityDataPackType,
    VlocityRecordSObjectType: vlocityRecordSObjectType,
    ...extra,
  });
}

function normalizedFixtures(fixtures: Record<string, string>): Map<string, string> {
  return new Map(
    Object.entries(fixtures).map(([relativePath, content]) => [path.join(PROJECT_ROOT, relativePath), content])
  );
}

function readFileFromFixtures(normalized: Map<string, string>): (absPath: string) => Promise<string> {
  return async (absPath: string): Promise<string> => {
    const content = normalized.get(absPath);
    if (content === undefined) {
      throw new Error(`ENOENT: no fixture for ${absPath}`);
    }
    return content;
  };
}

/**
 * The real filesystem's `realpath`/`stat` do not apply to these in-memory fixtures (there is no
 * real file at `PROJECT_ROOT`). Default test doubles mirror what a real filesystem would report
 * for these specific paths: `resolveRealPath` is the identity function (no symlinks exist in the
 * fixture map), and `statSize` reports the fixture content's own byte length. Tests that need to
 * exercise failure (N1/N2/N3) override one of these explicitly.
 */
function identityRealPath(): (absPath: string) => Promise<string> {
  return async (absPath: string): Promise<string> => absPath;
}

function statSizeFromFixtures(normalized: Map<string, string>): (absPath: string) => Promise<number> {
  return async (absPath: string): Promise<number> => {
    const content = normalized.get(absPath);
    if (content === undefined) {
      throw new Error(`ENOENT: no fixture for ${absPath}`);
    }
    return Buffer.byteLength(content, 'utf8');
  };
}

async function classify(
  changedPaths: string[],
  fixtures: Record<string, string> = {},
  overrides: {
    resolveRealPath?: (absPath: string) => Promise<string>;
    statSize?: (absPath: string) => Promise<number>;
  } = {}
): Promise<OmniStudioChannelClassification[]> {
  const normalized = normalizedFixtures(fixtures);
  return classifyOmniStudioChannels({
    projectRoot: PROJECT_ROOT,
    changedPaths,
    readFile: readFileFromFixtures(normalized),
    resolveRealPath: overrides.resolveRealPath ?? identityRealPath(),
    statSize: overrides.statSize ?? statSizeFromFixtures(normalized),
  });
}

describe('classifyOmniStudioChannels', () => {
  it('classifies a native OmniDataTransform path as native-metadata (case 1)', async () => {
    const [result] = await classify(['force-app/main/default/omniDataTransforms/Acct.rpt-meta.xml']);

    expect(result?.channel).to.equal('native-metadata');
    expect(result?.artifactKey).to.equal('OmniDataTransform:Acct');
    expect(result?.reason).to.equal('native-shape');
  });

  it('classifies a native OmniIntegrationProcedure path as native-metadata (case 2)', async () => {
    const [result] = await classify(['force-app/main/default/omniIntegrationProcedures/Proc.oip-meta.xml']);

    expect(result?.channel).to.equal('native-metadata');
    expect(result?.artifactKey).to.equal('OmniIntegrationProcedure:Proc');
  });

  it('classifies a native OmniScript path as native-metadata (case 3)', async () => {
    const [result] = await classify(['force-app/main/default/omniScripts/Welcome.os-meta.xml']);

    expect(result?.channel).to.equal('native-metadata');
    expect(result?.artifactKey).to.equal('OmniScript:Welcome');
  });

  it('classifies a native OmniUiCard path as native-metadata (case 4)', async () => {
    const [result] = await classify(['force-app/main/default/omniUiCard/Card.ouc-meta.xml']);

    expect(result?.channel).to.equal('native-metadata');
    expect(result?.artifactKey).to.equal('OmniUiCard:Card');
  });

  it('classifies a managed DataPack with a concrete managed namespace as managed-datapack (case 6)', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', 'vlocity_ins__OmniScript__c'),
    });

    expect(result?.channel).to.equal('managed-datapack');
    expect(result?.artifactKey).to.equal('DataPack:OmniScript/Welcome_English');
    expect(result?.reason).to.equal('managed-shape');
  });

  it('blocks an unresolved vlocity folder with no _DataPack.json sibling (case 7)', async () => {
    const [result] = await classify(['vlocity/OmniScript/Welcome/Welcome.json']);

    expect(result?.channel).to.equal('blocked');
    expect(result?.reason).to.equal('unknown-shape');
  });

  it('includes an actionable remedy for an unknown-shape block (case 7)', async () => {
    const [result] = await classify(['vlocity/OmniScript/Welcome/Welcome.json']);

    expect(result?.remedy).to.be.a('string');
    expect(result?.remedy).to.include('.forceignore');
  });

  it('blocks a native-directory path with a non-registry suffix (case 8)', async () => {
    const [result] = await classify(['force-app/main/default/omniScripts/Welcome.json']);

    expect(result?.channel).to.equal('blocked');
    expect(result?.reason).to.equal('unknown-shape');
  });

  it('blocks a managed shape with an unresolved %vlocity_namespace% token and no declared namespace (case 9a)', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', '%vlocity_namespace%__OmniScript__c'),
    });

    expect(result?.channel).to.equal('blocked');
    expect(result?.reason).to.equal('identity-unproven');
  });

  it('includes an actionable remedy naming the job file for an identity-unproven block (case 9a)', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', '%vlocity_namespace%__OmniScript__c'),
    });

    expect(result?.remedy).to.be.a('string');
    expect(result?.remedy).to.include('vlocity.yaml');
  });

  it('resolves an unresolved %vlocity_namespace% token via a project-declared job-file namespace (AC-002 amendment)', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', '%vlocity_namespace%__OmniScript__c'),
      'vlocity.yaml': 'namespace: vlocity_cmt\n',
    });

    expect(result?.channel).to.equal('managed-datapack');
    expect(result?.artifactKey).to.equal('DataPack:OmniScript/Welcome_English');
  });

  it('blocks malformed DataPack JSON as identity-unproven (case 9b)', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: '{not valid json',
    });

    expect(result?.channel).to.equal('blocked');
    expect(result?.reason).to.equal('identity-unproven');
  });

  it('classifies an SObject-type DataPack whose VlocityRecordSObjectType is a concrete managed field API name', async () => {
    const dataPackPath = 'vlocity/SObject/Product2Record/Product2Record_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('SObject', 'vlocity_cmt__ProductCode__c'),
    });

    expect(result?.channel).to.equal('managed-datapack');
    expect(result?.artifactKey).to.equal('DataPack:SObject/Product2Record');
  });

  it('blocks an SObject-type DataPack whose VlocityRecordSObjectType is an unmanaged standard/custom object (no namespace)', async () => {
    const dataPackPath = 'vlocity/SObject/Product2Record/Product2Record_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('SObject', 'Product2'),
    });

    expect(result?.channel).to.equal('blocked');
    expect(result?.reason).to.equal('identity-unproven');
  });

  // Security review F1 (major): identity must come strictly from a `<ns>__<Name>__<suffix>` managed
  // API name on VlocityRecordSObjectType, not from any `X__Y`-shaped string anywhere in the record.
  it('F1 negative: blocks an unmanaged Object__c-shaped VlocityRecordSObjectType, never treating "Object" as a namespace', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome/Welcome_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', 'Custom__c'),
    });

    expect(result?.channel).to.equal('blocked');
    expect(result?.reason).to.equal('identity-unproven');
  });

  it('F1 negative: blocks an unresolved token record with no declared namespace even when an unrelated field looks like Status__c', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome/Welcome_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', '%vlocity_namespace%__OmniScript__c', { Name: 'Status__c' }),
    });

    expect(result?.channel).to.equal('blocked');
    expect(result?.reason).to.equal('identity-unproven');
  });

  it('F1 positive: still classifies a genuine vlocity_cmt__OmniScript__c as managed-datapack', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome/Welcome_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', 'vlocity_cmt__OmniScript__c'),
    });

    expect(result?.channel).to.equal('managed-datapack');
    expect(result?.artifactKey).to.equal('DataPack:OmniScript/Welcome');
  });

  it('blocks both sides of a native/managed channel conflict for the same logical artifact (case 10)', async () => {
    const nativePath = 'force-app/main/default/omniScripts/Welcome.os-meta.xml';
    const dataPackPath = 'vlocity/OmniScript/Welcome/Welcome_DataPack.json';
    const results = await classify([nativePath, dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', 'vlocity_ins__OmniScript__c'),
    });

    expect(results).to.have.lengthOf(2);
    for (const result of results) {
      expect(result.channel).to.equal('blocked');
      expect(result.reason).to.equal('channel-conflict');
    }
  });

  it('includes an actionable remedy for a channel-conflict block', async () => {
    const nativePath = 'force-app/main/default/omniScripts/Welcome.os-meta.xml';
    const dataPackPath = 'vlocity/OmniScript/Welcome/Welcome_DataPack.json';
    const [result] = await classify([nativePath, dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', 'vlocity_ins__OmniScript__c'),
    });

    expect(result?.remedy).to.be.a('string');
    expect(result?.remedy).to.include('exactly one format');
  });

  // Security review F2 (major): the conflict key must map every VBT DataPack type to its native
  // counterpart, not just OmniScript (whose VBT and native names already happen to coincide).
  it('F2: blocks a DataRaptor/OmniDataTransform conflict for the same name', async () => {
    const nativePath = 'force-app/main/default/omniDataTransforms/Acct.rpt-meta.xml';
    const dataPackPath = 'vlocity/DataRaptor/Acct/Acct_DataPack.json';
    const results = await classify([nativePath, dataPackPath], {
      [dataPackPath]: dataPackJson('DataRaptor', 'vlocity_ins__DataRaptor__c'),
    });

    expect(results).to.have.lengthOf(2);
    for (const result of results) {
      expect(result.channel).to.equal('blocked');
      expect(result.reason).to.equal('channel-conflict');
    }
  });

  it('F2: blocks an IntegrationProcedure/OmniIntegrationProcedure conflict for the same name', async () => {
    const nativePath = 'force-app/main/default/omniIntegrationProcedures/Proc.oip-meta.xml';
    const dataPackPath = 'vlocity/IntegrationProcedure/Proc/Proc_DataPack.json';
    const results = await classify([nativePath, dataPackPath], {
      [dataPackPath]: dataPackJson('IntegrationProcedure', 'vlocity_ins__IntegrationProcedure__c'),
    });

    expect(results).to.have.lengthOf(2);
    for (const result of results) {
      expect(result.channel).to.equal('blocked');
      expect(result.reason).to.equal('channel-conflict');
    }
  });

  it('F2: blocks an OmniScript/OmniScript conflict for the same name (VBT and native names coincide)', async () => {
    const nativePath = 'force-app/main/default/omniScripts/Welcome.os-meta.xml';
    const dataPackPath = 'vlocity/OmniScript/Welcome/Welcome_DataPack.json';
    const results = await classify([nativePath, dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', 'vlocity_ins__OmniScript__c'),
    });

    expect(results).to.have.lengthOf(2);
    for (const result of results) {
      expect(result.channel).to.equal('blocked');
      expect(result.reason).to.equal('channel-conflict');
    }
  });

  it('F2: blocks a FlexCard/OmniUiCard conflict for the same name', async () => {
    const nativePath = 'force-app/main/default/omniUiCard/Card.ouc-meta.xml';
    const dataPackPath = 'vlocity/FlexCard/Card/Card_DataPack.json';
    const results = await classify([nativePath, dataPackPath], {
      [dataPackPath]: dataPackJson('FlexCard', 'vlocity_ins__FlexCard__c'),
    });

    expect(results).to.have.lengthOf(2);
    for (const result of results) {
      expect(result.channel).to.equal('blocked');
      expect(result.reason).to.equal('channel-conflict');
    }
  });

  it('F2: a DataPack type with no native counterpart (e.g. SObject) never conflicts', async () => {
    const nativePath = 'force-app/main/default/omniScripts/Welcome.os-meta.xml';
    const dataPackPath = 'vlocity/SObject/Welcome/Welcome_DataPack.json';
    const results = await classify([nativePath, dataPackPath], {
      [dataPackPath]: dataPackJson('SObject', 'vlocity_ins__SomeField__c'),
    });

    const native = results.find((entry) => entry.path === nativePath);
    const managed = results.find((entry) => entry.path === dataPackPath);
    expect(native?.channel).to.equal('native-metadata');
    expect(managed?.channel).to.equal('managed-datapack');
  });

  // Security re-review N1 (minor): Salesforce DeveloperName/component-name uniqueness is
  // case-insensitive, so a conflict key must case-fold before comparing.
  it('N1: blocks a case-differing DataRaptor/OmniDataTransform conflict (managed "d" vs native "D")', async () => {
    const nativePath = 'force-app/main/default/omniDataTransforms/D.rpt-meta.xml';
    const dataPackPath = 'vlocity/DataRaptor/d/d_DataPack.json';
    const results = await classify([nativePath, dataPackPath], {
      [dataPackPath]: dataPackJson('DataRaptor', 'vlocity_ins__DataRaptor__c'),
    });

    expect(results).to.have.lengthOf(2);
    for (const result of results) {
      expect(result.channel).to.equal('blocked');
      expect(result.reason).to.equal('channel-conflict');
    }
  });

  it('produces identical sorted output regardless of input order (case 13 / determinism)', async () => {
    const nativePath = 'force-app/main/default/omniScripts/Welcome.os-meta.xml';
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    const unknownPath = 'vlocity/OmniScript/Other/Other.json';
    const fixtures = {
      [dataPackPath]: dataPackJson('OmniScript', 'vlocity_ins__OmniScript__c'),
    };

    const forward = await classify([nativePath, dataPackPath, unknownPath], fixtures);
    const shuffled = await classify([unknownPath, dataPackPath, nativePath], fixtures);

    expect(shuffled).to.deep.equal(forward);
    expect(forward.map((entry) => entry.path)).to.deep.equal([nativePath, dataPackPath, unknownPath].slice().sort());
  });

  it('returns no classifications for non-OmniStudio candidate paths', async () => {
    const results = await classify(['force-app/main/default/classes/AccountService.cls']);

    expect(results).to.deep.equal([]);
  });

  // Security review F3 (minor): only a root-level (column 0) namespace key in vlocity.yaml counts;
  // an indented key nested under an unrelated map must be ignored.
  it('F3: ignores a nested/indented namespace key in vlocity.yaml', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', '%vlocity_namespace%__OmniScript__c'),
      'vlocity.yaml': 'manifest:\n  other:\n    namespace: vlocity_cmt\n',
    });

    expect(result?.channel).to.equal('blocked');
    expect(result?.reason).to.equal('identity-unproven');
  });

  it('F3: still resolves a true root-level namespace key in vlocity.yaml', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', '%vlocity_namespace%__OmniScript__c'),
      'vlocity.yaml': 'namespace: vlocity_cmt\n',
    });

    expect(result?.channel).to.equal('managed-datapack');
  });

  // Security review F4 (minor): reads must be confined to projectRoot; a candidate path that
  // lexically escapes the root (via `..`) must never be read, even if a fixture exists for it.
  it('F4: blocks a DataPack path that escapes projectRoot via .. traversal', async () => {
    const dataPackPath = '../outside/vlocity/OmniScript/E/E_DataPack.json';
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', 'vlocity_ins__OmniScript__c'),
    });

    expect(result?.channel).to.equal('blocked');
    expect(result?.reason).to.equal('unknown-shape');
  });

  // Security review F5 (minor): a DataPack JSON file larger than the size cap must be blocked
  // before JSON.parse, not loaded fully into memory and parsed.
  it('F5: blocks an oversized DataPack JSON file as identity-unproven with a clear evidence string', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    const oversizedContent = 'a'.repeat(5 * 1024 * 1024 + 1);
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: oversizedContent,
    });

    expect(result?.channel).to.equal('blocked');
    expect(result?.reason).to.equal('identity-unproven');
    expect(result?.evidence.join(' ')).to.include('size cap');
  });

  // Security re-review N2 (minor): if realpath of the root or the file throws after a successful
  // read, the content must be discarded (fail closed), not accepted.
  it('N2: blocks a managed DataPack when the injected realpath resolver throws for the file', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    const results = await classify(
      [dataPackPath],
      { [dataPackPath]: dataPackJson('OmniScript', 'vlocity_ins__OmniScript__c') },
      {
        resolveRealPath: async (absPath: string): Promise<string> => {
          if (absPath.endsWith('_DataPack.json')) {
            throw new Error('simulated realpath failure for the DataPack file');
          }
          return absPath;
        },
      }
    );

    expect(results[0]?.channel).to.equal('blocked');
    expect(results[0]?.channel).to.not.equal('managed-datapack');
  });

  it('N2: blocks a managed DataPack when the injected realpath resolver throws for the project root', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    const [result] = await classify(
      [dataPackPath],
      { [dataPackPath]: dataPackJson('OmniScript', 'vlocity_ins__OmniScript__c') },
      {
        resolveRealPath: async (absPath: string): Promise<string> => {
          if (absPath === PROJECT_ROOT) {
            throw new Error('simulated realpath failure for the project root');
          }
          return absPath;
        },
      }
    );

    expect(result?.channel).to.equal('blocked');
    expect(result?.channel).to.not.equal('managed-datapack');
  });

  // Security re-review N3 (minor): size must be checked via stat before reading (not just after a
  // full read), applied to both DataPack JSON and vlocity.yaml; vlocity.yaml uses a smaller cap.
  it('N3: blocks an oversized vlocity.yaml so the declared namespace is not honored', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    const oversizedYaml = `namespace: vlocity_cmt\n${'# padding\n'.repeat(7000)}`;
    const [result] = await classify([dataPackPath], {
      [dataPackPath]: dataPackJson('OmniScript', '%vlocity_namespace%__OmniScript__c'),
      'vlocity.yaml': oversizedYaml,
    });

    expect(result?.channel).to.equal('blocked');
    expect(result?.reason).to.equal('identity-unproven');
  });

  it('N3: never reads a DataPack JSON file beyond its reported stat size (stat-before-read)', async () => {
    const dataPackPath = 'vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json';
    let readFileCalled = false;
    const results = await classifyOmniStudioChannels({
      projectRoot: PROJECT_ROOT,
      changedPaths: [dataPackPath],
      readFile: async (): Promise<string> => {
        readFileCalled = true;
        return dataPackJson('OmniScript', 'vlocity_ins__OmniScript__c');
      },
      resolveRealPath: identityRealPath(),
      statSize: async (): Promise<number> => 5 * 1024 * 1024 + 1,
    });

    expect(results[0]?.channel).to.equal('blocked');
    expect(results[0]?.reason).to.equal('identity-unproven');
    expect(readFileCalled).to.equal(false);
  });

  describe('F4 real-filesystem symlink escape', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(path.join(os.tmpdir(), 'omnistudio-channel-classifier-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('blocks a DataPack JSON that is a symlink pointing outside projectRoot', async () => {
      const projectRoot = path.join(tempDir, 'project');
      const outsideDir = path.join(tempDir, 'outside');
      const dataPackDir = path.join(projectRoot, 'vlocity', 'OmniScript', 'E');
      await mkdir(dataPackDir, { recursive: true });
      await mkdir(outsideDir, { recursive: true });

      const outsideFile = path.join(outsideDir, 'E_DataPack.json');
      await writeFile(
        outsideFile,
        JSON.stringify({ VlocityDataPackType: 'OmniScript', VlocityRecordSObjectType: 'vlocity_ins__OmniScript__c' }),
        'utf8'
      );
      await symlink(outsideFile, path.join(dataPackDir, 'E_DataPack.json'));

      const [result] = await classifyOmniStudioChannels({
        projectRoot,
        changedPaths: ['vlocity/OmniScript/E/E_DataPack.json'],
      });

      expect(result?.channel).to.equal('blocked');
      expect(result?.reason).to.equal('unknown-shape');
    });

    it('still classifies a real (non-symlinked) DataPack JSON inside projectRoot as managed-datapack', async () => {
      const projectRoot = path.join(tempDir, 'project');
      const dataPackDir = path.join(projectRoot, 'vlocity', 'OmniScript', 'E');
      await mkdir(dataPackDir, { recursive: true });
      await writeFile(
        path.join(dataPackDir, 'E_DataPack.json'),
        JSON.stringify({ VlocityDataPackType: 'OmniScript', VlocityRecordSObjectType: 'vlocity_ins__OmniScript__c' }),
        'utf8'
      );

      const [result] = await classifyOmniStudioChannels({
        projectRoot,
        changedPaths: ['vlocity/OmniScript/E/E_DataPack.json'],
      });

      expect(result?.channel).to.equal('managed-datapack');
    });
  });
});
