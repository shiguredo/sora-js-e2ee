import minify from "rollup-plugin-babel-minify";
import typescript from "rollup-plugin-typescript2";

export default [
  {
    input: "src/sora_e2ee_worker.ts",
    plugins: [
      typescript({
        tsconfig: "./tsconfig.worker.json",
      }),
      minify({
        comments: false,
      }),
    ],
    output: {
      sourcemap: false,
      file: "_worker/sora_e2ee_worker.js",
      format: "es",
    },
  },
];
