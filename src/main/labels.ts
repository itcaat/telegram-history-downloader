import type {Locale} from '../shared/protocol';
import type {MediaType, SkipReason} from './model';

const ru = {
  media: {
    photo: 'Фото', video: 'Видео', gif: 'GIF', round: 'Видеосообщение', voice: 'Голосовое сообщение',
    audio: 'Аудио', sticker: 'Стикер', file: 'Файл', webpage: 'Ссылка', poll: 'Опрос', geo: 'Геопозиция',
    venue: 'Место', contact: 'Контакт', dice: 'Кубик', other: 'Вложение'
  } satisfies Record<MediaType, string>,
  skipped: {
    not_selected: 'не скачано', too_large: 'слишком большой файл', failed: 'ошибка загрузки', unavailable: 'недоступно'
  } satisfies Record<SkipReason, string>,
  exportedAt: 'Экспортировано',
  messages: 'Сообщений',
  views: 'просмотров',
  forwards: 'пересылок',
  edited: 'изменено',
  service: 'Служебное сообщение',
  voters: 'голосов'
};

const en: typeof ru = {
  media: {
    photo: 'Photo', video: 'Video', gif: 'GIF', round: 'Video message', voice: 'Voice message',
    audio: 'Audio', sticker: 'Sticker', file: 'File', webpage: 'Link', poll: 'Poll', geo: 'Location',
    venue: 'Venue', contact: 'Contact', dice: 'Dice', other: 'Attachment'
  },
  skipped: {
    not_selected: 'not downloaded', too_large: 'file too large', failed: 'download failed', unavailable: 'unavailable'
  },
  exportedAt: 'Exported',
  messages: 'Messages',
  views: 'views',
  forwards: 'forwards',
  edited: 'edited',
  service: 'Service message',
  voters: 'votes'
};

export type Labels = typeof ru;

export const getLabels = (locale: Locale): Labels => locale === 'ru' ? ru : en;
