"use strict";

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  collectCoverageFrom: [
    "../packages/client/src/**/*.ts",
    "../packages/participants-svc/src/**/*.ts",
    "../packages/private-types-lib/src/**/*.ts",
    "../packages/public-types-lib/src/**/*.ts",
  ],
  coverageReporters: ["json", "lcov"],
  clearMocks: true,
  coverageThreshold: {
    "global": {
      "branches": 90,
      "functions": 90,
      "lines": 90,
      "statements": -10
    }
  }
}
