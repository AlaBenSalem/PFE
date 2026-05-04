// tests/validate.test.js — unit tests for validation middleware
const {
  registerValidators,
  loginValidators,
  forgotPasswordValidators,
  resetPasswordValidators,
  cultureValidators,
  validate,
} = require('../src/middleware/validate');

const { validationResult } = require('express-validator');

async function runValidators(validators, body) {
  const req = { body, params: {}, query: {}, headers: {} };
  const res = {};
  for (const validator of validators) {
    await validator(req, res, () => {});
  }
  return validationResult(req);
}

describe('registerValidators', () => {
  test('passes with valid data', async () => {
    const result = await runValidators(registerValidators, {
      firstName: 'Ali',
      lastName: 'Ben Ahmed',
      address: '12 Rue Habib Bourguiba',
      email: 'ali@example.com',
      password: 'secret123',
    });
    expect(result.isEmpty()).toBe(true);
  });

  test('fails with short password', async () => {
    const result = await runValidators(registerValidators, {
      firstName: 'Ali',
      lastName: 'Ben Ahmed',
      address: '12 Rue Habib Bourguiba',
      email: 'ali@example.com',
      password: '123',
    });
    expect(result.isEmpty()).toBe(false);
    expect(result.array().some(e => e.path === 'password')).toBe(true);
  });

  test('fails with invalid email', async () => {
    const result = await runValidators(registerValidators, {
      firstName: 'Ali',
      lastName: 'Ben Ahmed',
      address: '12 Rue Habib Bourguiba',
      email: 'not-an-email',
      password: 'secret123',
    });
    expect(result.isEmpty()).toBe(false);
    expect(result.array().some(e => e.path === 'email')).toBe(true);
  });

  test('fails with short firstName', async () => {
    const result = await runValidators(registerValidators, {
      firstName: 'A',
      lastName: 'Ben Ahmed',
      address: '12 Rue Habib Bourguiba',
      email: 'ali@example.com',
      password: 'secret123',
    });
    expect(result.isEmpty()).toBe(false);
    expect(result.array().some(e => e.path === 'firstName')).toBe(true);
  });
});

describe('loginValidators', () => {
  test('passes with valid credentials', async () => {
    const result = await runValidators(loginValidators, {
      email: 'ali@example.com',
      password: 'anypassword',
    });
    expect(result.isEmpty()).toBe(true);
  });

  test('fails with missing password', async () => {
    const result = await runValidators(loginValidators, {
      email: 'ali@example.com',
      password: '',
    });
    expect(result.isEmpty()).toBe(false);
  });
});

describe('forgotPasswordValidators', () => {
  test('passes with valid email', async () => {
    const result = await runValidators(forgotPasswordValidators, {
      email: 'ali@example.com',
    });
    expect(result.isEmpty()).toBe(true);
  });

  test('fails with invalid email', async () => {
    const result = await runValidators(forgotPasswordValidators, { email: 'bad' });
    expect(result.isEmpty()).toBe(false);
  });
});

describe('cultureValidators', () => {
  test('passes with valid culture data', async () => {
    const result = await runValidators(cultureValidators, {
      nom: 'Olivier',
      surface: '2.5',
    });
    expect(result.isEmpty()).toBe(true);
  });

  test('passes without optional fields', async () => {
    const result = await runValidators(cultureValidators, { nom: 'Blé' });
    expect(result.isEmpty()).toBe(true);
  });

  test('fails with empty nom', async () => {
    const result = await runValidators(cultureValidators, { nom: '' });
    expect(result.isEmpty()).toBe(false);
    expect(result.array().some(e => e.path === 'nom')).toBe(true);
  });

  test('fails with non-numeric surface', async () => {
    const result = await runValidators(cultureValidators, {
      nom: 'Olivier',
      surface: 'abc',
    });
    expect(result.isEmpty()).toBe(false);
  });
});

describe('validate middleware', () => {
  test('calls next() when no errors', async () => {
    const req = { body: {}, params: {}, query: {}, headers: {} };
    const res = {};
    const next = jest.fn();
    validate(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
