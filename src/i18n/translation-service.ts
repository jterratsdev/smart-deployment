/**
 * Translation Service - US-108
 * Translates messages using Agentforce AI
 *
 * @ac US-108-AC-2: Translate error messages using Agentforce
 * @ac US-108-AC-3: Cache translations
 * @ac US-108-AC-4: Preserve technical terms
 * @ac US-108-AC-5: Fall back to English if translation fails
 * @ac US-108-AC-6: Support at least 5 languages
 * @issue #108
 */

import { getLogger } from '../utils/logger.js';
import { getCacheManager, type CacheManager } from '../utils/cache-manager.js';
import { AgentforceService } from '../ai/agentforce-service.js';
import type { SupportedLocale } from './locale-detector.js';
import { createHash } from 'node:crypto';

const logger = getLogger('TranslationService');

export interface TranslationOptions {
  preserveTechnicalTerms?: boolean;
  context?: string;
}

/**
 * @ac US-108-AC-2: Translate error messages using Agentforce
 */
export class TranslationService {
  private readonly cacheManager: CacheManager;
  private readonly agentforceService: AgentforceService;
  private readonly cachePrefix = 'i18n:translation';
  private readonly cacheTTL = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(agentforceService?: AgentforceService) {
    this.cacheManager = getCacheManager();
    this.agentforceService = agentforceService || new AgentforceService({ enabled: true });
  }

  /**
   * Translate a message to target locale
   */
  public async translate(
    message: string,
    targetLocale: SupportedLocale,
    options: TranslationOptions = {}
  ): Promise<string> {
    // Skip translation if target is English
    if (targetLocale === 'en') {
      return message;
    }

    // Check cache first
    const cacheKey = this.getCacheKey(message, targetLocale);
    const cached = await this.cacheManager.get<string>(cacheKey);
    if (cached) {
      logger.debug('Translation cache hit', { targetLocale, cacheKey });
      return cached;
    }

    try {
      // Translate using Agentforce
      const translated = await this.translateWithAgentforce(message, targetLocale, options);

      // Cache the translation
      await this.cacheManager.set(cacheKey, translated, this.cacheTTL);

      logger.debug('Translation completed and cached', { targetLocale, cacheKey });
      return translated;
    } catch (error) {
      logger.warn('Translation failed, falling back to English', {
        error: error instanceof Error ? error.message : String(error),
        targetLocale,
      });
      // @ac US-108-AC-5: Fall back to English if translation fails
      return message;
    }
  }

  /**
   * Translate multiple messages in batch
   */
  public async translateBatch(
    messages: string[],
    targetLocale: SupportedLocale,
    options: TranslationOptions = {}
  ): Promise<string[]> {
    if (targetLocale === 'en') {
      return messages;
    }

    // Check cache for all messages
    const results: string[] = [];
    const uncachedMessages: Array<{ index: number; message: string }> = [];

    for (const [index, message] of messages.entries()) {
      const cacheKey = this.getCacheKey(message, targetLocale);
      const cached = await this.cacheManager.get<string>(cacheKey);
      if (cached) {
        results[index] = cached;
      } else {
        uncachedMessages.push({ index, message });
      }
    }

    // Translate uncached messages
    if (uncachedMessages.length > 0) {
      try {
        const translations = await Promise.all(
          uncachedMessages.map((item) => this.translateWithAgentforce(item.message, targetLocale, options))
        );

        // Cache and store translations
        for (const [i, item] of uncachedMessages.entries()) {
          const translation = translations[i];
          const cacheKey = this.getCacheKey(item.message, targetLocale);
          await this.cacheManager.set(cacheKey, translation, this.cacheTTL);
          results[item.index] = translation;
        }
      } catch (error) {
        logger.warn('Batch translation failed, falling back to English', {
          error: error instanceof Error ? error.message : String(error),
          targetLocale,
        });
        // Fill remaining with original messages
        for (const item of uncachedMessages) {
          if (!results[item.index]) {
            results[item.index] = messages[item.index];
          }
        }
      }
    }

    return results;
  }

  /**
   * Translate using Agentforce AI
   */
  private async translateWithAgentforce(
    message: string,
    targetLocale: SupportedLocale,
    options: TranslationOptions
  ): Promise<string> {
    const preserveTerms = options.preserveTechnicalTerms !== false;

    const prompt = this.buildTranslationPrompt(message, targetLocale, preserveTerms, options.context);

    try {
      // Check if Agentforce is enabled
      if (!this.agentforceService.isEnabled()) {
        logger.debug('Agentforce disabled, skipping translation');
        return message;
      }

      // Get model from config
      const config = this.agentforceService.getConfig();
      const model = config.model || 'agentforce-1';

      const response = await this.agentforceService.sendRequest({
        model,
        prompt,
        maxTokens: 500,
        temperature: 0.3, // Low temperature for consistent translations
      });

      // Extract translation from response
      const translation = this.extractTranslation(response.content);

      return translation || message; // Fallback to original if extraction fails
    } catch (error) {
      // If Agentforce is disabled or fails, return original message
      logger.debug('Agentforce translation unavailable, using original message', {
        error: error instanceof Error ? error.message : String(error),
      });
      return message;
    }
  }

  /**
   * Build translation prompt for Agentforce
   */
  private buildTranslationPrompt(
    message: string,
    targetLocale: SupportedLocale,
    preserveTechnicalTerms: boolean,
    context?: string
  ): string {
    const localeNames: Record<SupportedLocale, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      pt: 'Portuguese',
      ja: 'Japanese',
    };

    let prompt = `Translate this Salesforce deployment message to ${localeNames[targetLocale]}.\n\n`;

    if (preserveTechnicalTerms) {
      prompt += `IMPORTANT: Preserve technical terms in English (e.g., CustomObject, ApexClass, CustomField__c, Account, etc.).\n`;
      prompt += `Only translate user-facing text, not Salesforce API names or metadata types.\n\n`;
    }

    if (context) {
      prompt += `Context: ${context}\n\n`;
    }

    prompt += `Message to translate:\n${message}\n\n`;
    prompt += `Translation (${localeNames[targetLocale]}):`;

    return prompt;
  }

  /**
   * Extract translation from Agentforce response
   */
  private extractTranslation(response: string): string | null {
    // Remove markdown code blocks if present
    let cleaned = response
      .replace(/```[\w]*\n?/g, '')
      .replace(/```/g, '')
      .trim();

    // Remove "Translation:" prefix if present
    cleaned = cleaned.replace(/^Translation:\s*/i, '').trim();

    // Return empty if response is too short or looks invalid
    if (cleaned.length < 3) {
      return null;
    }

    return cleaned;
  }

  /**
   * Generate cache key for message and locale
   */
  private getCacheKey(message: string, locale: SupportedLocale): string {
    const hash = createHash('sha256').update(message).digest('hex').substring(0, 16);
    return `${this.cachePrefix}:${locale}:${hash}`;
  }

  /**
   * Clear translation cache for a locale
   */
  public async clearCache(locale?: SupportedLocale): Promise<void> {
    const keys = this.cacheManager.keys();
    const prefix = locale ? `${this.cachePrefix}:${locale}:` : `${this.cachePrefix}:`;

    const keysToDelete = keys.filter((key: string) => key.startsWith(prefix));

    await Promise.all(keysToDelete.map((key: string) => this.cacheManager.delete(key)));

    logger.info('Translation cache cleared', { locale: locale || 'all', count: keysToDelete.length });
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<{ locale: SupportedLocale; count: number }[]> {
    // This would require cache manager to support pattern-based counting
    // For now, return empty array
    return [];
  }
}

