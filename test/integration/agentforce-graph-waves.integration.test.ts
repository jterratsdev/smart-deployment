import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { MetadataScannerService } from '../../src/services/metadata-scanner-service.js';
import { WaveBuilder } from '../../src/waves/wave-builder.js';

describe('Agentforce scanner graph and waves', () => {
  const projects: string[] = [];

  afterEach(async () => {
    await Promise.all(projects.splice(0).map((project) => fs.rm(project, { recursive: true, force: true })));
  });

  it('orders shared Flow, function, plugin, and authoring bundle dependencies deterministically', async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'smart-deployment-agentforce-'));
    projects.push(project);
    const files: Record<string, string> = {
      'sfdx-project.json': JSON.stringify({
        packageDirectories: [{ path: 'force-app', default: true }],
        sourceApiVersion: '67.0',
      }),
      'force-app/main/default/flows/SharedSupport.flow-meta.xml':
        '<Flow xmlns="http://soap.sforce.com/2006/04/metadata"><status>Active</status></Flow>',
      'force-app/main/default/genAiFunctions/SharedFunction/SharedFunction.genAiFunction-meta.xml':
        '<GenAiFunction xmlns="http://soap.sforce.com/2006/04/metadata"><invocationTarget>SharedSupport</invocationTarget><invocationTargetType>flow</invocationTargetType></GenAiFunction>',
      'force-app/main/default/genAiPlugins/SupportPlugin/SupportPlugin.genAiPlugin-meta.xml':
        '<GenAiPlugin xmlns="http://soap.sforce.com/2006/04/metadata"><genAiFunctions><functionName>SharedFunction</functionName></genAiFunctions></GenAiPlugin>',
      'force-app/main/default/aiAuthoringBundles/SupportAgent/SupportAgent.agent':
        'target: flow://SharedSupport\ntarget: agent://SpecialistAgent',
      'force-app/main/default/aiAuthoringBundles/SpecialistAgent/SpecialistAgent.agent': 'agentType: specialist',
    };

    await Promise.all(
      Object.entries(files).map(async ([relativePath, content]) => {
        const filePath = path.join(project, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf8');
      })
    );

    const scan = await new MetadataScannerService().scan({ sourcePath: project });
    const graph = scan.dependencyResult.graph;
    expect([...graph.get('GenAiFunction:SharedFunction')!]).to.include('Flow:SharedSupport');
    expect([...graph.get('GenAiPlugin:SupportPlugin')!]).to.include('GenAiFunction:SharedFunction');
    expect([...graph.get('AiAuthoringBundle:SupportAgent')!]).to.include.members([
      'Flow:SharedSupport',
      'AiAuthoringBundle:SpecialistAgent',
    ]);

    const builder = new WaveBuilder();
    const first = builder.generateWaves(graph);
    const second = builder.generateWaves(graph);
    expect(second.waves).to.deep.equal(first.waves);
    expect(builder.getComponentWave(first, 'Flow:SharedSupport')).to.be.lessThan(
      builder.getComponentWave(first, 'GenAiFunction:SharedFunction')!
    );
    expect(builder.getComponentWave(first, 'GenAiFunction:SharedFunction')).to.be.lessThan(
      builder.getComponentWave(first, 'GenAiPlugin:SupportPlugin')!
    );
    expect(builder.getComponentWave(first, 'AiAuthoringBundle:SpecialistAgent')).to.be.lessThan(
      builder.getComponentWave(first, 'AiAuthoringBundle:SupportAgent')!
    );
  });

  it('places a bundle whose target is already available in the destination org', async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'smart-deployment-agentforce-external-'));
    projects.push(project);
    const files: Record<string, string> = {
      'sfdx-project.json': JSON.stringify({
        packageDirectories: [{ path: 'force-app', default: true }],
        sourceApiVersion: '67.0',
      }),
      'force-app/main/default/aiAuthoringBundles/SupportAgent/SupportAgent.agent': 'target: flow://ManagedFlow',
    };

    await Promise.all(
      Object.entries(files).map(async ([relativePath, content]) => {
        const filePath = path.join(project, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf8');
      })
    );

    const scan = await new MetadataScannerService().scan({ sourcePath: project });
    const result = new WaveBuilder({ ignoreExternalDependencies: true }).generateWaves(scan.dependencyResult.graph);

    expect(result.unplacedComponents).to.deep.equal([]);
    expect(result.waves.flatMap((wave) => wave.components)).to.include('AiAuthoringBundle:SupportAgent');
  });
});
