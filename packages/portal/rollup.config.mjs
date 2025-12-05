import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import cleaner from "rollup-plugin-cleaner";
import { cpSync, mkdirSync } from "fs";

const alwaysExt = [
  "@lemonldap-ng/conf",
  "@lemonldap-ng/crypto",
  "@lemonldap-ng/logger",
  "@lemonldap-ng/session",
  "@lemonldap-ng/types",
  "express",
  "cookie-parser",
  "nunjucks",
  "crypto",
  "path",
];

// Copy template files
function copyTemplates() {
  return {
    name: "copy-templates",
    buildEnd() {
      mkdirSync("lib/templates/views", { recursive: true });
      cpSync("src/templates/views", "lib/templates/views", { recursive: true });
    },
  };
}

const commonPlugins = [typescript(), commonjs(), copyTemplates()];

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
