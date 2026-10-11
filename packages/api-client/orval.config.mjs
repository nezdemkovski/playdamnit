import { defineConfig } from "orval";

export default defineConfig({
  playdamnit: {
    // spec.yaml is the hand-maintained API contract (update it with every route change)
    input: "./spec.yaml",
    output: {
      target: "./generated.ts",
      client: "react-query",
      httpClient: "axios",
      override: {
        // Real TypeScript enums, not string unions: callers write `StatusEnum.Finished`
        enumGenerationType: "enum",
        namingConvention: { enum: "PascalCase" },
        mutator: {
          path: "./custom-axios.ts",
          name: "customInstance",
        },
      },
    },
  },
});
