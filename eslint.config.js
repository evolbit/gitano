import path from "node:path";
import { fileURLToPath } from "node:url";
import tsParser from "@typescript-eslint/parser";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const kebabCaseTypeScriptFilename =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.(?:test|spec|config|d))?\.(?:ts|tsx)$/u;

const kebabCaseFilenamePlugin = {
  rules: {
    "typescript-file-name": {
      meta: {
        type: "problem",
        docs: {
          description: "Require kebab-case filenames for TypeScript files.",
        },
        schema: [],
        messages: {
          invalid:
            "TypeScript filename '{{ filename }}' must use kebab-case.",
        },
      },
      create(context) {
        return {
          Program(node) {
            const filename =
              context.physicalFilename ??
              context.filename ??
              context.getPhysicalFilename?.() ??
              context.getFilename?.();

            if (!filename || filename.startsWith("<")) {
              return;
            }

            const basename = path.basename(filename);
            const relativeFilename = path.relative(configDirectory, filename);

            if (
              !relativeFilename.startsWith("..") &&
              !kebabCaseTypeScriptFilename.test(basename)
            ) {
              context.report({
                node,
                messageId: "invalid",
                data: { filename: basename },
              });
            }
          },
        };
      },
    },
  },
};

export default [
  {
    ignores: ["dist/**", "node_modules/**", "src-tauri/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "kebab-case-filename": kebabCaseFilenamePlugin,
    },
    rules: {
      "kebab-case-filename/typescript-file-name": "error",
    },
  },
];
