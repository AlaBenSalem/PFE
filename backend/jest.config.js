/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/utils/logger.js'],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000,
};
