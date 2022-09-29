"use strict"

const { name } = require("./package.json");
let packageName = name.replace("@mojaloop", "");

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  collectCoverageFrom: ["./src/**/*.ts"],
  coverageReporters: ["json", "lcov"],
  coverageDirectory: `./coverage/${packageName}/`,
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
