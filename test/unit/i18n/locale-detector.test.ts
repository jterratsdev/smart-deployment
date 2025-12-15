/**
 * @fileoverview Tests for LocaleDetector - US-108
 * @ac US-108-AC-1: Detect user's locale from environment
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { LocaleDetector } from '../../../src/i18n/locale-detector.js';

describe('LocaleDetector', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment variables
    delete process.env.LANG;
    delete process.env.LC_ALL;
    delete process.env.LANGUAGE;
  });

  afterEach(() => {
    // Restore original environment
    process.env.LANG = originalEnv.LANG;
    process.env.LC_ALL = originalEnv.LC_ALL;
    process.env.LANGUAGE = originalEnv.LANGUAGE;
  });

  describe('detect', () => {
    it('should detect locale from CLI flag', () => {
      const locale = LocaleDetector.detect({ cliFlag: 'es' });
      expect(locale).to.equal('es');
    });

    it('should detect locale from config', () => {
      const locale = LocaleDetector.detect({ config: { locale: 'fr' } });
      expect(locale).to.equal('fr');
    });

    it('should prioritize CLI flag over config', () => {
      const locale = LocaleDetector.detect({
        cliFlag: 'de',
        config: { locale: 'fr' },
      });
      expect(locale).to.equal('de');
    });

    it('should detect locale from LANG environment variable', () => {
      delete process.env.LC_ALL;
      delete process.env.LANGUAGE;
      process.env.LANG = 'es_ES.UTF-8';
      const locale = LocaleDetector.detect();
      expect(locale).to.equal('es');
    });

    it('should detect locale from LC_ALL environment variable', () => {
      delete process.env.LANG;
      delete process.env.LANGUAGE;
      process.env.LC_ALL = 'fr_FR.UTF-8';
      const locale = LocaleDetector.detect();
      expect(locale).to.equal('fr');
    });

    it('should detect locale from LANGUAGE environment variable', () => {
      delete process.env.LANG;
      delete process.env.LC_ALL;
      process.env.LANGUAGE = 'de_DE';
      const locale = LocaleDetector.detect();
      expect(locale).to.equal('de');
    });

    it('should prioritize LANG over LC_ALL', () => {
      // Set both, LANG should take priority
      delete process.env.LANGUAGE;
      process.env.LANG = 'pt_BR.UTF-8';
      process.env.LC_ALL = 'es_ES.UTF-8';

      const locale = LocaleDetector.detect();
      expect(locale).to.equal('pt');
    });

    it('should default to English if no locale detected', () => {
      delete process.env.LANG;
      delete process.env.LC_ALL;
      delete process.env.LANGUAGE;
      const locale = LocaleDetector.detect();
      expect(locale).to.equal('en');
    });

    it('should normalize locale codes (uppercase to lowercase)', () => {
      const locale = LocaleDetector.detect({ cliFlag: 'ES' });
      expect(locale).to.equal('es');
    });

    it('should extract language from locale with region (es_ES -> es)', () => {
      const locale = LocaleDetector.detect({ cliFlag: 'es_ES' });
      expect(locale).to.equal('es');
    });

    it('should extract language from locale with script (zh_Hans -> zh)', () => {
      // zh is not supported, should fall back
      const locale = LocaleDetector.detect({ cliFlag: 'zh_Hans' });
      expect(locale).to.equal('en'); // Falls back to default
    });

    it('should fall back to default for unsupported locales', () => {
      const locale = LocaleDetector.detect({ cliFlag: 'ru' });
      expect(locale).to.equal('en');
    });
  });

  describe('getSupportedLocales', () => {
    it('should return all supported locales', () => {
      const locales = LocaleDetector.getSupportedLocales();
      expect(locales).to.include.members(['en', 'es', 'fr', 'de', 'pt', 'ja']);
      expect(locales).to.have.length(6);
    });
  });

  describe('getLocaleDisplayName', () => {
    it('should return display name for English', () => {
      const name = LocaleDetector.getLocaleDisplayName('en');
      expect(name).to.equal('English');
    });

    it('should return display name for Spanish', () => {
      const name = LocaleDetector.getLocaleDisplayName('es');
      expect(name).to.equal('Español');
    });

    it('should return display name for French', () => {
      const name = LocaleDetector.getLocaleDisplayName('fr');
      expect(name).to.equal('Français');
    });

    it('should return display name for German', () => {
      const name = LocaleDetector.getLocaleDisplayName('de');
      expect(name).to.equal('Deutsch');
    });

    it('should return display name for Portuguese', () => {
      const name = LocaleDetector.getLocaleDisplayName('pt');
      expect(name).to.equal('Português');
    });

    it('should return display name for Japanese', () => {
      const name = LocaleDetector.getLocaleDisplayName('ja');
      expect(name).to.equal('日本語');
    });
  });
});
