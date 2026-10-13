import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import remotion from "@remotion/eslint-plugin";
import tseslint from "typescript-eslint";

const regrasNext = nextPlugin.configs.recommended?.rules ?? {};
const regrasNextDesligadas = Object.fromEntries(
  Object.keys(regrasNext).map((regra) => [regra, "off"]),
);

export default [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "midia/**",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Regras do Next.js para o app.
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs}"],
    plugins: { "@next/next": nextPlugin },
    rules: { ...regrasNext },
  },
  // Regras do Remotion só nos arquivos de vídeo (sem as do Next).
  {
    files: ["src/remotion/**"],
    ...remotion.flatPlugin,
    rules: { ...remotion.flatPlugin.rules, ...regrasNextDesligadas },
  },
];
