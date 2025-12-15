/**
 * Locale Detector - US-108
 * Detects user's preferred locale from multiple sources
 *
 * @ac US-108-AC-1: Detect user's locale from environment
 * @issue #108
 */

import { env } from 'node:process';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('LocaleDetector');

export type SupportedLocale = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ja';

export interface LocaleConfig {
  locale?: SupportedLocale;
}

/**
 * @ac US-108-AC-1: Detect user's locale from environment
 * Detect locale from multiple sources (priority order):
 * 1. CLI flag (--locale)
 * 2. Config file (sfdx-project.json)
 * 3. Environment variables (LANG, LC_ALL)
 * 4. Default: 'en'
 */
export class LocaleDetector {
  private static readonly DEFAULT_LOCALE: SupportedLocale = 'en';
  private static readonly SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'es', 'fr', 'de', 'pt', 'ja'];

  /**
   * Detect locale from CLI flag, config, or environment
   */
  public static detect(options?: {
    cliFlag?: string;
    config?: LocaleConfig;
  }): SupportedLocale {
    // Priority 1: CLI flag
    if (options?.cliFlag) {
      const locale = this.normalizeLocale(options.cliFlag);
      if (this.isSupported(locale)) {
        logger.debug('Locale detected from CLI flag', { locale });
        return locale;
      }
      logger.warn('Unsupported locale in CLI flag, falling back', { locale: options.cliFlag });
    }

    // Priority 2: Config file
    if (options?.config?.locale) {
      const locale = this.normalizeLocale(options.config.locale);
      if (this.isSupported(locale)) {
        logger.debug('Locale detected from config', { locale });
        return locale;
      }
      logger.warn('Unsupported locale in config, falling back', { locale: options.config.locale });
    }

    // Priority 3: Environment variables
    const envLocale = this.detectFromEnvironment();
    if (envLocale) {
      logger.debug('Locale detected from environment', { locale: envLocale });
      return envLocale;
    }

    // Default: English
    logger.debug('Using default locale', { locale: this.DEFAULT_LOCALE });
    return this.DEFAULT_LOCALE;
  }

  /**
   * Detect locale from environment variables
   */
  private static detectFromEnvironment(): SupportedLocale | null {
    // Check LANG first (most common), then LC_ALL, then LANGUAGE
    const lang = env.LANG || env.LC_ALL || env.LANGUAGE;

    if (!lang) {
      return null;
    }

    // Extract language code from formats like:
    // - "es_ES.UTF-8" -> "es"
    // - "fr_FR" -> "fr"
    // - "de_DE.UTF-8" -> "de"
    const match = lang.match(/^([a-z]{2})/i);
    if (!match) {
      return null;
    }

    const locale = this.normalizeLocale(match[1]);
    return this.isSupported(locale) ? locale : null;
  }

  /**
   * Normalize locale code to lowercase
   */
  private static normalizeLocale(locale: string): string {
    return locale.toLowerCase().split('_')[0].split('-')[0];
  }

  /**
   * Check if locale is supported
   */
  private static isSupported(locale: string): locale is SupportedLocale {
    return this.SUPPORTED_LOCALES.includes(locale as SupportedLocale);
  }

  /**
   * Get all supported locales
   */
  public static getSupportedLocales(): SupportedLocale[] {
    return [...this.SUPPORTED_LOCALES];
  }

  /**
   * Get locale display name
   */
  public static getLocaleDisplayName(locale: SupportedLocale): string {
    const names: Record<SupportedLocale, string> = {
      en: 'English',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
      pt: 'Português',
      ja: '日本語',
    };
    return names[locale] || locale;
  }
}

