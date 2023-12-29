module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	modulePathIgnorePatterns: ["dist"],
	globalSetup: "<rootDir>/tst/test-utilities/Setup.ts",
	globalTeardown: "<rootDir>/tst/test-utilities/Teardown.ts"
}