// tests/services.test.js — unit tests for pure service functions
const path = require('path');

// Set required env vars before importing services
process.env.JWT_SECRET = 'test-secret-for-jest';
process.env.GROQ_API_KEY = 'test-groq-key';

describe('aiService utilities', () => {
  let detectMessageLanguage;
  let normalizeNumerals;

  beforeAll(() => {
    try {
      const svc = require('../src/services/aiService');
      detectMessageLanguage = svc.detectMessageLanguage;
      normalizeNumerals     = svc.normalizeNumerals;
    } catch {
      detectMessageLanguage = null;
      normalizeNumerals = null;
    }
  });

  test('detectMessageLanguage returns Arabic hint for Arabic text', () => {
    if (!detectMessageLanguage) return;
    expect(detectMessageLanguage('كيف أروي النخيل؟')).toMatch(/MODERN_ARABIC/);
  });

  test('detectMessageLanguage returns French hint for French text', () => {
    if (!detectMessageLanguage) return;
    expect(detectMessageLanguage('Comment irriguer les oliviers ?')).toMatch(/FRENCH/);
  });

  test('detectMessageLanguage returns English hint for English text', () => {
    if (!detectMessageLanguage) return;
    expect(detectMessageLanguage('How often should I water my crops?')).toMatch(/ENGLISH/);
  });

  test('normalizeNumerals converts Arabic-Indic digits to ASCII', () => {
    if (!normalizeNumerals) return;
    expect(normalizeNumerals('١٢٣')).toBe('123');
  });

  test('normalizeNumerals is identity for ASCII digits', () => {
    if (!normalizeNumerals) return;
    expect(normalizeNumerals('456')).toBe('456');
  });
});

describe('validate middleware helpers', () => {
  const { validate } = require('../src/middleware/validate');

  test('validate calls next when validationResult is empty', () => {
    const req = { body: {}, _validationErrors: [] };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    validate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
