import { defineConfig } from "orval";

export default defineConfig({
  playdamnit: {
    // spec.yaml is the hand-maintained API contract (update it with every route change)
    input: "./spec.yaml",
    output: {
      target: "./index.ts",
      client: "react-query",
      httpClient: "axios",
      override: {
        mutator: {
          path: "./custom-axios.ts",
          name: "customInstance",
        },
      },
    },
    hooks: {
      afterAllFilesWrite: "prettier --write",
    },
  },
});
