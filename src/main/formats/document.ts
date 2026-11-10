import type {ChatInfo, ExportRange, Locale} from '../../shared/protocol';
import type {ExportMessage, ExportReaction} from '../model';

export interface ExportDocument {
  chat: ChatInfo;
  exportedAt: number;
  range: ExportRange;
  locale: Locale;
  /** Chronological order */
  messages: ExportMessage[];
}

const localeTag = (locale: Locale) => locale === 'ru' ? 'ru-RU' : 'en-US';

export function formatDay(ts: number, locale: Locale) {
  return new Date(ts * 1000).toLocaleDateString(localeTag(locale), {year: 'numeric', month: 'long', day: 'numeric'});
}

export function formatTime(ts: number, locale: Locale) {
  return new Date(ts * 1000).toLocaleTimeString(localeTag(locale), {hour: '2-digit', minute: '2-digit'});
}

export function formatDateTime(ts: number, locale: Locale) {
  return new Date(ts * 1000).toLocaleString(localeTag(locale));
}

export function dayKey(ts: number) {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatBytes(bytes: number) {
  if(bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    ++unit;
  } while(value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function reactionLabel(r: ExportReaction) {
  if(r.emoji) return r.emoji;
  if(r.paid) return '⭐';
  return '★';
}
