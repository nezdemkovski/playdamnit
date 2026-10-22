import { ChangeKind, ProductPlatform } from "./model";

/** The single release history for web and native clients. Add member-facing features here. */
const releases = [
  {
    version: "1.1",
    date: "2026-10-22",
    platform: ProductPlatform.All,
    changes: [
      {
        kind: ChangeKind.New,
        titles: {
          en: "Send feedback and read what’s new from Settings",
          ru: "Предлагай функции, сообщай об ошибках и читай новости в настройках",
          es: "Envía comentarios y descubre las novedades en Ajustes",
          ja: "設定からフィードバックを送信し、新機能を確認できます",
          "zh-Hans": "在设置中提交反馈并查看更新内容",
        },
      },
    ],
  },
  {
    version: "1.0",
    date: "2026-10-12",
    platform: ProductPlatform.All,
    changes: [
      {
        kind: ChangeKind.New,
        titles: {
          en: "Initial release",
          ru: "Первый релиз",
          es: "Lanzamiento inicial",
          ja: "初回リリース",
          "zh-Hans": "首次发布",
        },
      },
    ],
  },
];

type Locale = keyof (typeof releases)[number]["changes"][number]["titles"];
export function getChangelog(locale = "en", platform = ProductPlatform.All) {
  const normalized = locale.toLowerCase().replaceAll("_", "-");
  const simplified =
    normalized === "zh" ||
    normalized === "zh-cn" ||
    normalized === "zh-sg" ||
    normalized === "zh-hans" ||
    normalized.startsWith("zh-hans-");
  const language = simplified ? "zh-Hans" : normalized.split("-")[0];
  return {
    releases: releases
      .filter(
        (release) =>
          platform === ProductPlatform.All ||
          release.platform === ProductPlatform.All ||
          release.platform === platform,
      )
      .map((release) => ({
        version: release.version,
        date: release.date,
        platform: release.platform,
        changes: release.changes.map((change) => ({
          kind: change.kind,
          title: change.titles[language as Locale] ?? change.titles.en,
          details: [] as string[],
        })),
      })),
  };
}
