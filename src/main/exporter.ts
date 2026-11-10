import type {ChatInfo, ExportFormat, ExportOptions, JobState} from '../shared/protocol';
import type {ExportDocument} from './formats/document';
import {toHtml} from './formats/html';
import {toJson} from './formats/json';
import {toMarkdown} from './formats/markdown';
import type {ExportMessage, MediaDownload} from './model';
import {addPeers, normalizeMessage, type PeerDirectory} from './normalize';
import {describeError, getManagers, getMyId, invokeApi, sleep, type TL} from './tweb';
import {ZipWriter} from './zip';

const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 350;
const MEDIA_CONCURRENCY = 3;

const FORMAT_FILES: Record<ExportFormat, {file: string, mime: string, render: (doc: ExportDocument) => string}> = {
  json: {file: 'messages.json', mime: 'application/json', render: toJson},
  html: {file: 'messages.html', mime: 'text/html', render: toHtml},
  md: {file: 'messages.md', mime: 'text/markdown', render: toMarkdown}
};

class CancelledError extends Error {
  constructor() {
    super('cancelled');
  }
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'telegram';
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export class ExportJob {
  readonly state: JobState;
  private cancelled = false;
  private zip?: ZipWriter;

  constructor(chat: ChatInfo, private readonly options: ExportOptions) {
    this.state = {
      status: 'running',
      phase: 'messages',
      chat,
      messagesFetched: 0,
      mediaDone: 0,
      mediaFailed: 0,
      mediaSkipped: 0,
      bytes: 0,
      startedAt: Date.now()
    };
  }

  cancel() {
    this.cancelled = true;
  }

  async run() {
    try {
      await this.export();
      this.state.status = 'done';
    } catch(err) {
      this.zip?.terminate();
      if(err instanceof CancelledError) {
        this.state.status = 'cancelled';
      } else {
        console.error('[tgdl] export failed', err);
        this.state.status = 'error';
        this.state.error = describeError(err);
      }
    } finally {
      this.state.finishedAt = Date.now();
      this.zip = undefined;
    }
  }

  private checkCancelled() {
    if(this.cancelled) throw new CancelledError();
  }

  private async export() {
    const {options, state} = this;
    const {chat} = state;
    const needZip = options.media.length > 0 || options.formats.length > 1;
    if(needZip) this.zip = new ZipWriter();

    const messages = await this.fetchMessages();
    messages.reverse();

    this.checkCancelled();
    state.phase = 'packing';

    const doc: ExportDocument = {
      chat,
      exportedAt: Date.now(),
      range: options.range,
      locale: options.locale,
      messages
    };

    const date = new Date().toISOString().slice(0, 10);
    const baseName = `${safeFileName(chat.title)}_${date}`;

    if(this.zip) {
      for(const format of options.formats) {
        this.zip.addText(FORMAT_FILES[format].file, FORMAT_FILES[format].render(doc));
        // Let the event loop breathe between big renders.
        await sleep(0);
      }
      const blob = await this.zip.finish();
      state.fileName = `${baseName}.zip`;
      saveBlob(blob, state.fileName);
    } else {
      const format = FORMAT_FILES[options.formats[0]];
      state.fileName = `${baseName}.${options.formats[0]}`;
      saveBlob(new Blob([format.render(doc)], {type: format.mime + ';charset=utf-8'}), state.fileName);
    }
  }

  /** Returns messages newest-first */
  private async fetchMessages(): Promise<ExportMessage[]> {
    const {options, state} = this;
    const {range} = options;
    const inputPeer = await getManagers().appPeersManager.getInputPeerById(state.chat.peerId);
    const dir: PeerDirectory = {users: new Map(), chats: new Map(), myId: getMyId()};

    const limit = range.mode === 'last' ? range.count : Infinity;
    const fromTs = range.mode === 'dates' ? range.from : 0;
    let offsetDate = range.mode === 'dates' ? range.to : 0;
    let offsetId = 0;

    const collected: ExportMessage[] = [];

    for(;;) {
      this.checkCancelled();

      const res = await invokeApi('messages.getHistory', {
        peer: inputPeer,
        offset_id: offsetId,
        offset_date: offsetDate,
        add_offset: 0,
        limit: PAGE_SIZE,
        max_id: 0,
        min_id: 0,
        hash: 0
      });

      if(res._ === 'messages.messagesNotModified') break;
      addPeers(dir, res);

      const raw: TL[] = res.messages ?? [];
      if(state.messagesTotal === undefined && range.mode !== 'dates') {
        const count = res.count ?? raw.length;
        state.messagesTotal = Math.min(count, limit);
      }

      let reachedEnd = !raw.length || res._ === 'messages.messages';
      const downloads: {message: ExportMessage, download: MediaDownload}[] = [];

      for(const msg of raw) {
        if(msg._ === 'messageEmpty') continue;
        if(collected.length >= limit || (fromTs && msg.date < fromTs)) {
          reachedEnd = true;
          break;
        }
        const {message, download} = normalizeMessage(dir, msg);
        collected.push(message);
        if(download) downloads.push({message, download});
      }
      if(collected.length >= limit) reachedEnd = true;

      // Media is downloaded page by page, while file references are still fresh.
      await this.downloadMedia(downloads);
      state.messagesFetched = collected.length;

      if(reachedEnd) break;
      offsetId = raw[raw.length - 1].id;
      offsetDate = 0;
      await sleep(PAGE_DELAY_MS);
    }

    if(state.messagesTotal !== undefined) state.messagesTotal = collected.length;
    return collected;
  }

  private async downloadMedia(items: {message: ExportMessage, download: MediaDownload}[]) {
    const {options, state} = this;
    const maxBytes = options.maxFileSizeMb > 0 ? options.maxFileSizeMb * 1024 * 1024 : Infinity;

    const queue = items.filter(({message, download}) => {
      const media = message.media!;
      if(!this.zip || !options.media.includes(download.kind)) {
        media.skipped = 'not_selected';
        return false;
      }
      if(download.size > maxBytes) {
        media.skipped = 'too_large';
        ++state.mediaSkipped;
        return false;
      }
      return true;
    });

    const worker = async() => {
      for(let item = queue.shift(); item; item = queue.shift()) {
        this.checkCancelled();
        const {message, download} = item;
        try {
          const blob = await getManagers().apiFileManager.download({
            dcId: download.dcId,
            location: download.location,
            size: download.size,
            // octet-stream disables WebK's conversions (tgs -> json, webp -> png, opus -> wav)
            mimeType: 'application/octet-stream'
          });
          this.checkCancelled();
          const data = new Uint8Array(await blob.arrayBuffer());
          message.media!.file = this.zip!.addBinary(download.path, data);
          state.bytes += data.byteLength;
          ++state.mediaDone;
        } catch(err) {
          if(err instanceof CancelledError) throw err;
          console.warn('[tgdl] media download failed', message.id, err);
          message.media!.skipped = 'failed';
          ++state.mediaFailed;
        }
      }
    };

    await Promise.all(Array.from({length: Math.min(MEDIA_CONCURRENCY, queue.length)}, worker));
  }
}
