# Privacy Policy — Telegram History Downloader

**Effective date:** November 10, 2026

[English](#english) · [Русский](#русский)

---

## English

Telegram History Downloader (the "Extension") is a Chrome extension that exports the message history of a chat, group or channel opened in Telegram Web (web.telegram.org/k/) to files on your computer. This policy explains what data the Extension handles and how.

**In short:** the Extension works entirely in your browser. It does not send your data to the developer or to any third party, has no servers, no analytics and no advertising.

### What data the Extension handles

When you start an export, the Extension reads, inside the open Telegram Web tab, the data needed to create the export file:

- **Messages and their content** of the chat you have opened: text, formatting, links, polls, reactions, view counts, shared locations and contacts, and service messages.
- **Information about chat participants** that is part of the messages: names, usernames and Telegram user IDs of message authors, and phone numbers if they appear in shared contacts.
- **Media files** you chose to include (photos, videos, voice and audio messages, files, stickers).
- **Information about the chat itself:** title, type and public username.

The Extension also stores your **export settings** (message range, formats, media types and file size limit) in the browser's local extension storage (`chrome.storage.local`) so they are restored the next time you open it. These settings do not contain any message content.

The Extension does not handle passwords, authentication tokens, payment information, health information or your browsing history. It does not track clicks, keystrokes or other activity. It uses your existing Telegram Web session and never asks for your login details.

### How the data is used

The data is used for one purpose only: to create the export file you requested.

- All processing happens locally in your browser, inside the Telegram Web tab.
- Messages and media are requested from Telegram through your own Telegram Web session — the same way Telegram Web loads them when you scroll the chat.
- The result (an HTML, JSON or Markdown file, or a ZIP archive) is saved to your computer through the browser's standard download mechanism.
- The Extension does not keep a copy of exported messages or media after the export finishes. The exported files are stored only where your browser saves downloads.

### Sharing and transfer

The Extension does **not** sell, transfer or share your data with the developer or any third party. It contains no analytics, tracking, advertising or remote code, and it does not make network requests to any server other than Telegram's own servers that Telegram Web already uses.

What you do with the exported files is up to you. Exported files may contain personal information of other chat participants; please respect their privacy and applicable laws when storing or sharing them.

### Permissions

- **Access to `https://web.telegram.org/*`** — to run the export inside the Telegram Web tab. The Extension has no access to other websites.
- **`scripting`** — to load the Extension's own scripts into an already open Telegram Web tab, so the export can start without reloading the page.
- **`storage`** — to save your export settings locally.

### Data retention and deletion

- Export settings stay in your browser until you uninstall the Extension or clear its data.
- Exported files are stored only on your device; you can delete them at any time.
- The Extension does not have any data of yours on external servers, so there is nothing to request or delete from the developer.

### Children

The Extension is not directed at children and does not knowingly collect any information from them.

### Chrome Web Store User Data Policy

The use of information received by the Extension adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies), including the [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use) requirements. User data is used only to provide the Extension's single purpose — exporting chat history at the user's request — and is never used or transferred for advertising, creditworthiness assessment, or any other purpose, and is never read by humans.

### Disclaimer

