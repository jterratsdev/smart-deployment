import { SfCommand } from '@salesforce/sf-plugins-core';

export default class SmartDeployment extends SfCommand<void> {
  public static readonly summary = 'Explore Smart Deployment commands';
  public static readonly description = [
    'Commands:',
    '  start, analyze, validate, resume, status, config, init, impact, retrieve',
    '  metadata gaps, plan explain, graph export, ci preset, ci-publish',
    '',
    'Run sf smart-deployment <command> --help for command-specific flags.',
  ].join('\n');

  public async run(): Promise<void> {
    await this.config.runCommand('help', ['smart-deployment']);
  }
}
