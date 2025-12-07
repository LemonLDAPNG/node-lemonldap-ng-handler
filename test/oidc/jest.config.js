/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/*.test.ts"],
  testTimeout: 30000,
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverage: false,
  moduleNameMapper: {
    "^@lemonldap-ng/(.*)$": "<rootDir>/../../packages/$1/src",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
};
