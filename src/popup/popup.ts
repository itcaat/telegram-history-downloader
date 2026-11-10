import type {
  ChatInfo,
  Command,
  ExportFormat,
  ExportOptions,
  ExportRange,
  JobState,
  Locale,
  MediaKind,
  PageState,
  Reply,
  RuntimeRequest
} from '../shared/protocol';

interface StoredForm {
  range: 'all' | 'last' | 'dates';
  lastCount: number;
  from: string;
  to: string;
  formats: ExportFormat[];
  media: MediaKind[];
  maxSize: number;
}

type MessageKind = 'notTelegram' | 'wrongVersion' | 'notReady' | 'noChat' | 'connectError';

const POLL_MS = 700;
const STORAGE_KEY = 'form';

const FORMAT_NAMES: Record<ExportFormat, string> = {html: 'HTML', json: 'JSON', md: 'Markdown'};

const MESSAGE_ICONS: Record<MessageKind, string> = {
  notTelegram: 'i-telegram',
  wrongVersion: 'i-telegram',
  notReady: 'i-clock',
  noChat: 'i-chat',
  connectError: 'i-plug'
};

const STATUS_ICONS: Partial<Record<JobState['status'], string>> = {
  done: 'i-check',
  error: 'i-x',
  cancelled: 'i-stop'
};

// Telegram avatar palette
const AVATAR_COLORS: [string, string][] = [
  ['#ff885e', '#ff516a'],
  ['#ffcd6a', '#ffa85c'],
  ['#82b1ff', '#665fff'],
  ['#a0de7e', '#54cb68'],
  ['#53edd6', '#28c9b7'],
  ['#72d5fd', '#2a9ef1'],
  ['#e0a2f3', '#d669ed']
];

const t = (key: string, subs?: string | string[]) => chrome.i18n.getMessage(key, subs) || key;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const locale: Locale = chrome.i18n.getUILanguage().toLowerCase().startsWith('ru') ? 'ru' : 'en';
const numberFormat = new Intl.NumberFormat(locale);
const fmtNum = (n: number) => numberFormat.format(n);
const iconHtml = (id: string) => `<svg class="icon"><use href="#${id}"/></svg>`;

const els = {
  avatar: $('avatar'),
  title: $('chat-title'),
  kind: $('chat-kind'),
  loading: $('loading'),
  message: $('message'),
  messageIcon: $('message-icon'),
  messageTitle: $('message-title'),
  messageText: $('message-text'),
  openWebK: $('open-webk'),
  form: $<HTMLFormElement>('options'),
  lastExtra: $('last-extra'),
  lastCount: $<HTMLInputElement>('last-count'),
  dates: $('dates'),
  dateFrom: $<HTMLInputElement>('date-from'),
  dateTo: $<HTMLInputElement>('date-to'),
  formats: $('formats'),
  sizeExtra: $('size-extra'),
  maxSize: $<HTMLInputElement>('max-size'),
  formError: $('form-error'),
  start: $<HTMLButtonElement>('start'),
  startLabel: $('start-label'),
  progress: $('progress'),
  statusIcon: $('status-icon'),
  status: $('status'),
  elapsed: $('elapsed'),
  percent: $('percent'),
  bar: $('bar'),
  barFill: $('bar-fill'),
  statMessages: $('stat-messages'),
  statMedia: $('stat-media'),
  statSkippedWrap: $('stat-skipped-wrap'),
  statSkipped: $('stat-skipped'),
  statFailedWrap: $('stat-failed-wrap'),
  statFailed: $('stat-failed'),
  errorText: $('error-text'),
  fileName: $('file-name'),
  bgHint: $('bg-hint'),
  cancel: $<HTMLButtonElement>('cancel'),
  reset: $<HTMLButtonElement>('reset')
};

let tabId: number | undefined;
let lastStatus: JobState['status'] | undefined;
let headerKey: string | undefined;

// ---------- i18n ----------

for(const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
  el.textContent = t(el.dataset.i18n!);
}
document.documentElement.lang = locale;

// ---------- messaging ----------

