// Config mínima para que `npm run lint` funcione con ESLint 8.
// Sin plugins de React a propósito: solo reglas base recomendadas.
// Los avisos (warn) no hacen fallar el lint; los errores sí.
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  ignorePatterns: ["dist", "node_modules"],
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-undef": "error",
    "no-empty": "warn",
  },
};
