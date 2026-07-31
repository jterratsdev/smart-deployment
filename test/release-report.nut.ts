import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  cleanupNutContexts,
  createNutContext,
  createSalesforceProject,
  execNutCommand,
  parseJsonStdout,
} from './helpers/nut-helpers.js';

type ValidateOutput = {
  success: boolean;
  releaseReport: {
    schemaVersion: string;
    outcome: string;
    analysisMode: string;
    summary: {
      total: number;
      succeeded: number;
    };
  };
  releaseReportPath: string;
};

describe('NUT: release report', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await cleanupNutContexts(tempDirs);
  });

  it('renders release-owner output and persists stable JSON without scraping logs', async () => {
    const { tempDir, homeDir } = await createNutContext('smart-deployment-release-report-');
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'release-report-project', {
      'force-app/main/default/classes/ReportFixture.cls': 'public class ReportFixture {}\n',
      'force-app/main/default/classes/ReportFixture.cls-meta.xml': [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <apiVersion>61.0</apiVersion>',
        '  <status>Active</status>',
        '</ApexClass>',
        '',
      ].join('\n'),
    });

    const human = execNutCommand(`validate --source-path ${projectRoot}`, homeDir);
    expect(human.shellOutput.stdout).to.include('Release report: succeeded');
    expect(human.shellOutput.stdout).to.include('Analysis mode: deterministic');
    expect(human.shellOutput.stdout).to.include('Items: 1 total, 1 succeeded');
    expect(human.shellOutput.stdout).to.include('Phase validation: validate via validation - succeeded');

    const jsonResult = execNutCommand<ValidateOutput>(`validate --source-path ${projectRoot} --json`, homeDir);
    const output = parseJsonStdout<ValidateOutput>(jsonResult.shellOutput.stdout);
    const persisted = JSON.parse(await readFile(output.releaseReportPath, 'utf8')) as ValidateOutput['releaseReport'];

    expect(output.success).to.equal(true);
    expect(output.releaseReport).to.deep.include({
      schemaVersion: '1.0',
      outcome: 'succeeded',
      analysisMode: 'deterministic',
    });
    expect(output.releaseReport.summary).to.deep.equal({
      total: 1,
      succeeded: 1,
      failed: 0,
      skipped: 0,
      needsReview: 0,
    });
    expect(output.releaseReportPath).to.equal(
      path.join(projectRoot, '.smart-deployment', 'reports', 'release-report.json')
    );
    expect(persisted).to.deep.equal(output.releaseReport);
  });
});
