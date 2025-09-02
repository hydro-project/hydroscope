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

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true
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