The Extension is not an official Telegram product and is not affiliated with Telegram FZ-LLC. Telegram's handling of your data is governed by [Telegram's Privacy Policy](https://telegram.org/privacy).

### Changes to this policy

If this policy changes, the updated version will be published at this page with a new effective date. Any change in how the Extension handles data will also be reflected in the Chrome Web Store listing.

### Contact

Questions about this policy can be asked by opening an issue at [github.com/itcaat/telegram-history-downloader/issues](https://github.com/itcaat/telegram-history-downloader/issues).

---

## Русский

Telegram History Downloader («Расширение») — расширение для Chrome, которое экспортирует историю сообщений чата, группы или канала, открытого в Telegram Web (web.telegram.org/k/), в файлы на вашем компьютере. Эта политика объясняет, какие данные обрабатывает Расширение и как.

**Коротко:** Расширение работает полностью в вашем браузере. Оно не передаёт ваши данные разработчику или третьим лицам, у него нет серверов, аналитики и рекламы.

### Какие данные обрабатывает Расширение

Когда вы запускаете экспорт, Расширение считывает во вкладке Telegram Web данные, необходимые для создания файла:

- **Сообщения и их содержимое** в открытом чате: текст, форматирование, ссылки, опросы, реакции, количество просмотров, отправленные геопозиции и контакты, служебные сообщения.
- **Сведения об участниках чата**, которые входят в сообщения: имена, юзернеймы и Telegram ID авторов сообщений, а также номера телефонов, если они есть в отправленных контактах.
- **Медиафайлы**, которые вы выбрали для экспорта (фото, видео, голосовые и аудио, файлы, стикеры).
- **Сведения о самом чате:** название, тип и публичный юзернейм.

Кроме того, Расширение сохраняет **настройки экспорта** (диапазон сообщений, форматы, типы медиа и лимит размера файлов) в локальном хранилище расширения в браузере (`chrome.storage.local`), чтобы восстановить их при следующем открытии. Содержимого сообщений в настройках нет.

Расширение не обрабатывает пароли, токены авторизации, платёжные и медицинские данные, историю посещений сайтов. Оно не отслеживает клики, нажатия клавиш и другие действия. Расширение использует уже открытую сессию Telegram Web и никогда не запрашивает данные для входа.

### Как используются данные

Данные используются только для одной цели — создать файл экспорта, который вы запросили.

- Вся обработка происходит локально в вашем браузере, во вкладке Telegram Web.
- Сообщения и медиа запрашиваются у Telegram через вашу собственную сессию Telegram Web — так же, как Telegram Web загружает их при прокрутке чата.
- Результат (файл HTML, JSON, Markdown или ZIP-архив) сохраняется на ваш компьютер стандартным механизмом загрузок браузера.
- После завершения экспорта Расширение не хранит копию сообщений и медиа. Файлы экспорта находятся только там, куда ваш браузер сохраняет загрузки.

### Передача данных

Расширение **не** продаёт и не передаёт ваши данные разработчику или третьим лицам. В нём нет аналитики, трекинга, рекламы и удалённого кода, и оно не отправляет сетевые запросы никуда, кроме серверов Telegram, с которыми и так работает Telegram Web.

Как распоряжаться файлами экспорта, решаете вы. В них могут быть персональные данные других участников чата — уважайте их приватность и соблюдайте применимое законодательство при хранении и передаче таких файлов.

### Разрешения

- **Доступ к `https://web.telegram.org/*`** — чтобы выполнять экспорт во вкладке Telegram Web. К другим сайтам у Расширения доступа нет.
- **`scripting`** — чтобы загрузить собственные скрипты Расширения в уже открытую вкладку Telegram Web и начать экспорт без перезагрузки страницы.
- **`storage`** — чтобы локально сохранять настройки экспорта.

### Хранение и удаление данных

- Настройки экспорта хранятся в браузере, пока вы не удалите Расширение или не очистите его данные.
- Файлы экспорта хранятся только на вашем устройстве, и вы можете удалить их в любой момент.
- У разработчика нет ваших данных на внешних серверах, поэтому запрашивать или удалять у него нечего.

### Дети

Расширение не предназначено для детей и сознательно не собирает о них никакой информации.

### Правила Chrome Web Store в отношении пользовательских данных

Использование информации, полученной Расширением, соответствует [правилам Chrome Web Store в отношении пользовательских данных](https://developer.chrome.com/docs/webstore/program-policies/policies), включая требования [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use). Пользовательские данные используются только для единственного назначения Расширения — экспорта истории чата по запросу пользователя. Они никогда не используются и не передаются для рекламы, оценки платёжеспособности или любых других целей и никогда не просматриваются людьми.

### Отказ от ответственности

Расширение не является официальным продуктом Telegram и не связано с Telegram FZ-LLC. Обработка ваших данных самим Telegram регулируется [политикой конфиденциальности Telegram](https://telegram.org/privacy).

### Изменения политики

Если политика изменится, обновлённая версия будет опубликована на этой странице с новой датой вступления в силу. Любые изменения в обработке данных также будут отражены в карточке Расширения в Chrome Web Store.

### Контакты

Вопросы по этой политике можно задать, создав issue на [github.com/itcaat/telegram-history-downloader/issues](https://github.com/itcaat/telegram-history-downloader/issues).
