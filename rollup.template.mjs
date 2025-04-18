import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import cleaner from "rollup-plugin-cleaner";
//import terser from "@rollup/plugin-terser";

function configure(esm, external) {
  return {
    input: "src/index.ts",
    output: esm
      ? {
          format: "es",
          dir: "lib",
          entryFileNames: "[name].mjs",
          sourcemap: true,
        }
      : {
          format: "cjs",
          dir: "lib",
          entryFileNames: "[name].js",
          sourcemap: true,
          exports: "auto",
        },
    external: external,
    plugins: esm
      ? [
          typescript({
            exclude: ["**/__tests__", "**/*.test.ts"],
          }),
          commonjs(),
        ]
      : [
          cleaner({ targets: ["./lib"] }),
          typescript({
            exclude: ["**/__tests__", "**/*.test.ts"],
          }),
          commonjs(),
          //terser(),
        ],
  };
}
function setExternal(external) {
  return [configure(false, external), configure(true, external)];
}
export default setExternal;
