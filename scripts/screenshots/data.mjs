// Localized texts and demo data for Chrome Web Store screenshots.

const DAY = Math.floor(new Date(2026, 10, 10, 10, 0).getTime() / 1000);
const at = (h, m) => DAY + (h - 10) * 3600 + m * 60;

const people = {
  ru: {anna: 'Анна Смирнова', max: 'Максим Орлов', kate: 'Катя Белова', ilya: 'Илья Ким'},
  en: {anna: 'Anna Smith', max: 'Max Turner', kate: 'Kate Brown', ilya: 'Ilya Kim'}
};

const chat = (lang) => ({
  peerId: 1234564,
  title: lang === 'ru' ? 'Команда продукта' : 'Product Team',
  kind: 'group',
  username: 'product_team'
});

const fileName = (lang) => lang === 'ru' ? 'Команда_продукта_2026-11-10.zip' : 'Product_Team_2026-11-10.zip';

/** Messages shown in the fake Telegram chat behind the popup. */
const backdrop = {
  ru: [
    {from: 'anna', text: 'Всем привет! Сегодня в 15:00 демо нового онбординга 🚀'},
    {from: 'max', text: 'Супер, макеты уже в Figma. Ссылку скину в тред'},
    {out: true, text: 'Отлично, буду. Сохраню историю чата перед релизом'},
    {from: 'kate', text: 'Метрики за неделю: конверсия в регистрацию +12% 📈'},
    {from: 'ilya', text: 'Релиз 2.4 собран, чейнджлог в закрепе'},
    {out: true, text: 'Спасибо! Тогда завтра стартуем A/B-тест'}
  ],
  en: [
    {from: 'anna', text: 'Hi all! New onboarding demo today at 3 PM 🚀'},
    {from: 'max', text: 'Great, mockups are in Figma. I’ll drop a link in the thread'},
    {out: true, text: 'Perfect, I’ll be there. Saving the chat history before the release'},
    {from: 'kate', text: 'Weekly metrics: sign-up conversion +12% 📈'},
    {from: 'ilya', text: 'Release 2.4 is built, changelog is pinned'},
    {out: true, text: 'Thanks! Let’s kick off the A/B test tomorrow'}
  ]
};

/** Messages rendered by the real HTML exporter. */
function exportMessages(lang) {
  const p = people[lang];
  const author = (key) => ({id: key, name: p[key]});
  const ru = lang === 'ru';
  const bold = (text, word) => ({type: 'bold', offset: text.indexOf(word), length: word.length});

  const t1 = ru ? 'Всем привет! Сегодня в 15:00 демо нового онбординга 🚀' : 'Hi all! New onboarding demo today at 3 PM 🚀';
  const t3 = ru ? 'Метрики за неделю: конверсия в регистрацию +12%' : 'Weekly metrics: sign-up conversion +12%';
  const t5 = ru ? 'Релиз 2.4 собран, деплой командой:' : 'Release 2.4 is built, deploy with:';
  const code = 'make deploy ENV=prod';

  return [
    {
      id: 1201, type: 'message', date: at(10, 2), from: author('anna'), text: t1,
      entities: [bold(t1, ru ? 'демо нового онбординга' : 'New onboarding demo')],
      reactions: [{emoji: '🔥', count: 7}, {emoji: '👍', count: 4}]
    },
    {
      id: 1202, type: 'message', date: at(10, 9), from: author('max'),
      text: ru ? 'Макеты готовы, смотрите превью 👇' : 'Mockups are ready, check out the preview 👇',
      entities: [],
      media: {type: 'webpage', url: 'https://www.figma.com/', site_name: 'Figma', title: ru ? 'Онбординг v2 — макеты' : 'Onboarding v2 — mockups'}
    },
    {
      id: 1203, type: 'message', date: at(11, 24), from: author('kate'), text: t3,
      entities: [bold(t3, '+12%')],
      media: {type: 'photo', file: 'media/photos/1203_chart.svg'},
      reactions: [{emoji: '🎉', count: 9}]
    },
    {
      id: 1204, type: 'message', date: at(12, 40), from: author('ilya'), text: `${t5}\n${code}`,
      entities: [{type: 'pre', offset: t5.length + 1, length: code.length, language: 'bash'}]
    },
    {
      id: 1205, type: 'message', date: at(13, 15), from: author('anna'), text: '',
      entities: [],
      media: {
        type: 'poll',
        question: ru ? 'Когда запускаем A/B-тест?' : 'When do we start the A/B test?',
        answers: ru ?
          [{text: 'Завтра', voters: 8}, {text: 'В понедельник', voters: 3}] :
          [{text: 'Tomorrow', voters: 8}, {text: 'On Monday', voters: 3}],
        total_voters: 11
      }
    }
  ].map((m) => ({...m, date_iso: new Date(m.date * 1000).toISOString()}));
}

