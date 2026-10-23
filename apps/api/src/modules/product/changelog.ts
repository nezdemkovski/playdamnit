import { ChangeKind, ProductPlatform } from "./model";

/** The single release history for web and native clients. */
const releases = [
  {
    version: "1.1",
    date: "2026-10-23",
    platform: ProductPlatform.All,
    changes: [
      {
        kind: ChangeKind.New,
        titles: {
          en: "The app now supports German, French, Brazilian Portuguese, Korean, Polish and Traditional Chinese",
          ru: "Приложение теперь доступно на немецком, французском, бразильском португальском, корейском, польском и традиционном китайском",
          es: "La app ahora está disponible en alemán, francés, portugués de Brasil, coreano, polaco y chino tradicional",
          ja: "アプリがドイツ語、フランス語、ブラジルポルトガル語、韓国語、ポーランド語、繁体字中国語に対応しました",
          "zh-Hans": "应用现已支持德语、法语、巴西葡萄牙语、韩语、波兰语和繁体中文",
          "pt-BR":
            "O app agora está disponível em alemão, francês, português do Brasil, coreano, polonês e chinês tradicional",
          de: "Die App ist jetzt auf Deutsch, Französisch, brasilianischem Portugiesisch, Koreanisch, Polnisch und traditionellem Chinesisch verfügbar",
          fr: "L’app est désormais disponible en allemand, en français, en portugais du Brésil, en coréen, en polonais et en chinois traditionnel",
          ko: "이제 앱에서 독일어, 프랑스어, 브라질 포르투갈어, 한국어, 폴란드어, 중국어 번체를 지원해요",
          pl: "Aplikacja obsługuje teraz niemiecki, francuski, portugalski (Brazylia), koreański, polski i chiński tradycyjny",
          "zh-Hant": "App 現已支援德文、法文、巴西葡萄牙文、韓文、波蘭文及繁體中文",
        },
      },
      {
        kind: ChangeKind.New,
        titles: {
          en: "Found a bug or have an idea? Send it to us directly from Settings",
          ru: "Нашёл ошибку или есть идея? Напиши нам прямо из настроек приложения",
          es: "¿Encontraste un error o tienes una idea? Escríbenos directamente desde Ajustes",
          ja: "不具合を見つけた、またはアイデアがある場合は、設定から直接送信できます",
          "zh-Hans": "发现了问题，或有新点子？直接在设置中告诉我们",
          "pt-BR":
            "Encontrou um erro ou teve uma ideia? Fale com a gente diretamente pelos Ajustes",
          de: "Fehler gefunden oder eine Idee? Schreib uns direkt in den Einstellungen",
          fr: "Un bug ou une idée ? Écris-nous directement depuis les réglages",
          ko: "버그를 발견했거나 아이디어가 있나요? 설정에서 바로 보내 주세요",
          pl: "Znalazłeś błąd lub masz pomysł? Napisz do nas bezpośrednio w ustawieniach",
          "zh-Hant": "發現問題或有新點子？直接在設定中告訴我們",
        },
      },
      {
        kind: ChangeKind.New,
        titles: {
          en: "Delete inbox notifications with a swipe in the app, or clear them all at once",
          ru: "Удаляй уведомления свайпом в приложении или очищай весь инбокс сразу",
          es: "Elimina notificaciones deslizando en la app o vacía toda la bandeja de entrada",
          ja: "アプリで通知をスワイプして削除するか、受信トレイをまとめて空にできます",
          "zh-Hans": "在应用中滑动删除单条通知，或一次清空收件箱",
          "pt-BR":
            "No app, deslize para excluir notificações ou limpe toda a caixa de entrada de uma vez",
          de: "Lösche Benachrichtigungen in der App per Wischgeste oder leere den gesamten Posteingang",
          fr: "Dans l’app, supprime les notifications d’un geste ou vide toute la boîte de réception",
          ko: "앱에서 스와이프로 알림을 삭제하거나 받은 편지함을 한 번에 비울 수 있어요",
          pl: "Usuwaj powiadomienia w aplikacji przesunięciem lub wyczyść całą skrzynkę naraz",
          "zh-Hant": "在 App 中滑動刪除單則通知，或一次清空收件匣",
        },
      },
      {
        kind: ChangeKind.Changed,
        titles: {
          en: "Your Steam avatar is now shown when you haven’t uploaded your own",
          ru: "Если своя аватарка не загружена, показываем аватар из Steam",
          es: "Si no has subido tu propio avatar, ahora se muestra el de Steam",
          ja: "自分のアバターをアップロードしていない場合は、Steamのアバターが表示されます",
          "zh-Hans": "未上传自己的头像时，现会显示 Steam 头像",
          "pt-BR": "Se você não enviou um avatar próprio, agora mostramos o do Steam",
          de: "Wenn du kein eigenes Profilbild hochgeladen hast, wird jetzt dein Steam-Avatar angezeigt",
          fr: "Si tu n’as pas importé ton propre avatar, celui de Steam s’affiche désormais",
          ko: "직접 업로드한 아바타가 없으면 Steam 아바타가 표시돼요",
          pl: "Jeśli nie przesłałeś własnego awatara, wyświetlamy teraz awatar ze Steam",
          "zh-Hant": "尚未上傳自己的頭像時，現在會顯示 Steam 頭像",
        },
      },
      {
        kind: ChangeKind.Fixed,
        titles: {
          en: "Steam friends no longer appear twice in the community member list",
          ru: "Steam-друзья больше не дублируются в списке участников сообщества",
          es: "Los amigos de Steam ya no aparecen duplicados en la lista de miembros de la comunidad",
          ja: "コミュニティのメンバー一覧にSteamのフレンドが重複して表示されなくなりました",
          "zh-Hans": "Steam 好友不再在社区成员列表中重复显示",
          "pt-BR": "Amigos do Steam não aparecem mais duplicados na lista de membros da comunidade",
          de: "Steam-Freunde erscheinen nicht mehr doppelt in der Mitgliederliste der Community",
          fr: "Les amis Steam n’apparaissent plus en double dans la liste des membres de la communauté",
          ko: "커뮤니티 회원 목록에 Steam 친구가 중복으로 표시되던 문제를 수정했어요",
          pl: "Znajomi ze Steam nie pojawiają się już dwukrotnie na liście członków społeczności",
          "zh-Hant": "Steam 好友不再於社群成員列表中重複顯示",
        },
      },
      {
        kind: ChangeKind.Fixed,
        titles: {
          en: "Skipping games while grading now works repeatedly, and skipped games stay at the end of the queue after restarting the app on this device",
          ru: "Пропуск игр при выставлении оценок работает повторно, а пропущенные игры остаются в конце очереди после перезапуска приложения на этом устройстве",
          es: "Ahora puedes omitir juegos varias veces al puntuarlos, y los juegos omitidos permanecen al final de la cola tras reiniciar la app en este dispositivo",
          ja: "評価中にゲームを続けてスキップできるようになり、このデバイスでアプリを再起動してもスキップしたゲームは待ち行列の最後に残ります",
          "zh-Hans": "评分时现可连续跳过游戏；在此设备上重启应用后，已跳过的游戏仍会排在队列末尾",
          "pt-BR":
            "Agora você pode pular jogos repetidamente ao dar notas, e os jogos pulados continuam no fim da fila após reiniciar o app neste dispositivo",
          de: "Beim Bewerten kannst du Spiele jetzt wiederholt überspringen. Übersprungene Spiele bleiben auch nach einem App-Neustart auf diesem Gerät am Ende der Warteschlange",
          fr: "Tu peux désormais passer plusieurs jeux à la suite pendant la notation. Ils restent en fin de file après le redémarrage de l’app sur cet appareil",
          ko: "평가 중 게임 건너뛰기가 한 번만 작동하던 문제를 수정했어요. 이 기기에서 앱을 다시 시작해도 건너뛴 게임은 대기열 끝에 남아요",
          pl: "Podczas oceniania można już wielokrotnie pomijać gry. Pominięte gry pozostają na końcu kolejki po ponownym uruchomieniu aplikacji na tym urządzeniu",
          "zh-Hant":
            "評分時現在可以連續略過遊戲；在此裝置上重新啟動 App 後，略過的遊戲仍會排在佇列最後",
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