async function injectScripts(id: number) {
  await chrome.scripting.executeScript({target: {tabId: id}, files: ['content/bridge.js']});
  await chrome.scripting.executeScript({target: {tabId: id}, files: ['content/main.js'], world: 'MAIN'});
}

async function sendRaw(command: Command): Promise<Reply> {
  const request: RuntimeRequest = {target: 'tgdl', command};
  return chrome.tabs.sendMessage(tabId!, request);
}

async function send(command: Command): Promise<PageState> {
  let reply: Reply | undefined;
  try {
    reply = await sendRaw(command);
  } catch {
    // Content scripts are missing (e.g. the tab was opened before the extension was installed).
    await injectScripts(tabId!);
    reply = await sendRaw(command);
  }

  if(reply?.error === 'MAIN_TIMEOUT') {
    await injectScripts(tabId!);
    reply = await sendRaw(command);
  }

  if(!reply) throw new Error('NO_REPLY');
  if(reply.error) throw new Error(reply.error);
  return reply.result!;
}

// ---------- form ----------

function readForm(): StoredForm {
  const checked = (name: string) =>
    [...els.form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map((i) => i.value);

  return {
    range: (checked('range')[0] ?? 'all') as StoredForm['range'],
    lastCount: Math.max(1, Math.floor(Number(els.lastCount.value) || 0)),
    from: els.dateFrom.value,
    to: els.dateTo.value,
    formats: checked('format') as ExportFormat[],
    media: checked('media') as MediaKind[],
    maxSize: Math.max(0, Math.floor(Number(els.maxSize.value) || 0))
  };
}

function writeForm(form: Partial<StoredForm>) {
  const setChecked = (name: string, values: string[]) => {
    for(const input of els.form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)) {
      input.checked = values.includes(input.value);
    }
  };

  if(form.range) setChecked('range', [form.range]);
  if(form.lastCount) els.lastCount.value = String(form.lastCount);
  if(form.from !== undefined) els.dateFrom.value = form.from;
  if(form.to !== undefined) els.dateTo.value = form.to;
  if(form.formats) setChecked('format', form.formats);
  if(form.media) setChecked('media', form.media);
  if(form.maxSize !== undefined) els.maxSize.value = String(form.maxSize);
  updateFormState();
}

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function updateFormState() {
  const form = readForm();
  els.lastExtra.hidden = form.range !== 'last';
  els.dates.hidden = form.range !== 'dates';
  els.sizeExtra.hidden = !form.media.length;

  const today = toInputDate(new Date());
  els.dateFrom.max = form.to || today;
  els.dateTo.min = form.from;
  els.dateTo.max = today;

  els.startLabel.textContent = startLabel(form);
}

function startLabel(form: StoredForm) {
  if(!form.formats.length) return t('download');
  if(form.media.length || form.formats.length > 1) return t('downloadAs', 'ZIP');
  return t('downloadAs', FORMAT_NAMES[form.formats[0]]);
}

const parseDay = (value: string, nextDay = false) => {
  if(!value) return 0;
  const [y, m, d] = value.split('-').map(Number);
  return Math.floor(new Date(y, m - 1, d + (nextDay ? 1 : 0)).getTime() / 1000);
};

interface FormError {
  text: string;
  invalid: HTMLElement[];
}

function buildOptions(form: StoredForm): ExportOptions | FormError {
  if(!form.formats.length) return {text: t('noFormat'), invalid: [els.formats]};

  let range: ExportRange;
  if(form.range === 'last') {
    range = {mode: 'last', count: form.lastCount};
  } else if(form.range === 'dates') {
    const from = parseDay(form.from);
    const to = parseDay(form.to, true);
    if(!from && !to) return {text: t('noDates'), invalid: [els.dateFrom, els.dateTo]};
    if(from && to && from >= to) return {text: t('badRange'), invalid: [els.dateFrom, els.dateTo]};
    range = {mode: 'dates', from, to};
  } else {
    range = {mode: 'all'};
  }

  return {range, formats: form.formats, media: form.media, maxFileSizeMb: form.maxSize, locale};
}

function clearFormError() {
  els.formError.hidden = true;
  els.formats.classList.remove('invalid');
  for(const input of els.form.querySelectorAll('[aria-invalid]')) input.removeAttribute('aria-invalid');
}