const CHART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="211" viewBox="0 0 640 260">
<rect width="640" height="260" fill="#1d2440"/>
<g fill="none" stroke="#2c355a" stroke-width="1">${[60, 110, 160, 210].map((y) => `<path d="M40 ${y}h560"/>`).join('')}</g>
<g fill="#8774e1">${[70, 95, 88, 120, 132, 150, 178].map((h, i) => `<rect x="${60 + i * 80}" y="${220 - h}" width="40" height="${h}" rx="6"/>`).join('')}</g>
<path d="M80 150 160 128 240 136 320 104 400 92 480 74 560 46" fill="none" stroke="#5cc85e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const texts = {
  ru: {
    zipFiles: ['messages.html', 'messages.json', 'media/photos/ — 312', 'media/videos/ — 41', 'media/files/ — 27'],
    scenes: [
      ['Экспорт любого чата Telegram в пару кликов', 'Личные чаты, группы, каналы и «Избранное» — прямо из Telegram Web.'],
      ['HTML, JSON или Markdown — вместе с медиа', 'Выберите период, форматы и нужные медиа: фото, видео, голосовые и файлы.'],
      ['Работает в фоне', 'Закройте окно расширения — экспорт продолжится, пока открыта вкладка Telegram.'],
      ['Читаемая копия без интернета', 'HTML-экспорт открывается в любом браузере. Сообщения и медиа — в одном ZIP-архиве.'],
      ['Ваши данные остаются у вас', 'Всё работает локально в браузере. Без сторонних серверов, аналитики и отдельного входа.']
    ],
    bullets: [
      ['Вся история, последние N сообщений или период', 'Текст с форматированием, реакции, опросы'],
      ['Несколько форматов за один раз', 'Лимит размера файлов'],
      ['Прогресс и счётчики в реальном времени', 'Экспорт можно остановить'],
      ['Открывается офлайн в любом браузере', 'JSON для анализа, Markdown для заметок'],
      ['Доступ только к web.telegram.org', 'Файлы сохраняются в папку загрузок']
    ]
  },
  en: {
    zipFiles: ['messages.html', 'messages.json', 'media/photos/ — 312', 'media/videos/ — 41', 'media/files/ — 27'],
    scenes: [
      ['Export any Telegram chat in two clicks', 'Private chats, groups, channels and Saved Messages — right from Telegram Web.'],
      ['HTML, JSON or Markdown — with media', 'Pick a date range, formats and the media you need: photos, videos, voice and files.'],
      ['Keeps working in the background', 'Close the popup — the export continues while the Telegram tab stays open.'],
      ['A readable copy that works offline', 'Open the HTML export in any browser. Messages and media come in one ZIP archive.'],
      ['Your data stays with you', 'Everything runs locally in your browser. No third-party servers, no analytics, no extra login.']
    ],
    bullets: [
      ['Entire history, latest N messages or a date range', 'Formatted text, reactions, polls'],
      ['Several formats at once', 'File size limit for media'],
      ['Live progress and counters', 'Stop the export at any time'],
      ['Opens offline in any browser', 'JSON for analysis, Markdown for notes'],
      ['Access to web.telegram.org only', 'Files are saved to your Downloads']
    ]
  }
};

/** Popup state for each screenshot; `null` means the scene shows the HTML export instead. */
function popupConfigs(lang) {
  const c = chat(lang);
  const job = (extra) => ({
    phase: 'messages', chat: c, mediaFailed: 0, mediaSkipped: 0, ...extra
  });

  return [
    {
      state: {ready: true, chat: c, job: null},
      form: {range: 'last', lastCount: 1000, formats: ['html'], media: ['photo'], maxSize: 50}
    },
    {
      state: {ready: true, chat: c, job: null},
      form: {range: 'dates', from: '2026-01-01', to: '2026-03-31', formats: ['html', 'json'], media: ['photo', 'video', 'file'], maxSize: 50},
      scroll: true
    },
    {
      state: {ready: true, chat: c, job: job({status: 'running', messagesFetched: 5230, messagesTotal: 12400, mediaDone: 214, bytes: 195_400_000})},
      startedAgo: 192_000
    },
    null,
    {
      state: {ready: true, chat: c, job: job({
        status: 'done', phase: 'packing', messagesFetched: 12400, messagesTotal: 12400, mediaDone: 380, mediaSkipped: 3,
        bytes: 432_700_000, fileName: fileName(lang)
      })},
      startedAgo: 408_000,
      finished: true
    }
  ];
}

export const LANGS = ['en', 'ru'];
export const SCENE_NAMES = ['1-export', '2-formats', '3-background', '4-html-export', '5-privacy'];
export {backdrop, chat, people, exportMessages, texts, popupConfigs, fileName, CHART_SVG, DAY};
