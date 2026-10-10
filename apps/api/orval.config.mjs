import { defineConfig } from "orval";

export default defineConfig({
  playdamnit: {
    input: "./spec.yaml",
    output: {
      target: "./api-client/index.ts",
      client: "react-query",
      httpClient: "axios",
      override: {
        mutator: {
          path: "./api-client/custom-axios.ts",
          name: "customInstance",
        },
      },
    },
    hooks: {
      afterAllFilesWrite: "prettier --write",
    },
  },
});
