export type ExportFormat = 'json' | 'html' | 'md';
export type MediaKind = 'photo' | 'video' | 'audio' | 'file' | 'sticker';
export type Locale = 'ru' | 'en';

export type ExportRange =
  | {mode: 'all'}
  | {mode: 'last', count: number}
  /** Unix timestamps in seconds: `from` inclusive, `to` exclusive. 0 = unbounded. */
  | {mode: 'dates', from: number, to: number};

export interface ExportOptions {
  range: ExportRange;
  formats: ExportFormat[];
  media: MediaKind[];
  /** 0 = no limit */
  maxFileSizeMb: number;
  locale: Locale;
}

export type ChatKind = 'user' | 'bot' | 'group' | 'channel' | 'saved';

export interface ChatInfo {
  peerId: number;
  title: string;
  kind: ChatKind;
  username?: string;
}

export type JobStatus = 'running' | 'done' | 'error' | 'cancelled';
export type JobPhase = 'messages' | 'packing';

export interface JobState {
  status: JobStatus;
  phase: JobPhase;
  chat: ChatInfo;
  messagesFetched: number;
  /** Unknown for date ranges */
  messagesTotal?: number;
  mediaDone: number;
  mediaFailed: number;
  mediaSkipped: number;
  bytes: number;
  error?: string;
  fileName?: string;
  startedAt: number;
  finishedAt?: number;
}

export interface PageState {
  ready: boolean;
  chat: ChatInfo | null;
  job: JobState | null;
}

export type Command =
  | {type: 'getState'}
  | {type: 'start', options: ExportOptions}
  | {type: 'cancel'}
  | {type: 'reset'};

/** popup -> bridge (chrome.runtime) */
export interface RuntimeRequest {
  target: 'tgdl';
  command: Command;
}

export interface Reply {
  result?: PageState;
  error?: string;
}

/** bridge <-> MAIN world (window.postMessage) */
export const BRIDGE_SOURCE = 'tgdl-bridge';
export const MAIN_SOURCE = 'tgdl-main';

export interface BridgeToMain {
  source: typeof BRIDGE_SOURCE;
  id: string;
  command: Command;
}

export interface MainToBridge extends Reply {
  source: typeof MAIN_SOURCE;
  id: string;
}
