/**
 * SD-002, SD-009, SD-011, SD-012: scanner -> graph -> waves -> manifests.
 * The fixture uses source files and metadata XML rather than mocked parser
 * results so cross-type edges are exercised end to end.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { MetadataScannerService } from '../../src/services/metadata-scanner-service.js';
import { WaveBuilder } from '../../src/waves/wave-builder.js';
import { ManifestGenerator } from '../../src/deployment/manifest-generator.js';

describe('Agentforce deployment pipeline integration', () => {
  const temporaryProjects: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryProjects.splice(0).map((project) => fs.rm(project, { recursive: true, force: true })));
  });

  async function createFixture(): Promise<string> {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'smart-deployment-agentforce-'));
    temporaryProjects.push(project);
    const root = path.join(project, 'force-app', 'main', 'default');

    const files: Record<string, string> = {
      'sfdx-project.json': JSON.stringify({
        packageDirectories: [{ path: 'force-app', default: true }],
        sourceApiVersion: '65.0',
      }),
      'force-app/main/default/objects/Case/Case.object-meta.xml': `<?xml version="1.0"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"><label>Case</label><pluralLabel>Cases</pluralLabel></CustomObject>`,
      'force-app/main/default/objects/SupportConfig__mdt/SupportConfig__mdt.object-meta.xml': `<?xml version="1.0"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"><label>Support Config</label><pluralLabel>Support Configs</pluralLabel></CustomObject>`,
      'force-app/main/default/classes/CaseSummaryService.cls': `public with sharing class CaseSummaryService {
          public static String summarize(Id caseId) {
            return Templates.generatePromptTemplate('CaseSummary');
          }
        }`,
      'force-app/main/default/classes/CaseSummaryService.cls-meta.xml':
        '<?xml version="1.0"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>65.0</apiVersion><status>Active</status></ApexClass>',
      'force-app/main/default/flows/CaseSummary.flow-meta.xml': `<?xml version="1.0"?>
        <Flow xmlns="http://soap.sforce.com/2006/04/metadata">
          <processType>AutoLaunchedFlow</processType><status>Active</status>
          <actionCalls><actionType>apex</actionType><actionName>CaseSummaryService</actionName><name>Summarize</name></actionCalls>
          <actionCalls><actionType>genaiPromptTemplate</actionType><actionName>CaseSummary</actionName><promptTemplateApiName>CaseSummary</promptTemplateApiName></actionCalls>
          <start><object>Case</object></start>
        </Flow>`,
      'force-app/main/default/genAiPromptTemplates/CaseSummary.genAiPromptTemplate-meta.xml': `<?xml version="1.0"?>
        <GenAiPromptTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <developerName>CaseSummary</developerName><masterLabel>Case Summary</masterLabel>
          <relatedEntity>Case</relatedEntity><relatedField>Subject</relatedField><status>Published</status><type>Flex</type>
          <templateVersions><primaryModel>sfdc_ai__DefaultGPT35Turbo</primaryModel><content>Summarize {!Case.Subject}</content>
            <templateDataProviders><apiName>caseProvider</apiName><object>Case</object><fields><apiName>Subject</apiName></fields></templateDataProviders>
          </templateVersions>
        </GenAiPromptTemplate>`,
      'force-app/main/default/aiAuthoringBundles/SupportAgent.agent': `name: SupportAgent
actions:
  summarize:
    target: "flow://CaseSummary"
  lookup:
    target: "apex://CaseSummaryService"
  classify:
    target: "prompt://CaseSummary"
`,
      'force-app/main/default/aiAuthoringBundles/SupportAgent.bundle-meta.xml':
        '<?xml version="1.0"?><AiAuthoringBundle xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>65.0</apiVersion></AiAuthoringBundle>',
    };

    await Promise.all(
      Object.entries(files).map(async ([relativePath, content]) => {
        const filePath = path.join(project, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf8');
      })
    );
    expect(root).to.be.a('string');
    return project;
  }

  function waveNumber(builder: WaveBuilder, waves: ReturnType<WaveBuilder['generateWaves']>, id: string): number {
    return builder.getComponentWave(waves, id) ?? 0;
  }

  it('SD-002/SD-009/SD-011: scans Agentforce dependencies and orders deployable waves', async () => {
    const project = await createFixture();
    const scan = await new MetadataScannerService().scan({ sourcePath: project });
    const ids = scan.components.map((component) => `${component.type}:${component.name}`);

    expect(new Set(ids).size, 'scanner must not emit duplicate node IDs').to.equal(ids.length);
    expect(ids).to.include.members([
      'CustomObject:Case',
      'CustomObject:SupportConfig__mdt',
      'ApexClass:CaseSummaryService',
      'Flow:CaseSummary',
      'GenAiPromptTemplate:CaseSummary',
      'AiAuthoringBundle:SupportAgent',
    ]);

    const graph = scan.dependencyResult.graph;
    expect(Array.from(graph.get('Flow:CaseSummary') ?? [])).to.include.members([
      'ApexClass:CaseSummaryService',
      'GenAiPromptTemplate:CaseSummary',
    ]);
    expect(Array.from(graph.get('AiAuthoringBundle:SupportAgent') ?? [])).to.include.members([
      'Flow:CaseSummary',
      'ApexClass:CaseSummaryService',
      'GenAiPromptTemplate:CaseSummary',
    ]);

    const builder = new WaveBuilder();
    const waves = builder.generateWaves(graph);
    expect(waveNumber(builder, waves, 'CustomObject:Case')).to.equal(1);
    expect(waveNumber(builder, waves, 'GenAiPromptTemplate:CaseSummary')).to.be.lessThan(
      waveNumber(builder, waves, 'ApexClass:CaseSummaryService')
    );
    expect(waveNumber(builder, waves, 'ApexClass:CaseSummaryService')).to.be.lessThan(
      waveNumber(builder, waves, 'Flow:CaseSummary')
    );
    expect(waveNumber(builder, waves, 'Flow:CaseSummary')).to.be.lessThan(
      waveNumber(builder, waves, 'AiAuthoringBundle:SupportAgent')
    );
  });

  it('SD-012: repeats analysis, wave generation, and manifest generation without drift', async () => {
    const project = await createFixture();
    const scanner = new MetadataScannerService();
    const first = await scanner.scan({ sourcePath: project });
    const second = await scanner.scan({ sourcePath: project });

    const componentIds = (result: typeof first) =>
      result.components.map((component) => `${component.type}:${component.name}`).sort();
    expect(componentIds(second)).to.deep.equal(componentIds(first));
    expect(second.dependencyResult.stats).to.deep.equal(first.dependencyResult.stats);

    const builder = new WaveBuilder();
    const firstWaves = builder.generateWaves(first.dependencyResult.graph);
    const secondWaves = builder.generateWaves(second.dependencyResult.graph);
    expect(secondWaves.waves).to.deep.equal(firstWaves.waves);

    const outputDir = path.join(project, '.smart-deployment', 'manifests');
    const generator = new ManifestGenerator();
    const options = {
      projectRoot: project,
      componentMap: first.dependencyResult.components,
      outputDir,
      validateFiles: true,
    };
    const firstManifests = await generator.generateManifests(firstWaves.waves, options);
    const secondManifests = await generator.generateManifests(secondWaves.waves, options);

    expect(secondManifests.errors).to.deep.equal([]);
    expect(secondManifests.manifests.map((manifest) => [manifest.fileName, manifest.content])).to.deep.equal(
      firstManifests.manifests.map((manifest) => [manifest.fileName, manifest.content])
    );
    expect(secondManifests.manifests.some((manifest) => manifest.content.includes('SupportAgent'))).to.be.true;
  });
});
