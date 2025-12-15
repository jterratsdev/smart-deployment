/**
 * Localized Error - US-108
 * Error wrapper that supports translation
 *
 * @ac US-108-AC-2: Translate error messages using Agentforce
 * @issue #108
 */

import { SmartDeploymentError } from '../errors/base-error.js';
import type { SupportedLocale } from './locale-detector.js';
import { TranslationService } from './translation-service.js';

export interface LocalizedErrorContext {
  originalMessage: string;
  translatedMessage?: string;
  locale?: SupportedLocale;
}

/**
 * Error that supports localization
 */
export class LocalizedError extends SmartDeploymentError {
  private readonly originalMessage: string;
  private translatedMessage?: string;
  private locale?: SupportedLocale;
  private translationService?: TranslationService;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    suggestions?: string[]
  ) {
    super(message, code, context, suggestions);
    this.originalMessage = message;
  }

  /**
   * Set translation service for this error
   */
  public setTranslationService(service: TranslationService): void {
    this.translationService = service;
  }

  /**
   * Localize error message
   */
  public async localize(locale: SupportedLocale): Promise<void> {
    if (locale === 'en' || !this.translationService) {
      this.locale = locale;
      return;
    }

    try {
      this.translatedMessage = await this.translationService.translate(this.originalMessage, locale, {
        preserveTechnicalTerms: true,
        context: `Error code: ${this.code}`,
      });

      // Note: suggestions is readonly, so we can't modify it directly
      // Translation of suggestions would need to be handled at display time

      this.locale = locale;
    } catch (error) {
      // Fallback to original message if translation fails
      logger.warn('Failed to localize error', {
        error: error instanceof Error ? error.message : String(error),
        locale,
        code: this.code,
      });
      this.locale = locale;
    }
  }

  /**
   * Get localized message
   */
  public getLocalizedMessage(): string {
    return this.translatedMessage || this.originalMessage;
  }

  /**
   * Override message getter to return localized version
   */
  public override get message(): string {
    return this.translatedMessage || this.originalMessage;
  }

  /**
   * Get original (English) message
   */
  public getOriginalMessage(): string {
    return this.originalMessage;
  }

  /**
   * Get current locale
   */
  public getLocale(): SupportedLocale | undefined {
    return this.locale;
  }

  /**
   * Convert to JSON with localization info
   */
  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      originalMessage: this.originalMessage,
      translatedMessage: this.translatedMessage,
      locale: this.locale || 'en',
    };
  }
}

// Import logger
import { getLogger } from '../utils/logger.js';
const logger = getLogger('LocalizedError');