function showFormError(error: FormError) {
  clearFormError();
  els.formError.textContent = error.text;
  els.formError.hidden = false;

  for(const el of error.invalid) {
    if(el instanceof HTMLInputElement) el.setAttribute('aria-invalid', 'true');
    else el.classList.add('invalid');
  }

  const first = error.invalid[0];
  const focusTarget = first instanceof HTMLInputElement ? first : first?.querySelector('input');
  focusTarget?.focus();
}

els.form.addEventListener('change', (event) => {
  updateFormState();
  clearFormError();
  void chrome.storage.local.set({[STORAGE_KEY]: readForm()});

  // Move focus to the field that has just been revealed.
  const target = event.target as HTMLInputElement;
  if(target.name === 'range' && target.checked) {
    if(target.value === 'last') els.lastCount.focus();
    else if(target.value === 'dates') els.dateFrom.focus();
  }
});

els.form.addEventListener('submit', async(event) => {
  event.preventDefault();
  const options = buildOptions(readForm());
  if('text' in options) {
    showFormError(options);
    return;
  }

  setBusy(els.start, true);
  try {
    render(await send({type: 'start', options}));
  } catch(err) {
    showFormError({text: errorText(err), invalid: []});
  } finally {
    setBusy(els.start, false);
  }
});

els.cancel.addEventListener('click', () => runAction(els.cancel, {type: 'cancel'}));
els.reset.addEventListener('click', () => runAction(els.reset, {type: 'reset'}));

async function runAction(button: HTMLButtonElement, command: Command) {
  setBusy(button, true);
  try {
    render(await send(command));
  } catch(err) {
    els.errorText.textContent = errorText(err);
    els.errorText.hidden = false;
  } finally {
    setBusy(button, false);
  }
}

function setBusy(button: HTMLButtonElement, busy: boolean) {
  button.disabled = busy;
  button.classList.toggle('busy', busy);
  button.setAttribute('aria-busy', String(busy));
}

function errorText(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if(message === 'NOT_READY') return t('notReady');
  if(message === 'NO_CHAT') return t('noChat');
  return message;
}

// ---------- rendering ----------

type View = 'loading' | 'message' | 'form' | 'progress';

function showView(view: View) {
  els.loading.hidden = view !== 'loading';
  els.message.hidden = view !== 'message';
  els.form.hidden = view !== 'form';
  els.progress.hidden = view !== 'progress';
}

function showMessage(kind: MessageKind) {
  showView('message');
  els.messageIcon.innerHTML = iconHtml(MESSAGE_ICONS[kind]);
  els.messageIcon.classList.toggle('danger', kind === 'connectError');
  els.messageTitle.textContent = t(`${kind}Title`);
  els.messageText.textContent = t(kind);
  els.openWebK.hidden = kind !== 'notTelegram' && kind !== 'wrongVersion';
}

function initials(title: string) {
  const words = title.trim().split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w));
  return words.slice(0, 2).map((w) => [...w.replace(/[^\p{L}\p{N}]/gu, '')][0] ?? '').join('').toUpperCase();
}

function renderHeader(chat: ChatInfo | null) {
  const key = chat ? `${chat.peerId}|${chat.title}|${chat.kind}|${chat.username ?? ''}` : '';
  if(key === headerKey) return;
  headerKey = key;

  if(!chat) {
    els.title.textContent = t('appName');
    els.kind.textContent = '';
    els.kind.hidden = true;
    els.avatar.style.removeProperty('--c1');
    els.avatar.style.removeProperty('--c2');
    els.avatar.innerHTML = iconHtml('i-telegram');
    return;
  }

  els.title.textContent = chat.title;
  els.title.title = chat.title;
  els.kind.textContent = t(`kind_${chat.kind}`) + (chat.username ? ` · @${chat.username}` : '');
  els.kind.hidden = false;

  const [c1, c2] = chat.kind === 'saved' ?
    AVATAR_COLORS[5] :
    AVATAR_COLORS[Math.abs(chat.peerId) % AVATAR_COLORS.length];
  els.avatar.style.setProperty('--c1', c1);
  els.avatar.style.setProperty('--c2', c2);

  const text = chat.kind === 'saved' ? '' : initials(chat.title);
  if(text) els.avatar.textContent = text;
  else els.avatar.innerHTML = iconHtml(chat.kind === 'saved' ? 'i-bookmark' : 'i-chat');
}

