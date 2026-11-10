import type {MediaKind} from '../shared/protocol';

export interface ExportEntity {
  /** `messageEntityTextUrl` -> `textUrl` */
  type: string;
  offset: number;
  length: number;
  url?: string;
  user_id?: string;
  language?: string;
  document_id?: string;
  collapsed?: boolean;
}

export type MediaType =
  | 'photo' | 'video' | 'gif' | 'round' | 'voice' | 'audio' | 'sticker' | 'file'
  | 'webpage' | 'poll' | 'geo' | 'venue' | 'contact' | 'dice' | 'other';

export type SkipReason = 'not_selected' | 'too_large' | 'failed' | 'unavailable';

export interface ExportMedia {
  type: MediaType;
  /** Relative path inside the export, when downloaded */
  file?: string;
  skipped?: SkipReason;
  file_name?: string;
  mime_type?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  title?: string;
  performer?: string;
  emoji?: string;
  // webpage
  url?: string;
  site_name?: string;
  description?: string;
  // poll
  question?: string;
  answers?: {text: string, voters?: number}[];
  total_voters?: number;
  // geo / venue
  latitude?: number;
  longitude?: number;
  address?: string;
  // contact
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  // dice
  value?: number;
  /** Raw TL constructor for `other` */
  raw_type?: string;
}

export interface ExportReaction {
  emoji?: string;
  custom_emoji_id?: string;
  paid?: boolean;
  count: number;
}

export interface ExportAuthor {
  id: string;
  name: string;
  username?: string;
}

export interface ExportMessage {
  id: number;
  type: 'message' | 'service';
  date: number;
  date_iso: string;
  edit_date?: number;
  from?: ExportAuthor;
  post_author?: string;
  text: string;
  entities: ExportEntity[];
  media?: ExportMedia;
  grouped_id?: string;
  views?: number;
  forwards?: number;
  reactions?: ExportReaction[];
  /** For service messages: action type without the `messageAction` prefix */
  action?: string;
  action_details?: Record<string, unknown>;
}

/** What is needed to download a file through apiFileManager */
export interface MediaDownload {
  kind: MediaKind;
  dcId: number;
  location: object;
  size: number;
  /** Relative path inside the export */
  path: string;
}
