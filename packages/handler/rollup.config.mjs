import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import cleaner from "rollup-plugin-cleaner";

const alwaysExt = [
  "@lemonldap-ng/conf",
  "@lemonldap-ng/jwt",
  "@lemonldap-ng/logger",
  "@lemonldap-ng/message-broker-nobroker",
  "@lemonldap-ng/session",
  "@lemonldap-ng/safelib",
  "crypto",
  "vm",
  "re2",
  "url",
  "http",
];

const commonPlugins = [typescript(), commonjs()];

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
    // normalize-url is a pure ES module
    external: esm ? [...alwaysExt, "normalize-url"] : alwaysExt,
    plugins: esm
      ? commonPlugins
      : [
          cleaner({ targets: ["./lib"] }),
          ...commonPlugins,
          nodeResolve({ preferBuiltins: true }),
          terser(),
        ],
  };
}
export default [configure(false), configure(true)];
