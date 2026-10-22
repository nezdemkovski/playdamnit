import type { Static } from "typebox";
import { t } from "elysia";

export enum FeedbackKind {
  Bug = "bug",
  Feature = "feature",
}
export enum ProductPlatform {
  All = "all",
  Web = "web",
  IOS = "ios",
}
export enum ChangeKind {
  New = "new",
  Changed = "changed",
  Fixed = "fixed",
}

export const feedbackSchema = t.Object({
  requestId: t.String({ format: "uuid" }),
  kind: t.Enum(FeedbackKind),
  title: t.String({ minLength: 1, maxLength: 160 }),
  message: t.String({ minLength: 1, maxLength: 5000 }),
  platform: t.Enum(ProductPlatform),
  appVersion: t.Optional(t.String({ maxLength: 64 })),
  locale: t.Optional(t.String({ maxLength: 35 })),
});
export type FeedbackInput = Static<typeof feedbackSchema>;
