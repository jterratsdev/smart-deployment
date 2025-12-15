/**
 * i18n Service - US-108
 * Main service for internationalization
 *
 * @ac US-108-AC-1 to US-108-AC-6: All i18n requirements
 * @issue #108
 */

import { LocaleDetector, type SupportedLocale } from './locale-detector.js';
import { TranslationService } from './translation-service.js';
import { AgentforceService } from '../ai/agentforce-service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('I18nService');

export interface I18nConfig {
  locale?: SupportedLocale;
  agentforceService?: AgentforceService;
  autoTranslate?: boolean; // Auto-translate error/warning messages
}

/**
 * Main i18n service that coordinates locale detection and translation
 */
export class I18nService {
  private readonly locale: SupportedLocale;
  private readonly translationService: TranslationService;
  private readonly autoTranslate: boolean;

  constructor(config: I18nConfig = {}) {
    // Detect locale
    this.locale = LocaleDetector.detect({
      config: config.locale ? { locale: config.locale } : undefined,
    });

    // Initialize translation service
    this.translationService = new TranslationService(config.agentforceService);

    this.autoTranslate = config.autoTranslate ?? true;

    logger.info('i18n service initialized', { locale: this.locale });
  }

  /**
   * Get current locale
   */
  public getLocale(): SupportedLocale {
    return this.locale;
  }

  /**
   * Translate a message
   */
  public async translate(message: string, options?: { preserveTechnicalTerms?: boolean; context?: string }): Promise<string> {
    if (!this.autoTranslate || this.locale === 'en') {
      return message;
    }

    return this.translationService.translate(message, this.locale, {
      preserveTechnicalTerms: options?.preserveTechnicalTerms ?? true,
      context: options?.context,
    });
  }

  /**
   * Translate multiple messages
   */
  public async translateBatch(messages: string[], options?: { preserveTechnicalTerms?: boolean }): Promise<string[]> {
    if (!this.autoTranslate || this.locale === 'en') {
      return messages;
    }

    return this.translationService.translateBatch(messages, this.locale, {
      preserveTechnicalTerms: options?.preserveTechnicalTerms ?? true,
    });
  }

  /**
   * Get translation service (for advanced usage)
   */
  public getTranslationService(): TranslationService {
    return this.translationService;
  }

  /**
   * Clear translation cache
   */
  public async clearCache(locale?: SupportedLocale): Promise<void> {
    await this.translationService.clearCache(locale);
  }
}

/**
 * Global i18n service instance
 */
let globalI18nService: I18nService | null = null;

/**
 * Initialize global i18n service
 */
export function initializeI18n(config: I18nConfig = {}): void {
  globalI18nService = new I18nService(config);
  logger.info('Global i18n service initialized', { locale: globalI18nService.getLocale() });
}

/**
 * Get global i18n service instance
 */
export function getI18nService(): I18nService {
  if (!globalI18nService) {
    globalI18nService = new I18nService();
  }
  return globalI18nService;
}

