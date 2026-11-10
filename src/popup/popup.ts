import type {
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

const POLL_MS = 700;
const STORAGE_KEY = 'form';

const t = (key: string, subs?: string | string[]) => chrome.i18n.getMessage(key, subs) || key;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const locale: Locale = chrome.i18n.getUILanguage().toLowerCase().startsWith('ru') ? 'ru' : 'en';

const els = {
  title: $('chat-title'),
  kind: $('chat-kind'),
  message: $('message'),
  messageText: $('message-text'),
  openWebK: $('open-webk'),
  form: $<HTMLFormElement>('options'),
  lastCount: $<HTMLInputElement>('last-count'),
  dates: $('dates'),
  dateFrom: $<HTMLInputElement>('date-from'),
  dateTo: $<HTMLInputElement>('date-to'),
  maxSize: $<HTMLInputElement>('max-size'),
  formError: $('form-error'),
  start: $<HTMLButtonElement>('start'),
  progress: $('progress'),
  bar: document.querySelector<HTMLElement>('.bar')!,
  barFill: $('bar-fill'),
  status: $('status'),
  details: $('details'),
  bgHint: $('bg-hint'),
  cancel: $<HTMLButtonElement>('cancel'),
  reset: $<HTMLButtonElement>('reset')
};

let tabId: number | undefined;

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

function updateFormState() {
  const {range} = readForm();
  els.dates.classList.toggle('disabled', range !== 'dates');
  els.lastCount.disabled = range !== 'last';
}

const parseDay = (value: string, nextDay = false) => {
  if(!value) return 0;
  const [y, m, d] = value.split('-').map(Number);
  return Math.floor(new Date(y, m - 1, d + (nextDay ? 1 : 0)).getTime() / 1000);
};

function buildOptions(form: StoredForm): ExportOptions | string {
  if(!form.formats.length) return t('noFormat');

  let range: ExportRange;
  if(form.range === 'last') {
    range = {mode: 'last', count: form.lastCount};
  } else if(form.range === 'dates') {
    const from = parseDay(form.from);
    const to = parseDay(form.to, true);
    if((!from && !to) || (from && to && from >= to)) return t('badRange');
    range = {mode: 'dates', from, to};
  } else {
    range = {mode: 'all'};
  }

  return {range, formats: form.formats, media: form.media, maxFileSizeMb: form.maxSize, locale};
}

els.form.addEventListener('change', () => {
  updateFormState();
  els.formError.hidden = true;
  void chrome.storage.local.set({[STORAGE_KEY]: readForm()});
});

els.form.addEventListener('submit', async(event) => {
  event.preventDefault();
  const options = buildOptions(readForm());
  if(typeof options === 'string') {
    showFormError(options);
    return;
  }

  els.start.disabled = true;
  try {
    render(await send({type: 'start', options}));
  } catch(err) {
    showFormError(errorText(err));
  } finally {
    els.start.disabled = false;
  }
});

els.cancel.addEventListener('click', async() => {
  els.cancel.disabled = true;
  render(await send({type: 'cancel'}));
});

els.reset.addEventListener('click', async() => {
  render(await send({type: 'reset'}));
});

function showFormError(text: string) {
  els.formError.textContent = text;
  els.formError.hidden = false;
}

function errorText(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if(message === 'NOT_READY') return t('notReady');
  if(message === 'NO_CHAT') return t('noChat');
  return message;
}

// ---------- rendering ----------

function showMessage(text: string, withLink = false) {
  els.message.hidden = false;
  els.messageText.textContent = text;
  els.openWebK.hidden = !withLink;
  els.form.hidden = true;
  els.progress.hidden = true;
}

function formatBytes(bytes: number) {
  if(bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if(bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function renderJob(job: JobState) {
  els.message.hidden = true;
  els.form.hidden = true;
  els.progress.hidden = false;

  const running = job.status === 'running';
  els.cancel.hidden = !running;
  els.cancel.disabled = false;
  els.reset.hidden = running;
  els.bgHint.hidden = !running;

  let percent: number | undefined;
  if(job.status === 'done' || job.phase === 'packing') percent = 100;
  else if(job.messagesTotal) percent = Math.min(100, (job.messagesFetched / job.messagesTotal) * 100);
  els.bar.classList.toggle('indeterminate', running && percent === undefined);
  els.barFill.style.width = percent === undefined ? '' : `${percent}%`;

  switch(job.status) {
    case 'running':
      els.status.textContent = t(`phase_${job.phase}`);
      break;
    case 'done':
      els.status.textContent = t('status_done');
      break;
    case 'cancelled':
      els.status.textContent = t('status_cancelled');
      break;
    case 'error':
      els.status.textContent = t('status_error', job.error ?? '');
      break;
  }

  const total = job.messagesTotal !== undefined ? ` / ${job.messagesTotal}` : '';
  const details = [t('progressMessages', `${job.messagesFetched}${total}`)];
  if(job.mediaDone || job.mediaFailed) {
    let media = t('progressMedia', `${job.mediaDone} (${formatBytes(job.bytes)})`);
    if(job.mediaFailed) media += `, ${t('progressFailed', String(job.mediaFailed))}`;
    details.push(media);
  }
  if(job.fileName && job.status === 'done') details.push(job.fileName);
  els.details.textContent = details.join(' · ');
}

function render(state: PageState) {
  const chat = state.job?.chat ?? state.chat;
  if(chat) {
    els.title.textContent = chat.title;
    els.kind.textContent = t(`kind_${chat.kind}`) + (chat.username ? ` · @${chat.username}` : '');
  }

  if(state.job) {
    renderJob(state.job);
    return;
  }

  if(!state.ready) {
    showMessage(t('notReady'));
    return;
  }

  if(!state.chat) {
    els.title.textContent = t('extName');
    els.kind.textContent = '';
    showMessage(t('noChat'));
    return;
  }

  els.message.hidden = true;
  els.progress.hidden = true;
  els.form.hidden = false;
}

async function poll() {
  try {
    render(await send({type: 'getState'}));
  } catch {
    showMessage(t('connectError'));
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
    showMessage(t('notTelegram'), true);
    return;
  }

  if(!url.pathname.startsWith('/k')) {
    showMessage(t('wrongVersion'), true);
    return;
  }

  tabId = tab.id;
  await poll();
}

void init();