function formatBytes(bytes: number) {
  if(bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ${t('kb')}`;
  if(bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} ${t('mb')}`;
  return `${(bytes / 1024 ** 3).toFixed(2)} ${t('gb')}`;
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function renderJob(job: JobState) {
  showView('progress');

  const running = job.status === 'running';
  els.cancel.hidden = !running;
  els.reset.hidden = running;
  els.reset.textContent = t(job.status === 'done' ? 'newExport' : 'backToSettings');
  els.bgHint.hidden = !running;

  if(job.status !== lastStatus) {
    els.statusIcon.dataset.status = job.status;
    els.statusIcon.innerHTML = STATUS_ICONS[job.status] ? iconHtml(STATUS_ICONS[job.status]!) : '';
    els.bar.dataset.status = job.status;
    els.errorText.hidden = true;
    // Keep keyboard focus on a visible action when the job finishes.
    if(lastStatus === 'running' && document.activeElement === els.cancel) els.reset.focus();
    lastStatus = job.status;
  }

  let percent: number | undefined;
  if(job.status === 'done' || job.phase === 'packing') percent = 100;
  else if(job.messagesTotal) percent = Math.min(100, (job.messagesFetched / job.messagesTotal) * 100);

  els.bar.classList.toggle('indeterminate', running && percent === undefined);
  els.barFill.style.width = percent === undefined ? '' : `${percent}%`;
  if(percent === undefined) {
    els.bar.removeAttribute('aria-valuenow');
    els.percent.textContent = '';
  } else {
    els.bar.setAttribute('aria-valuenow', String(Math.round(percent)));
    els.percent.textContent = running && job.phase === 'messages' ? `${Math.floor(percent)}%` : '';
  }

  els.status.textContent = running ? t(`phase_${job.phase}`) : t(`status_${job.status}`);
  els.elapsed.textContent = t(running ? 'elapsed' : 'tookTime', formatDuration((job.finishedAt ?? Date.now()) - job.startedAt));

  els.statMessages.textContent = fmtNum(job.messagesFetched) +
    (job.messagesTotal !== undefined ? ` / ${fmtNum(job.messagesTotal)}` : '');
  els.statMedia.textContent = job.mediaDone ?
    `${fmtNum(job.mediaDone)} · ${formatBytes(job.bytes)}` :
    '0';
  els.statSkippedWrap.hidden = !job.mediaSkipped;
  els.statSkipped.textContent = fmtNum(job.mediaSkipped);
  els.statFailedWrap.hidden = !job.mediaFailed;
  els.statFailed.textContent = fmtNum(job.mediaFailed);

  if(job.status === 'error') {
    els.errorText.textContent = job.error ?? t('unknownError');
    els.errorText.hidden = false;
  }

  els.fileName.hidden = !(job.status === 'done' && job.fileName);
  if(job.fileName) els.fileName.textContent = t('savedAs', job.fileName);
}

function render(state: PageState) {
  renderHeader(state.job?.chat ?? state.chat);

  if(state.job) {
    renderJob(state.job);
    return;
  }

  lastStatus = undefined;

  if(!state.ready) {
    showMessage('notReady');
    return;
  }

  if(!state.chat) {
    showMessage('noChat');
    return;
  }

  showView('form');
}

async function poll() {
  try {
    render(await send({type: 'getState'}));
  } catch {
    renderHeader(null);
    showMessage('connectError');
  }
  setTimeout(poll, POLL_MS);
}

// ---------- init ----------

async function init() {
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as Partial<StoredForm> | undefined;
  writeForm(stored ?? {});

  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  const url = tab?.url ? new URL(tab.url) : undefined;

  if(!tab?.id || url?.hostname !== 'web.telegram.org') {
    showMessage('notTelegram');
    return;
  }

  if(!url.pathname.startsWith('/k')) {
    showMessage('wrongVersion');
    return;
  }

  tabId = tab.id;
  await poll();
}

void init();
