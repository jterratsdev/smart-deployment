export type StartPresenterIO = {
  log: (message: string) => void;
  warn: (message: string) => void;
};

export class StartCommandPresenter {
  public reportPostconditionPaused(
    io: Pick<StartPresenterIO, 'log'>,
    condition: import('../deployment/deployment-postcondition.js').PausedPostcondition
  ): void {
    io.log(`OWD_PROPAGATION_PENDING: ${condition.objectName}`);
    io.log(
      `Internal sharing model: expected=${condition.expectedInternalSharingModel}, observed=${
        condition.observedInternalSharingModel ?? 'unavailable'
      }`
    );
    io.log(
      `External sharing model: expected=${condition.expectedExternalSharingModel ?? 'unspecified'}, observed=${
        condition.observedExternalSharingModel ?? 'unavailable'
      }`
    );
    io.log(
      `Attempts=${condition.attempts}, waitedMs=${condition.waitedMs}, errorCategory=${
        condition.observationError?.category ?? 'none'
      }, resumedPhase=${condition.resumedPhase ?? 'not-resumed'}`
    );
  }

  public reportExecutionStart(io: Pick<StartPresenterIO, 'log'>): void {
    io.log('🚀 Executing deployment...');
  }

  public reportExecutionSkipped(io: Pick<StartPresenterIO, 'log'>, reason: 'dry-run' | 'validate-only'): void {
    if (reason === 'dry-run') {
      io.log('🔍 Dry-run mode: skipping actual deployment');
      return;
    }

    io.log('🔍 Validate-only mode: skipping actual deployment');
  }

  public reportReportGenerationStart(io: Pick<StartPresenterIO, 'log'>): void {
    io.log('📄 Generating deployment report...');
  }

  public reportAnalysisSummary(
    io: Pick<StartPresenterIO, 'log'>,
    options: {
      metadataCount: number;
      waves: number;
      aiEnabled: boolean;
    }
  ): void {
    io.log(`✅ Found ${options.metadataCount} metadata components`);
    io.log('🌊 Generating deployment waves...');
    io.log(`✅ Generated ${options.waves} waves`);

    if (options.aiEnabled) {
      io.log('🤖 AI-enhanced prioritization enabled');
    }
  }

  public reportDeploymentReport(io: Pick<StartPresenterIO, 'log'>, waves: number): void {
    io.log('\n📊 Deployment Report:');
    io.log(`   - Waves: ${waves}`);
    io.log('   - Status: Success');
  }

  public reportPlanReportsSaved(
    io: Pick<StartPresenterIO, 'log'>,
    paths: { jsonPath: string; htmlPath: string }
  ): void {
    io.log(`   - JSON report: ${paths.jsonPath}`);
    io.log(`   - HTML report: ${paths.htmlPath}`);
  }
}
