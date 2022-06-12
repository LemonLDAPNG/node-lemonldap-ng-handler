import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript"

function configure(esm) {
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
    external: ['fs', 'path'],
    plugins: [
      typescript(),
      commonjs(),
    ],
  }
}
export default [configure(false), configure(true)];
