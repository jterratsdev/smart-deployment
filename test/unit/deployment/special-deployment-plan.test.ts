import { expect } from 'chai';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'mocha';
import { SpecialDeploymentPlanService } from '../../../src/deployment/special-deployment-plan.js';
import type { ScanResult } from '../../../src/services/metadata-scanner-service.js';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';
import type { MetadataComponent, MetadataType } from '../../../src/types/metadata.js';

function component(type: MetadataType, name: string, filePath: string): MetadataComponent {
  return {
    type,
    name,
    filePath,
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
  };
}

function scanResult(components: MetadataComponent[]): ScanResult {
  const dependencyResult: DependencyAnalysisResult = {
    components: new Map(),
    graph: new Map(),
    reverseGraph: new Map(),
    edges: [],
    circularDependencies: [],
    isolatedComponents: [],
    stats: {
      totalComponents: components.length,
      totalDependencies: 0,
      componentsByType: {},
      maxDepth: 0,
      mostDepended: { nodeId: '', count: 0 },
      mostDependencies: { nodeId: '', count: 0 },
    },
  };

  return {
    components,
    dependencyResult,
    projectRoot: '/tmp/sfdx-project',
    apiVersion: '66.0',
    executionTime: 1,
    errors: [],
    warnings: [],
  };
}

