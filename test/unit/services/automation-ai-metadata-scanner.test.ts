import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  parseAiEvaluationDefinitionComponent,
  parseBotComponent,
  parseFlowComponent,
  parseGenAiPromptComponent,
} from '../../../src/services/scanners/automation-ai-metadata-scanner.js';

describe('automation-ai-metadata-scanner helpers', () => {
  const tempDirectories: string[] = [];

  async function createFixture(): Promise<string> {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'automation-ai-metadata-scanner-'));
    tempDirectories.push(projectRoot);

    const baseDir = path.join(projectRoot, 'force-app', 'main', 'default');
    await Promise.all([
      mkdir(path.join(baseDir, 'flows'), { recursive: true }),
      mkdir(path.join(baseDir, 'bots'), { recursive: true }),
      mkdir(path.join(baseDir, 'genaiPromptTemplates'), { recursive: true }),
    ]);

    await writeFile(
      path.join(baseDir, 'flows', 'CaseOrchestrator.flow-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>AutoLaunchedFlow</processType>
  <actionCalls>
    <name>CallApexAction</name>
    <actionType>apex</actionType>
    <actionName>CaseActionRouter.route</actionName>
  </actionCalls>
  <subflows>
    <name>SummarizeCase</name>
    <flowName>CaseSummarySubflow</flowName>
  </subflows>
  <recordLookups>
    <name>GetCase</name>
    <object>Case</object>
  </recordLookups>
</Flow>`
    );

    await writeFile(
      path.join(baseDir, 'bots', 'SupportAssistant.bot-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
  <label>Support Assistant</label>
  <botVersions>
    <botDialogs>
      <developerName>Greeting</developerName>
      <label>Greeting</label>
      <botSteps>
        <type>Action</type>
        <botInvocation>
          <invocationActionName>CaseOrchestrator</invocationActionName>
          <invocationActionType>flow</invocationActionType>
        </botInvocation>
      </botSteps>
      <botSteps>
        <type>Action</type>
        <botInvocation>
          <invocationActionName>SupportPrompt</invocationActionName>
          <invocationActionType>prompt</invocationActionType>
        </botInvocation>
      </botSteps>
      <botSteps>
        <type>Action</type>
        <botInvocation>
          <invocationActionName>CaseActionRouter.route</invocationActionName>
          <invocationActionType>apex</invocationActionType>
        </botInvocation>
      </botSteps>
      <botSteps>
        <type>Lookup</type>
        <conversationRecordLookup>
          <SObjectType>Case</SObjectType>
        </conversationRecordLookup>
      </botSteps>
    </botDialogs>
  </botVersions>
</Bot>`
    );

    await writeFile(
      path.join(baseDir, 'genaiPromptTemplates', 'SupportPrompt.genAiPromptTemplate-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<GenAiPromptTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
  <developerName>SupportPrompt</developerName>
  <masterLabel>Support Prompt</masterLabel>
  <relatedEntity>Case</relatedEntity>
  <templateVersions>
    <content>Summarize {!Case.Subject} for {!Contact.Name}</content>
    <primaryModel>sfdc_ai__DefaultGPT4</primaryModel>
    <templateDataProviders>
      <apiName>CaseProvider</apiName>
      <object>Case</object>
      <fields>
        <apiName>Subject</apiName>
      </fields>
    </templateDataProviders>
  </templateVersions>
</GenAiPromptTemplate>`
    );

    return baseDir;
  }

  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map(async (dir) => rm(dir, { recursive: true, force: true })));
  });

  it('preserves Flow, Bot, and GenAI prompt component dependency mapping', async () => {
    const baseDir = await createFixture();

    const [flow, bot, prompt] = await Promise.all([
      parseFlowComponent(path.join(baseDir, 'flows', 'CaseOrchestrator.flow-meta.xml')),
      parseBotComponent(path.join(baseDir, 'bots', 'SupportAssistant.bot-meta.xml')),
      parseGenAiPromptComponent(
        path.join(baseDir, 'genaiPromptTemplates', 'SupportPrompt.genAiPromptTemplate-meta.xml')
      ),
    ]);

    expect(flow).to.exist;
    expect(bot).to.exist;
    expect(prompt).to.exist;

    expect(flow?.name).to.equal('CaseOrchestrator');
    expect([...flow!.dependencies]).to.deep.equal(['CaseActionRouter.route', 'CaseSummarySubflow']);

    expect(bot?.name).to.equal('SupportAssistant');
    expect([...bot!.dependencies]).to.include.members([
      'Flow:CaseOrchestrator',
      'ApexClass:CaseActionRouter.route',
      'GenAiPromptTemplate:SupportPrompt',
      'Case',
    ]);

    expect(prompt?.name).to.equal('SupportPrompt');
    expect([...prompt!.dependencies]).to.include.members(['Case', 'Contact']);
  });

  it('parses canonical AiEvaluationDefinition agent subjects as one hard Bot dependency', async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'automation-ai-evaluation-'));
    tempDirectories.push(projectRoot);
    const filePath = path.join(projectRoot, 'AgentQuality.aiEvaluationDefinition-meta.xml');
    await writeFile(
      filePath,
      `<?xml version="1.0" encoding="UTF-8"?>
<AiEvaluationDefinition xmlns="http://soap.sforce.com/2006/04/metadata">
  <name>NestedNameIsNotIdentity</name>
  <subjectName>SupportAgent</subjectName>
  <subjectType>AGENT</subjectType>
  <subjectVersion>v1</subjectVersion>
  <testCases>
    <expectations>
      <name>Topic_Is_Returns</name>
      <expectedValue>Returns</expectedValue>
    </expectations>
    <contextVariables>
      <name>CaseId</name>
      <value>500000000000001</value>
    </contextVariables>
  </testCases>
</AiEvaluationDefinition>`
    );

    const component = await parseAiEvaluationDefinitionComponent(filePath);

    expect(component).to.deep.include({
      name: 'AgentQuality',
      type: 'AiEvaluationDefinition',
      subjectName: 'SupportAgent',
      subjectType: 'AGENT',
      subjectVersion: 'v1',
    });
    expect([...component.dependencies]).to.deep.equal(['Bot:SupportAgent']);
    expect(component.dependencyDetails).to.deep.equal([
      {
        nodeId: 'Bot:SupportAgent',
        kind: 'hard',
        source: 'parser',
        reason: 'AiEvaluationDefinition subjectName identifies the evaluated Agentforce Bot.',
      },
    ]);
  });

  it('rejects malformed AiEvaluationDefinition roots and required subject fields', async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'automation-ai-evaluation-invalid-'));
    tempDirectories.push(projectRoot);
    const cases = [
      ['WrongRoot', '<WrongRoot><subjectName>SupportAgent</subjectName><subjectType>AGENT</subjectType></WrongRoot>'],
      [
        'MissingSubject',
        '<AiEvaluationDefinition><subjectName> </subjectName><subjectType>AGENT</subjectType></AiEvaluationDefinition>',
      ],
      [
        'MissingSubjectType',
        '<AiEvaluationDefinition><subjectName>SupportAgent</subjectName></AiEvaluationDefinition>',
      ],
      [
        'UnsupportedSubjectType',
        '<AiEvaluationDefinition><subjectName>SupportAgent</subjectName><subjectType>FLOW</subjectType></AiEvaluationDefinition>',
      ],
    ] as const;

    const errors: string[] = [];
    for (const [name, xml] of cases) {
      const filePath = path.join(projectRoot, `${name}.aiEvaluationDefinition-meta.xml`);
      await writeFile(filePath, xml);
      try {
        await parseAiEvaluationDefinitionComponent(filePath);
      } catch (error) {
        errors.push((error as Error).message);
      }
    }

    expect(errors).to.have.length(4);
    expect(errors[0]).to.include('Expected AiEvaluationDefinition root element.');
    expect(errors[1]).to.include('Missing required subjectName.');
    expect(errors[2]).to.include('Missing required subjectType.');
    expect(errors[3]).to.include('Unsupported subjectType "FLOW"; expected "AGENT".');
  });
});
