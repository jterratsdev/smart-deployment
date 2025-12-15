/**
 * @fileoverview Tests for TranslationService - US-108
 * @ac US-108-AC-2: Translate error messages using Agentforce
 * @ac US-108-AC-3: Cache translations
 * @ac US-108-AC-4: Preserve technical terms
 * @ac US-108-AC-5: Fall back to English if translation fails
 * @ac US-108-AC-6: Support at least 5 languages
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon, { SinonStub } from 'sinon';
import { TranslationService } from '../../../src/i18n/translation-service.js';
import { AgentforceService } from '../../../src/ai/agentforce-service.js';
import { getCacheManager } from '../../../src/utils/cache-manager.js';

describe('TranslationService', () => {
  let translationService: TranslationService;
  let agentforceService: AgentforceService;
  let cacheManager: ReturnType<typeof getCacheManager>;
  let sendRequestStub: SinonStub;

  beforeEach(() => {
    agentforceService = new AgentforceService({ enabled: true });
    translationService = new TranslationService(agentforceService);
    cacheManager = getCacheManager();

    // Stub Agentforce sendRequest
    sendRequestStub = sinon.stub(agentforceService, 'sendRequest').resolves({
      content: 'Mensaje traducido',
      tokensUsed: 100,
      model: 'agentforce-1',
      executionTime: 500,
    });

    // Clear cache
    cacheManager.clear();
  });

  afterEach(() => {
    sinon.restore();
    cacheManager.clear();
  });

  describe('translate', () => {
    it('should return original message for English locale', async () => {
      const result = await translationService.translate('Test message', 'en');
      expect(result).to.equal('Test message');
      expect(sendRequestStub.called).to.be.false;
    });

    it('should translate message for non-English locale', async () => {
      const result = await translationService.translate('Test message', 'es');
      expect(result).to.equal('Mensaje traducido');
      expect(sendRequestStub.called).to.be.true;
    });

    it('should cache translations', async () => {
      // First translation
      await translationService.translate('Test message', 'es');
      expect(sendRequestStub.callCount).to.equal(1);

      // Second translation (should use cache)
      const result = await translationService.translate('Test message', 'es');
      expect(result).to.equal('Mensaje traducido');
      expect(sendRequestStub.callCount).to.equal(1); // Still 1, cache used
    });

    it('should preserve technical terms when preserveTechnicalTerms is true', async () => {
      await translationService.translate('CustomObject Account is missing', 'es', {
        preserveTechnicalTerms: true,
      });

      const prompt = sendRequestStub.firstCall.args[0].prompt;
      expect(prompt).to.include('Preserve technical terms');
      expect(prompt).to.include('CustomObject');
    });

    it('should include context in translation prompt', async () => {
      await translationService.translate('Error message', 'es', {
        context: 'Deployment error',
      });

      const prompt = sendRequestStub.firstCall.args[0].prompt;
      expect(prompt).to.include('Context: Deployment error');
    });

    it('should fall back to English if translation fails', async () => {
      sendRequestStub.rejects(new Error('Translation failed'));

      const result = await translationService.translate('Test message', 'es');
      expect(result).to.equal('Test message'); // Falls back to original
    });

    it('should support Spanish locale', async () => {
      const result = await translationService.translate('Test', 'es');
      expect(result).to.be.a('string');
    });

    it('should support French locale', async () => {
      sendRequestStub.resolves({
        content: 'Message traduit',
        tokensUsed: 100,
        model: 'agentforce-1',
        executionTime: 500,
      });

      const result = await translationService.translate('Test', 'fr');
      expect(result).to.equal('Message traduit');
    });

    it('should support German locale', async () => {
      sendRequestStub.resolves({
        content: 'Übersetzte Nachricht',
        tokensUsed: 100,
        model: 'agentforce-1',
        executionTime: 500,
      });

      const result = await translationService.translate('Test', 'de');
      expect(result).to.equal('Übersetzte Nachricht');
    });

    it('should support Portuguese locale', async () => {
      sendRequestStub.resolves({
        content: 'Mensagem traduzida',
        tokensUsed: 100,
        model: 'agentforce-1',
        executionTime: 500,
      });

      const result = await translationService.translate('Test', 'pt');
      expect(result).to.equal('Mensagem traduzida');
    });

    it('should support Japanese locale', async () => {
      sendRequestStub.resolves({
        content: '翻訳されたメッセージ',
        tokensUsed: 100,
        model: 'agentforce-1',
        executionTime: 500,
      });

      const result = await translationService.translate('Test', 'ja');
      expect(result).to.equal('翻訳されたメッセージ');
    });
  });

  describe('translateBatch', () => {
    it('should translate multiple messages', async () => {
      sendRequestStub.resolves({
        content: 'Traducido',
        tokensUsed: 100,
        model: 'agentforce-1',
        executionTime: 500,
      });

      const results = await translationService.translateBatch(['Message 1', 'Message 2'], 'es');
      expect(results).to.have.length(2);
      expect(sendRequestStub.callCount).to.equal(2);
    });

    it('should use cache for batch translations', async () => {
      // First batch
      await translationService.translateBatch(['Message 1', 'Message 2'], 'es');
      expect(sendRequestStub.callCount).to.equal(2);

      // Second batch (should use cache)
      await translationService.translateBatch(['Message 1', 'Message 2'], 'es');
      expect(sendRequestStub.callCount).to.equal(2); // Still 2, cache used
    });

    it('should return original messages if batch translation fails', async () => {
      sendRequestStub.rejects(new Error('Translation failed'));

      const results = await translationService.translateBatch(['Message 1', 'Message 2'], 'es');
      expect(results).to.deep.equal(['Message 1', 'Message 2']);
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific locale', async () => {
      await translationService.translate('Test', 'es');
      await translationService.translate('Test', 'fr');

      await translationService.clearCache('es');

      // Spanish translation should be cleared, French should still be cached
      sendRequestStub.resetHistory();
      await translationService.translate('Test', 'es');
      expect(sendRequestStub.called).to.be.true; // Had to retranslate

      sendRequestStub.resetHistory();
      await translationService.translate('Test', 'fr');
      expect(sendRequestStub.called).to.be.false; // Still cached
    });

    it('should clear all cache if no locale specified', async () => {
      await translationService.translate('Test', 'es');
      await translationService.translate('Test', 'fr');

      await translationService.clearCache();

      // Both should need retranslation
      sendRequestStub.resetHistory();
      await translationService.translate('Test', 'es');
      await translationService.translate('Test', 'fr');
      expect(sendRequestStub.callCount).to.equal(2);
    });
  });
});
