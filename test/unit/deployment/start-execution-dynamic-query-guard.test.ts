import { expect } from 'chai';
import { describe, it } from 'mocha';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';
import { DeploymentRunner, type DeploymentRunnerParams } from '../../../src/deployment/deployment-runner.js';
import type { DeploymentContext } from '../../../src/deployment/deployment-context-service.js';
import {
  DynamicQueryTargetValidator,
  type DynamicQueryTargetValidationResult,
} from '../../../src/deployment/dynamic-query-target-validator.js';
import { StartExecutionService } from '../../../src/deployment/start-execution-service.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

class BlockingDynamicQueryValidator extends DynamicQueryTargetValidator {
  public constructor(private readonly result: DynamicQueryTargetValidationResult) {
    super({
      hasCustomField: async () => true,
    });
  }

  public override async validate(): Promise<DynamicQueryTargetValidationResult> {
    return this.result;
  }
}

class UnexpectedDeploymentRunner extends DeploymentRunner {
  public override async execute(params: DeploymentRunnerParams): Promise<void> {
    void params;
    throw new Error('deployment runner should not be called');
  }
}

describe('StartExecutionService dynamic query guard', () => {
  it('blocks deployment when target-org dynamic query field prerequisites are missing', async () => {
    const service = new StartExecutionService({
      dynamicQueryTargetValidator: new BlockingDynamicQueryValidator({
        checked: true,
        unresolvedFields: [],
        missingFields: [
          {
            consumerNodeId: 'ApexClass:AccountQueryService',
            fieldNodeId: 'CustomField:Account.External_Id__c',
            objectName: 'Account',
            fieldName: 'External_Id__c',
            reason: 'Dynamic SOQL apex-string reference',
            confidence: 1,
          },
        ],
      }),
      deploymentRunner: new UnexpectedDeploymentRunner(),
    });

    let thrownError: Error | undefined;
    try {
      await service.execute({
        dryRun: false,
        validateOnly: false,
        allowCycleRemediation: false,
        skipTests: true,
        targetOrg: 'fixture@example.com',
        deploymentContext: createDeploymentContext(),
        log: () => {},
      });
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError?.message).to.include('Dynamic SOQL prerequisites are missing in the target org.');
    expect(thrownError?.message).to.include(
      'ApexClass:AccountQueryService requires CustomField:Account.External_Id__c'
    );
    expect(thrownError?.message).to.include('Install the missing CustomField metadata in an earlier wave');
  });
});

function createDeploymentContext(): DeploymentContext {
  const component: MetadataComponent = {
    name: 'AccountQueryService',
    type: 'ApexClass',
    filePath: 'classes/AccountQueryService.cls',
    dependencies: new Set(['CustomField:Account.External_Id__c']),
    dependents: new Set(),
    priorityBoost: 0,
  };
  const nodeId = 'ApexClass:AccountQueryService';

  return {
    scanResult: {
      components: [component],
      dependencyResult: createDependencyResult(nodeId, component),
      projectRoot: '/tmp/project',
      apiVersion: '66.0',
      executionTime: 1,
      errors: [],
      warnings: [],
    },
    orderedWaves: [
      {
        number: 1,
        components: [nodeId],
        metadata: {
          componentCount: 1,
          types: ['ApexClass'],
          maxDepth: 1,
          hasCircularDeps: false,
          estimatedTime: 1,
        },
      },
    ],
    messages: {
      logs: [],
      warnings: [],
    },
  };
}

function createDependencyResult(nodeId: string, component: MetadataComponent): DependencyAnalysisResult {
  return {
    components: new Map([[nodeId, component]]),
    graph: new Map([[nodeId, new Set(['CustomField:Account.External_Id__c'])]]),
    reverseGraph: new Map([['CustomField:Account.External_Id__c', new Set([nodeId])]]),
    edges: [
      {
        from: nodeId,
        to: 'CustomField:Account.External_Id__c',
        type: 'hard',
        source: 'parser',
        reason: 'Dynamic SOQL apex-string reference',
        confidence: 1,
      },
    ],
    circularDependencies: [],
    isolatedComponents: [],
    stats: {
      totalComponents: 1,
      totalDependencies: 1,
      componentsByType: {
        ApexClass: 1,
      },
      maxDepth: 1,
      mostDepended: {
        nodeId: 'CustomField:Account.External_Id__c',
        count: 1,
      },
      mostDependencies: {
        nodeId,
        count: 1,
      },
    },
  };
}
