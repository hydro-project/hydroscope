import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";

export default {
  input: "src/index.ts",
  output: [
    { file: "dist/index.esm.js", format: "esm", sourcemap: true },
    { file: "dist/index.cjs", format: "cjs", sourcemap: true },
  ],
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@xyflow/react",
    "elkjs",
    "elkjs/lib/elk.bundled.js",
  ],
  plugins: [
    resolve(),
    commonjs(),
    postcss({ extract: "style.css", minimize: true }),
    typescript({ tsconfig: "./tsconfig.json", declaration: true, declarationDir: "dist" }),
  ],
};
