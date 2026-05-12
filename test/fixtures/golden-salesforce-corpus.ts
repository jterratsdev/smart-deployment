import type { NodeId } from '../../src/types/dependency.js';
import type { MetadataComponent, MetadataDependencyReference, MetadataType } from '../../src/types/metadata.js';

export type GoldenSalesforceFixture = {
  id: string;
  intent: string;
  regressionRisk: string;
  components: MetadataComponent[];
  expected: {
    components: string[];
    dependencies: Array<{ from: NodeId; to: NodeId; kind: MetadataDependencyReference['kind'] }>;
    waves: string[][];
  };
};

export const GOLDEN_SALESFORCE_CORPUS: GoldenSalesforceFixture[] = [
  {
    id: 'apex-trigger-handler',
    intent: 'Trigger-handler deployment order keeps the object before handler code and trigger activation.',
    regressionRisk: 'A trigger can fail deployment when its handler or target object is ordered too late.',
    components: [
      component('CustomObject', 'Account'),
      component('ApexClass', 'AccountTriggerHandler', ['CustomObject:Account']),
      component('ApexTrigger', 'AccountTrigger', ['CustomObject:Account', 'ApexClass:AccountTriggerHandler']),
    ],
    expected: {
      components: ['ApexClass:AccountTriggerHandler', 'ApexTrigger:AccountTrigger', 'CustomObject:Account'],
      dependencies: [
        { from: 'ApexClass:AccountTriggerHandler', to: 'CustomObject:Account', kind: 'hard' },
        { from: 'ApexTrigger:AccountTrigger', to: 'ApexClass:AccountTriggerHandler', kind: 'hard' },
        { from: 'ApexTrigger:AccountTrigger', to: 'CustomObject:Account', kind: 'hard' },
      ],
      waves: [['CustomObject:Account'], ['ApexClass:AccountTriggerHandler'], ['ApexTrigger:AccountTrigger']],
    },
  },
  {
    id: 'lwc-to-apex',
    intent: 'Lightning bundle stays behind the Apex controller and the data model it calls.',
    regressionRisk: 'UI metadata can deploy before its Apex contract if code and bundle dependencies drift.',
    components: [
      component('CustomObject', 'Account'),
      component('ApexClass', 'AccountController', ['CustomObject:Account']),
      component('LightningComponentBundle', 'accountPanel', ['ApexClass:AccountController']),
    ],
    expected: {
      components: ['ApexClass:AccountController', 'CustomObject:Account', 'LightningComponentBundle:accountPanel'],
      dependencies: [
        { from: 'ApexClass:AccountController', to: 'CustomObject:Account', kind: 'hard' },
        { from: 'LightningComponentBundle:accountPanel', to: 'ApexClass:AccountController', kind: 'hard' },
      ],
      waves: [['CustomObject:Account'], ['ApexClass:AccountController'], ['LightningComponentBundle:accountPanel']],
    },
  },
  {
    id: 'flow-subflow-action',
    intent: 'A flow using a subflow and invocable Apex deploys after both callable dependencies.',
    regressionRisk: 'Automation can be activated before subflows or invocable actions are available.',
    components: [
      component('CustomObject', 'Account'),
      component('ApexClass', 'NormalizeAccountAction', ['CustomObject:Account']),
      component('Flow', 'Subflow_UpdateAccount', ['CustomObject:Account']),
      component('Flow', 'Main_Account_Onboarding', ['Flow:Subflow_UpdateAccount', 'ApexClass:NormalizeAccountAction']),
    ],
    expected: {
      components: [
        'ApexClass:NormalizeAccountAction',
        'CustomObject:Account',
        'Flow:Main_Account_Onboarding',
        'Flow:Subflow_UpdateAccount',
      ],
      dependencies: [
        { from: 'ApexClass:NormalizeAccountAction', to: 'CustomObject:Account', kind: 'hard' },
        { from: 'Flow:Main_Account_Onboarding', to: 'ApexClass:NormalizeAccountAction', kind: 'hard' },
        { from: 'Flow:Main_Account_Onboarding', to: 'Flow:Subflow_UpdateAccount', kind: 'hard' },
        { from: 'Flow:Subflow_UpdateAccount', to: 'CustomObject:Account', kind: 'hard' },
      ],
      waves: [
        ['CustomObject:Account'],
        ['ApexClass:NormalizeAccountAction', 'Flow:Subflow_UpdateAccount'],
        ['Flow:Main_Account_Onboarding'],
      ],
    },
  },
  {
    id: 'permission-profile-field-access',
    intent: 'Security metadata follows the object and field definitions it grants access to.',
    regressionRisk: 'Permission assignments can reference fields that are not deployed yet.',
    components: [
      component('CustomObject', 'Invoice__c'),
      component('CustomField', 'Invoice__c.Amount__c', ['CustomObject:Invoice__c']),
      component('PermissionSet', 'InvoiceUser', ['CustomField:Invoice__c.Amount__c']),
      component('Profile', 'SalesProfile', ['CustomField:Invoice__c.Amount__c']),
    ],
    expected: {
      components: [
        'CustomField:Invoice__c.Amount__c',
        'CustomObject:Invoice__c',
        'PermissionSet:InvoiceUser',
        'Profile:SalesProfile',
      ],
      dependencies: [
        { from: 'CustomField:Invoice__c.Amount__c', to: 'CustomObject:Invoice__c', kind: 'hard' },
        { from: 'PermissionSet:InvoiceUser', to: 'CustomField:Invoice__c.Amount__c', kind: 'hard' },
        { from: 'Profile:SalesProfile', to: 'CustomField:Invoice__c.Amount__c', kind: 'hard' },
      ],
      waves: [
        ['CustomObject:Invoice__c'],
        ['CustomField:Invoice__c.Amount__c'],
        ['PermissionSet:InvoiceUser', 'Profile:SalesProfile'],
      ],
    },
  },
  {
    id: 'custom-object-relationships',
    intent: 'Lookup relationship fields deploy after both source and target objects.',
    regressionRisk: 'Cross-object fields can fail when either related object is missing.',
    components: [
      component('CustomObject', 'Account'),
      component('CustomObject', 'Invoice__c'),
      component('CustomField', 'Invoice__c.Account__c', ['CustomObject:Invoice__c', 'CustomObject:Account']),
    ],
    expected: {
      components: ['CustomField:Invoice__c.Account__c', 'CustomObject:Account', 'CustomObject:Invoice__c'],
      dependencies: [
        { from: 'CustomField:Invoice__c.Account__c', to: 'CustomObject:Account', kind: 'hard' },
        { from: 'CustomField:Invoice__c.Account__c', to: 'CustomObject:Invoice__c', kind: 'hard' },
      ],
      waves: [['CustomObject:Account', 'CustomObject:Invoice__c'], ['CustomField:Invoice__c.Account__c']],
    },
  },
  {
    id: 'email-template-visualforce',
    intent: 'Email templates that render Visualforce content deploy after their page and controller.',
    regressionRisk: 'Template deployment can fail when the page/controller rendering contract is missing.',
    components: [
      component('ApexClass', 'InvoiceEmailController'),
      component('VisualforcePage', 'InvoiceEmailPage', ['ApexClass:InvoiceEmailController']),
      component('EmailTemplate', 'Invoice_Ready', ['VisualforcePage:InvoiceEmailPage']),
    ],
    expected: {
      components: [
        'ApexClass:InvoiceEmailController',
        'EmailTemplate:Invoice_Ready',
        'VisualforcePage:InvoiceEmailPage',
      ],
      dependencies: [
        { from: 'EmailTemplate:Invoice_Ready', to: 'VisualforcePage:InvoiceEmailPage', kind: 'hard' },
        { from: 'VisualforcePage:InvoiceEmailPage', to: 'ApexClass:InvoiceEmailController', kind: 'hard' },
      ],
      waves: [
        ['ApexClass:InvoiceEmailController'],
        ['VisualforcePage:InvoiceEmailPage'],
        ['EmailTemplate:Invoice_Ready'],
      ],
    },
  },
];

function component(type: MetadataType, name: string, dependencies: NodeId[] = []): MetadataComponent {
  return {
    type,
    name,
    filePath: `force-app/main/default/${type}/${name}.xml`,
    dependencies: new Set(dependencies),
    dependencyDetails: dependencies.map((nodeId) => ({
      nodeId,
      kind: 'hard',
      source: 'parser',
      reason: `${type}:${name} references ${nodeId}`,
    })),
    dependents: new Set(),
    priorityBoost: 0,
  };
}
