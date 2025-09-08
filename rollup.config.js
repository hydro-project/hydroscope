import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';

const externalPkgs = [
  'react',
  'react-dom',
  'antd',
  '@ant-design/icons',
  '@xyflow/react',
  'elkjs',
  'web-worker'
];

// We emit both ESM and CJS builds so downstream tooling (e.g. Docusaurus running in a CJS context)
// can "require" the package. The CJS artifact uses the .cjs extension to avoid Node ESM semantics
// because package.json has "type": "module".
export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true
    },
    {
      file: 'dist/index.cjs', // .cjs extension ensures CommonJS interpretation
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
      exports: 'named'
    }
  ],
  external: (id) => externalPkgs.some(pkg => id === pkg || id.startsWith(pkg + '/')),
  plugins: [
    resolve({
      preferBuiltins: false
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.build.json',
      declaration: true,
      declarationDir: 'dist',
      rootDir: 'src'
    }),
    postcss({
      extract: 'style.css',
      minimize: true
    })
  ],
  onwarn(warning, warn) {
    // Silence noisy but benign warnings from externalized deps
    if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'THIS_IS_UNDEFINED') return;
    if (warning.code === 'UNRESOLVED_IMPORT' && warning.source === 'web-worker') return;
    warn(warning);
  }
};
