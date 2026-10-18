import "i18next";

import type changelog from "./locales/changelog/en.json";
import type en from "./locales/en.json";
import type legal from "./locales/legal/en.json";

// English defines the key set; every `t()` call is checked against it
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en; changelog: typeof changelog; legal: typeof legal };
    returnNull: false;
  }
}
