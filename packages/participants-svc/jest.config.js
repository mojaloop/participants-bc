"use strict";

const { name } = require("./package.json");
let packageName = name.replace("@mojaloop", "") || "unknown_package_name";

module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/test/unit/**/*.test.ts"],
    passWithNoTests: true,
    collectCoverage: true,
    collectCoverageFrom: ["./src/**/*.ts"],
    coveragePathIgnorePatterns: ["./src/tmp_files"],
    coverageReporters: ["text", ["json", {file: `../../../coverage/${packageName}-final.json`}]],
    clearMocks: true,
    setupFiles: ['./test/setup.js'], // Point to your setup file
    //TODO: Need to re-open *coverageThreshold after initial tests are merged
    /* coverageThreshold: {
        "global": {
            "branches": 90,
            "functions": 90,
            "lines": 90,
            "statements": -10
        }
    } */
}
