"use strict";

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  collectCoverageFrom: [
    "../client/src/**/*.ts",
    "../domain/src/**/*.ts",
    "../web-service-app/src/web-server/express_web_server.ts"
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
