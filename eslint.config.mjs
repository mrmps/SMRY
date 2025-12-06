import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
// import tailwindcss from "eslint-plugin-tailwindcss";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = [
  {
    ignores: [".cursor/**/*"],
  },
  ...nextCoreWebVitals,
  // ...tailwindcss.configs["flat/recommended"],
  {
    plugins: {
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
    },
    rules: {
      // React Hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      
      // Unused imports rules
      "no-unused-vars": "off", // Turn off base rule to avoid conflicts
      "@typescript-eslint/no-unused-vars": "off", // Turn off TypeScript rule to avoid conflicts
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='asChild']",
          message:
            "Radix's `asChild` prop is not allowed. We standardize on Base UI (@base-ui-components/react); use its parts + `render={...}` polymorphism (e.g. `<Dialog.Trigger render={<Button variant=\"primary\" />} />`) instead of wrapping children with Radix Slot. See docs/design/baseui-vs-radix.md for the migration guide.",
        },
      ],
    },
    settings: {
      tailwindcss: {
        whitelist: [
          "transition-border",
          "animate-fade-in",
          "tokens",
          "justify-left",
          "article-skeleton",
          "article-content",
          "overflow-wrap",
          "remove-all",
          "pb-safe",
        ],
      },
    },
  },
];

export default eslintConfig;