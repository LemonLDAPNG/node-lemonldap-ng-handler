module.export = {
  testTimeout: 100000,
  testEnvironment: "node",
  preset: "ts-jest",
  collectCoverage: true,
  collectCoverageFrom: ["./src/**/*.ts"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 50,
      lines: 90,
      statements: 90,
    },
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
