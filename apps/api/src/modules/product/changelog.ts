import { ChangeKind, ProductPlatform } from "./model";

/** The single release history for web and native clients. Add member-facing features here. */
const releases = [
  {
    version: "1.2",
    date: "2026-10-23",
    platform: ProductPlatform.IOS,
    changes: [
      {
        kind: ChangeKind.New,
        titles: {
          en: "Delete inbox notifications with a swipe, or clear them all at once",
          ru: "Удаляй уведомления свайпом или очищай весь инбокс сразу",
          es: "Elimina notificaciones deslizando o vacía toda la bandeja de entrada",
          ja: "スワイプで通知を削除するか、受信トレイをまとめて空にできます",
          "zh-Hans": "滑动删除单条通知，或一次清空收件箱",
          "pt-BR": "Deslize para excluir notificações ou limpe toda a caixa de entrada de uma vez",
          de: "Lösche Benachrichtigungen per Wischgeste oder leere den gesamten Posteingang",
          fr: "Supprime les notifications d’un geste ou vide toute la boîte de réception",
          ko: "스와이프로 알림을 삭제하거나 받은 편지함을 한 번에 비울 수 있어요",
          pl: "Usuwaj powiadomienia przesunięciem lub wyczyść całą skrzynkę naraz",
          "zh-Hant": "滑動刪除單則通知，或一次清空收件匣",
        },
      },
    ],
  },
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
