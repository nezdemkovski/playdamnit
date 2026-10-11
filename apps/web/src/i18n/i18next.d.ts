import "i18next";

import type en from "./locales/en.json";

// English defines the key set; every `t()` call is checked against it
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
    returnNull: false;
  }
}
