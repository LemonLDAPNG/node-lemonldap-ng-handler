import commonjs from "@rollup/plugin-commonjs";
import {nodeResolve} from '@rollup/plugin-node-resolve';
import typescript from "@rollup/plugin-typescript";
import cleaner from 'rollup-plugin-cleaner'

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
    external: esm ? ['node-fetch'] : ['node:http', 'node:https', 'node:stream', 'node:zlib', 'node:buffer', 'node:util', 'node:url', 'node:net', 'node:fs', 'node:path'],
    plugins: esm
     ? [
         typescript(),
         commonjs(),
       ]
     : [
         cleaner({ targets: ['./lib']}),
         typescript(),
         commonjs(),
         nodeResolve(),
       ],
  }
}
export default [configure(false), configure(true)];