describe('SpecialDeploymentPlanService', () => {
  it('plans provider-owned phases and excludes lifecycle-owned metadata from core deploy', async () => {
    const service = new SpecialDeploymentPlanService();
    const plan = await service.buildPlan({
      since: 'abc123',
      autoActivate: true,
      scanner: {
        scan: async () =>
          scanResult([
            component('ApexClass', 'AccountService', 'force-app/main/default/classes/AccountService.cls'),
            component('Bot', 'SupportBot', 'force-app/main/default/bots/SupportBot.bot-meta.xml'),
            component(
              'GenAiPlannerBundle',
              'SupportPlanner',
              'force-app/main/default/genAiPlannerBundles/SupportPlanner'
            ),
            component(
              'AiAuthoringBundle',
              'SupportAgent',
              'force-app/main/default/aiAuthoringBundles/SupportAgent/SupportAgent.agent'
            ),
            component(
              'DigitalExperienceBundle',
              'CustomerPortal',
              'force-app/main/default/digitalExperiences/site/CustomerPortal/routes/home.json'
            ),
          ]),
      },
      changedPathProvider: async () => [
        'force-app/main/default/aiAuthoringBundles/SupportAgent/SupportAgent.agent',
        'force-app/main/default/digitalExperiences/site/CustomerPortal/routes/home.json',
        'vlocity/OmniScript/Welcome/Welcome.json',
      ],
    });

    const corePhase = plan.phases.find((phase) => phase.kind === 'core-metadata');
    expect(corePhase?.components).to.deep.equal([
      'ApexClass:AccountService',
      'DigitalExperienceBundle:CustomerPortal',
      'GenAiPlannerBundle:SupportPlanner',
    ]);
    expect(corePhase?.excludedTypes).to.deep.equal(['Bot', 'BotVersion', 'AiAuthoringBundle']);
    expect(corePhase?.commands[0]?.args).to.deep.equal([
      'project',
      'deploy',
      'start',
      '--manifest',
      '<generated-core-manifest>',
    ]);

    const agentPublish = plan.phases.find((phase) => phase.kind === 'agentforce-publish');
    expect(agentPublish?.commands[0]).to.deep.include({
      tool: 'sf',
      reason: 'Publish changed Agentforce authoring bundle without retrieving generated version artifacts.',
    });
    expect(agentPublish?.commands[0]?.args).to.deep.equal([
      'agent',
      'publish',
      'authoring-bundle',
      '-n',
      'SupportAgent',
      '--skip-retrieve',
      '--json',
    ]);

    const activation = plan.phases.find((phase) => phase.kind === 'agentforce-activate');
    expect(activation?.skipped).to.equal(false);
    expect(activation?.commands[0]?.args).to.deep.equal([
      'agent',
      'activate',
      '-n',
      'SupportAgent',
      '--version',
      '<published-version:SupportAgent>',
    ]);

    const community = plan.phases.find((phase) => phase.kind === 'community-publish');
    expect(community?.commands[0]?.args).to.deep.equal(['community', 'publish', '-n', 'CustomerPortal']);

    const omni = plan.phases.find((phase) => phase.kind === 'omnistudio-vlocity');
    expect(omni?.commands[0]?.tool).to.equal('vlocity');
    expect(omni?.commands[0]?.args).to.deep.equal(['packDeploy', '--job', '<generated-vlocity-job.yaml>']);
  });

  it('keeps Agentforce activation skipped by default', async () => {
    const service = new SpecialDeploymentPlanService();
    const plan = await service.buildPlan({
      scanner: {
        scan: async () =>
          scanResult([
            component(
              'AiAuthoringBundle',
              'SupportAgent',
              'force-app/main/default/aiAuthoringBundles/SupportAgent/SupportAgent.agent'
            ),
          ]),
      },
      changedPathProvider: async () => ['force-app/main/default/aiAuthoringBundles/SupportAgent/SupportAgent.agent'],
    });

    const activation = plan.phases.find((phase) => phase.kind === 'agentforce-activate');
    expect(activation?.skipped).to.equal(true);
    expect(activation?.skipReason).to.equal('Activation is disabled by default.');
    expect(activation?.commands).to.deep.equal([]);
  });

  it('reports AiEvaluationDefinition subjectName values missing from source Agentforce metadata', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'smart-deployment-eval-'));
    const evalDir = path.join(projectRoot, 'force-app', 'main', 'default', 'aiEvaluationDefinitions');
    await mkdir(evalDir, { recursive: true });
    await writeFile(
      path.join(evalDir, 'MissingSubject.xml'),
      '<AiEvaluationDefinition><subjectName>MissingAgent</subjectName></AiEvaluationDefinition>',
      'utf8'
    );

    const service = new SpecialDeploymentPlanService();
    const plan = await service.buildPlan({
      scanner: {
        scan: async () => ({
          ...scanResult([]),
          projectRoot,
        }),
      },
      changedPathProvider: async () => ['force-app/main/default/aiEvaluationDefinitions/MissingSubject.xml'],
    });

    expect(plan.success).to.equal(false);
    expect(plan.errors).to.deep.equal([
      'force-app/main/default/aiEvaluationDefinitions/MissingSubject.xml: subjectName "MissingAgent" was not found in source Agentforce bundles or Bots.',
    ]);
  });

  it('accepts AiEvaluationDefinition subjectName values found in the target org', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'smart-deployment-eval-'));
    const evalDir = path.join(projectRoot, 'force-app', 'main', 'default', 'aiEvaluationDefinitions');
    const lookedUpSubjects: string[] = [];
    await mkdir(evalDir, { recursive: true });
    await writeFile(
      path.join(evalDir, 'ExistingSubject.xml'),
      '<AiEvaluationDefinition><subjectName>ExistingAgent</subjectName></AiEvaluationDefinition>',
      'utf8'
    );

    const service = new SpecialDeploymentPlanService();
    const plan = await service.buildPlan({
      targetOrg: 'release-org',
      scanner: {
        scan: async () => ({
          ...scanResult([]),
          projectRoot,
        }),
      },
      changedPathProvider: async () => ['force-app/main/default/aiEvaluationDefinitions/ExistingSubject.xml'],
      targetLookup: {
        hasEvaluationSubject: async (targetOrg, subjectName) => {
          expect(targetOrg).to.equal('release-org');
          lookedUpSubjects.push(subjectName);
          return subjectName === 'ExistingAgent';
        },
      },
    });

    expect(plan.success).to.equal(true);
    expect(plan.targetOrg).to.equal('release-org');
    expect(plan.errors).to.deep.equal([]);
    expect(lookedUpSubjects).to.deep.equal(['ExistingAgent']);
    const aiEvaluations = plan.phases.find((phase) => phase.kind === 'ai-evaluations');
    expect(aiEvaluations?.commands[0]?.args).to.deep.equal([
      'project',
      'deploy',
      'start',
      '--manifest',
      '<generated-ai-evaluation-manifest>',
      '--target-org',
      'release-org',
    ]);
  });
});
