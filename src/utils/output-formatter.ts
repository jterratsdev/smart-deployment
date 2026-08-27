/**
 * Output Formatter
 * Provides organized, structured output for CLI commands
 */

import { SfCommand } from '@salesforce/sf-plugins-core';

export class OutputFormatter {
  private command: SfCommand<any>;

  constructor(command: SfCommand<any>) {
    this.command = command;
  }

  /**
   * Print a section header
   */
  section(title: string, icon = '📋'): void {
    this.command.log('');
    this.command.log(`${icon} ${title}`);
    this.command.log('');
  }

  /**
   * Print a subsection header
   */
  subsection(title: string, icon = '  →'): void {
    this.command.log(`${icon} ${title}`);
  }

  /**
   * Print a success message
   */
  success(message: string, details?: string[]): void {
    this.command.log(`   ✅ ${message}`);
    if (details) {
      for (const detail of details) {
        this.command.log(`      ${detail}`);
      }
    }
  }

  /**
   * Print a warning message
   */
  warning(message: string, details?: string[]): void {
    this.command.warn(`   ⚠️  ${message}`);
    if (details) {
      for (const detail of details) {
        this.command.warn(`      ${detail}`);
      }
    }
  }

  /**
   * Print an error message
   */
  error(message: string, details?: string[]): void {
    const formattedDetails = details?.map((detail) => `      ${detail}`).join('\n');
    this.command.error(formattedDetails ? `   ❌ ${message}\n${formattedDetails}` : `   ❌ ${message}`);
  }

  /**
   * Print an info message
   */
  info(message: string, details?: string[]): void {
    this.command.log(`   ℹ️  ${message}`);
    if (details) {
      for (const detail of details) {
        this.command.log(`      ${detail}`);
      }
    }
  }

  /**
   * Print a tip/suggestion
   */
  tip(message: string): void {
    this.command.log(`   💡 ${message}`);
  }

  /**
   * Print a key-value pair
   */
  keyValue(key: string, value: string | number, icon?: string): void {
    const iconStr = icon ? `${icon} ` : '';
    this.command.log(`   ${iconStr}${key}: ${value}`);
  }

  /**
   * Print a list of items
   */
  list(items: string[], icon = '   •'): void {
    items.forEach((item) => this.command.log(`${icon} ${item}`));
  }

  /**
   * Print a table-like structure
   */
  table(rows: Array<{ label: string; value: string | number }>): void {
    const maxLabelLength = Math.max(...rows.map((r) => r.label.length));
    rows.forEach((row) => {
      const padding = ' '.repeat(maxLabelLength - row.label.length);
      this.command.log(`   ${row.label}${padding} : ${row.value}`);
    });
  }

  /**
   * Print a progress indicator
   */
  progress(current: number, total: number, label?: string): void {
    const percentage = Math.round((current / total) * 100);
    const barLength = 20;
    const filled = Math.round((current / total) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    const labelStr = label ? ` ${label}` : '';
    this.command.log(`   [${bar}] ${percentage}% (${current}/${total})${labelStr}`);
  }

  /**
   * Print a separator line
   */
  separator(char = '─', length = 60): void {
    this.command.log('   ' + char.repeat(length));
  }

  /**
   * Print a blank line
   */
  blank(): void {
    this.command.log('');
  }

  /**
   * Print deployment wave header
   */
  waveHeader(waveNumber: number, totalWaves: number, componentCount: number): void {
    this.blank();
    this.command.log(`🌊 Wave ${waveNumber}/${totalWaves} (${componentCount} components)`);
    this.separator();
  }

  /**
   * Print deployment result summary
   */
  deploymentResult(result: {
    success: boolean;
    componentSuccesses: number;
    componentFailures: number;
    testsRun?: number;
    testFailures?: number;
  }): void {
    this.blank();
    if (result.success && result.componentFailures === 0) {
      this.success('Deployment completed successfully');
      this.keyValue('Components deployed', result.componentSuccesses, '📦');
      if (result.testsRun !== undefined) {
        this.keyValue('Tests run', result.testsRun, '🧪');
        if (result.testFailures !== undefined && result.testFailures > 0) {
          this.warning(`${result.testFailures} test(s) failed`);
        } else if (result.testsRun > 0) {
          this.success('All tests passed', []);
        }
      }
    } else {
      this.error('Deployment failed');
      if (result.componentFailures > 0) {
        this.keyValue('Component failures', result.componentFailures, '❌');
      }
      if (result.testFailures && result.testFailures > 0) {
        this.keyValue('Test failures', result.testFailures, '❌');
      }
    }
    this.blank();
  }

  /**
   * Print component failures in an organized way
   */
  componentFailures(
    failures: Array<{ componentId: string; error: string }>,
    type: 'error' | 'warning' = 'error'
  ): void {
    if (failures.length === 0) return;

    const icon = type === 'error' ? '❌' : '⚠️';
    const label = type === 'error' ? 'Component failures' : 'Warnings';

    this.command.log(`   ${icon} ${failures.length} ${label}:`);
    this.blank();

    failures.forEach((failure, index) => {
      this.command.log(`   ${index + 1}. ${failure.componentId}`);
      const errorLines = failure.error.split('\n');
      errorLines.forEach((line) => {
        this.command.log(`      ${line}`);
      });
      if (index < failures.length - 1) {
        this.blank();
      }
    });
  }

  /**
   * Print statistics in a formatted way
   */
  statistics(stats: Record<string, string | number>): void {
    this.blank();
    this.subsection('Statistics', '📊');
    this.table(Object.entries(stats).map(([key, value]) => ({ label: key, value })));
    this.blank();
  }
}
