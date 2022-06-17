import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";

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
    external: external,
    plugins: [
      typescript(),
      commonjs(),
    ],
  }
}
function setExternal(external) {
  return([configure(false,external), configure(true,external)]);
}
export default setExternal;
