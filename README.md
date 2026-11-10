# telegram-history-downloader

Chrome-расширение (Manifest V3) для экспорта истории чатов, групп и каналов из [Telegram Web K](https://web.telegram.org/k/) в JSON, HTML и Markdown, с медиа или без.

## Сборка

```bash
npm install
npm run build      # проверка типов + сборка в dist/
npm run watch      # пересборка при изменениях
```

CI (`.github/workflows/ci.yml`) собирает проект на каждый push в любую ветку и на pull request; собранный `dist/` доступен в артефактах запуска.

Релиз (`.github/workflows/release.yml`) запускается по semver-тегу:

```bash
make release              # v1.2.3 → v1.2.4
make release BUMP=minor   # v1.2.3 → v1.3.0
make release BUMP=major   # v1.2.3 → v2.0.0
```

`make release` работает только из `main` с чистым рабочим деревом, синхронизированным с `origin/main`. Последний тег берётся из GitHub через `gh`, новый тег ставится на текущий коммит и пушится. Если тегов ещё нет, используется версия из `package.json`. Pre-release можно выпустить вручную: `git tag v1.2.3-beta.1 && git push origin v1.2.3-beta.1`.

Версия из тега проставляется в `package.json` и `manifest.json` (`version` — `1.2.3`, `version_name` — полная версия), а ZIP с расширением прикрепляется к GitHub Release.

Установка: `chrome://extensions` → включить «Режим разработчика» → «Загрузить распакованное расширение» → выбрать папку `dist/`.

## Использование

1. Откройте https://web.telegram.org/k/ и выберите чат, группу или канал.
2. Нажмите на иконку расширения.
3. Выберите диапазон (вся история / последние N / даты), форматы и типы медиа.
4. Нажмите «Скачать». Окно можно закрыть: экспорт продолжится, пока открыта вкладка Telegram.

Один формат без медиа сохраняется одним файлом. В остальных случаях получается ZIP-архив: `messages.{json,html,md}` и папка `media/`.

## Как это работает

```
popup ──chrome.tabs.sendMessage──▶ content/bridge.js (isolated world)
                                        │ window.postMessage
                                        ▼
                                  content/main.js (MAIN world)
                                        │ window.rootScope.managers.*
                                        ▼
                              MTProto-сессия Telegram WebK
```

- `src/main` выполняется в контексте страницы и вызывает внутренние менеджеры WebK, которые тот выставляет в `window`:
  - `apiManager.invokeApi('messages.getHistory')` — загрузка сообщений;
  - `apiFileManager.download()` — загрузка файлов.
- Экспорт выполняется внутри вкладки, поэтому он не зависит от того, открыт ли попап.
- Медиа скачиваются постранично, пока `file_reference` ещё действительны.
- `src/content/bridge.ts` пересылает команды между попапом и страницей.
- `src/popup` — интерфейс (RU/EN через `chrome.i18n`).

## Ограничения

- Поддерживается только WebK (`/k/`). Расширение зависит от внутренних объектов tweb, поэтому может сломаться после обновлений Telegram Web.
- Архив собирается в памяти, а ZIP64 не поддерживается. Для больших каналов с медиа ограничивайте размер файлов и диапазон.
