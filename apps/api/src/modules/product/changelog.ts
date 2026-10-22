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
          "pt-BR": "Envie feedback e confira as novidades nos Ajustes.",
          de: "Sende Feedback und lies in den Einstellungen, was es Neues gibt.",
          fr: "Envoie tes commentaires et découvre les nouveautés dans les réglages.",
          ko: "설정에서 의견을 보내고 업데이트 소식을 확인하세요",
          pl: "Wysyłaj opinie i sprawdzaj nowości w ustawieniach",
          "zh-Hant": "在設定中傳送意見並查看更新內容",
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
          "pt-BR": "Primeira versão",
          de: "Erste Veröffentlichung",
          fr: "Première version",
          ko: "첫 출시",
          pl: "Pierwsze wydanie",
          "zh-Hant": "首次發行",
        },
      },
    ],
  },
];

enum Locale {
  English = "en",
  Russian = "ru",
  Spanish = "es",
  Japanese = "ja",
  SimplifiedChinese = "zh-Hans",
  TraditionalChinese = "zh-Hant",
  Portuguese = "pt-BR",
  German = "de",
  French = "fr",
  Korean = "ko",
  Polish = "pl",
}
export function getChangelog(locale = "en", platform = ProductPlatform.All) {
  const normalized = locale.toLowerCase().replaceAll("_", "-");
  const simplified =
    normalized === "zh" ||
    normalized === "zh-cn" ||
    normalized === "zh-sg" ||
    normalized === "zh-hans" ||
    normalized.startsWith("zh-hans-");
  const traditional =
    normalized === "zh-tw" ||
    normalized === "zh-hk" ||
    normalized === "zh-mo" ||
    normalized === "zh-hant" ||
    normalized.startsWith("zh-hant-");
  const base = normalized.split("-")[0];
  const language = simplified
    ? Locale.SimplifiedChinese
    : traditional
      ? Locale.TraditionalChinese
      : base === "pt"
        ? Locale.Portuguese
        : base;
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
