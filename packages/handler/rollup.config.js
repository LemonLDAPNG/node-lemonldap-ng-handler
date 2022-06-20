import commonjs from "@rollup/plugin-commonjs";
import {nodeResolve} from '@rollup/plugin-node-resolve';
import typescript from "@rollup/plugin-typescript";
//import {terser} from "rollup-plugin-terser";

const alwaysExt = ['@LLNG/conf', '@LLNG/session', '@LLNG/safelib', 'vm', 're2', 'url'];

function configure(esm, external) {
  return {
    input: 'src/index.ts',
    output: esm
     ? { format: 'es', dir: 'lib', entryFileNames: '[name].mjs', sourcemap: true }
     : {
          format: 'cjs',
          dir: 'lib',
          entryFileNames: '[name].js',
          sourcemap: true,
          exports: "auto",
       },
    // normalize-url is a pure ES module
    external: esm ? [...alwaysExt, 'normalize-url'] : alwaysExt,
    plugins: esm
     ? [
         typescript(),
         commonjs(),
       ]
     : [
         typescript(),
         commonjs(),
         nodeResolve(),
         //terser(),
       ],
  }
}
export default [configure(false), configure(true)];
