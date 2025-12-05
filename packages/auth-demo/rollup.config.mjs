import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import cleaner from "rollup-plugin-cleaner";

const alwaysExt = ["@lemonldap-ng/portal", "@lemonldap-ng/types", "express"];

const commonPlugins = [typescript(), commonjs()];

function configure(esm) {
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
          entryFileNames: "[name].cjs",
          sourcemap: true,
          exports: "auto",
        },
    external: alwaysExt,
    plugins: esm
      ? commonPlugins
      : [
          cleaner({ targets: ["./lib"] }),
          ...commonPlugins,
          nodeResolve(),
          terser(),
        ],
  };
}

export default [configure(false), configure(true)];
