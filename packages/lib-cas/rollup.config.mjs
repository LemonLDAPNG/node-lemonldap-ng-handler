import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: [
    {
      file: "lib/index.cjs",
      format: "cjs",
      sourcemap: true,
    },
    {
      file: "lib/index.mjs",
      format: "es",
      sourcemap: true,
    },
  ],
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "./lib",
    }),
  ],
  external: [],
};
