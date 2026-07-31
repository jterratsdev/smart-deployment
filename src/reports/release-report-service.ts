import type { ReleaseReportFacts, ReleaseReportV1 } from '../types/release-report.js';
import { ReleaseReportBuilder } from './release-report-builder.js';
import { sanitizeReleaseReport, type ReleaseReportSanitizerOptions } from './release-report-sanitizer.js';
import { ReleaseReportStore, type ReleaseReportStoreOptions } from './release-report-store.js';

export type UnderlyingOperationResult<T> = { kind: 'succeeded'; value: T } | { kind: 'failed'; error: unknown };

export type ReleaseReportFailureStage = 'build' | 'sanitize' | 'serialize' | 'persist';

export type ReleaseReportFinalization =
  | { kind: 'written'; report: ReleaseReportV1; path: string }
  | {
      kind: 'unavailable';
      stage: ReleaseReportFailureStage;
      warning: string;
      report?: ReleaseReportV1;
    };

export type ReleaseReportServiceResult<T> = {
  underlying: UnderlyingOperationResult<T>;
  report: ReleaseReportFinalization;
};

export type ReleaseReportServiceOptions = ReleaseReportStoreOptions & ReleaseReportSanitizerOptions;

export type ReleaseReportServiceDependencies = {
  build: (facts: ReleaseReportFacts) => ReleaseReportV1;
  sanitize: (report: ReleaseReportV1, options: ReleaseReportSanitizerOptions) => ReleaseReportV1;
  serialize: (report: ReleaseReportV1) => string;
  store: (
    serializedReport: string,
    options: ReleaseReportStoreOptions
  ) => Promise<{ kind: 'written'; path: string } | { kind: 'unavailable'; warning: string }>;
};

export class ReleaseReportService {
  private readonly dependencies: ReleaseReportServiceDependencies;

  public constructor(dependencies?: Partial<ReleaseReportServiceDependencies>) {
    const builder = new ReleaseReportBuilder();
    const store = new ReleaseReportStore();
    this.dependencies = {
      build: (facts): ReleaseReportV1 => builder.build(facts),
      sanitize: sanitizeReleaseReport,
      serialize: serializeReleaseReport,
      store: async (serializedReport, options): ReturnType<ReleaseReportStore['write']> =>
        store.write(serializedReport, options),
      ...dependencies,
    };
  }

  public async finalize<T>(
    underlying: UnderlyingOperationResult<T>,
    facts: ReleaseReportFacts,
    options: ReleaseReportServiceOptions
  ): Promise<ReleaseReportServiceResult<T>> {
    const built = attempt('build', () => this.dependencies.build(facts));
    if (built.kind === 'unavailable') return { underlying, report: built };

    const sanitized = attempt('sanitize', () => this.dependencies.sanitize(built.report, options));
    if (sanitized.kind === 'unavailable') return { underlying, report: sanitized };

    const serialized = attemptSerialization(() => this.dependencies.serialize(sanitized.report), sanitized.report);
    if (serialized.kind === 'unavailable') return { underlying, report: serialized };

    try {
      const persistence = await this.dependencies.store(serialized.content, options);
      if (persistence.kind === 'unavailable') {
        return {
          underlying,
          report: {
            kind: 'unavailable',
            stage: 'persist',
            warning: persistence.warning,
            report: sanitized.report,
          },
        };
      }

      return {
        underlying,
        report: { kind: 'written', report: sanitized.report, path: persistence.path },
      };
    } catch {
      return {
        underlying,
        report: {
          kind: 'unavailable',
          stage: 'persist',
          warning: warningFor('persist'),
          report: sanitized.report,
        },
      };
    }
  }
}

function attempt(
  stage: 'build' | 'sanitize',
  operation: () => ReleaseReportV1
):
  | { kind: 'available'; report: ReleaseReportV1 }
  | { kind: 'unavailable'; stage: 'build' | 'sanitize'; warning: string } {
  try {
    return { kind: 'available', report: operation() };
  } catch {
    return { kind: 'unavailable', stage, warning: warningFor(stage) };
  }
}

function attemptSerialization(
  operation: () => string,
  report: ReleaseReportV1
):
  | { kind: 'serialized'; content: string }
  | { kind: 'unavailable'; stage: 'serialize'; warning: string; report: ReleaseReportV1 } {
  try {
    return { kind: 'serialized', content: operation() };
  } catch {
    return { kind: 'unavailable', stage: 'serialize', warning: warningFor('serialize'), report };
  }
}

function serializeReleaseReport(report: ReleaseReportV1): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function warningFor(stage: ReleaseReportFailureStage): string {
  return `Release report ${stage} is unavailable; the underlying operation result is unchanged.`;
}
