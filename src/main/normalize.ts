import type {MediaKind} from '../shared/protocol';
import type {
  ExportAuthor,
  ExportEntity,
  ExportMedia,
  ExportMessage,
  ExportReaction,
  MediaDownload,
  MediaType
} from './model';
import {peerUsername, userName, type TL} from './tweb';

export interface PeerDirectory {
  users: Map<string, TL>;
  chats: Map<string, TL>;
  myId: number;
}

export function addPeers(dir: PeerDirectory, res: TL) {
  for(const user of res.users ?? []) dir.users.set(String(user.id), user);
  for(const chat of res.chats ?? []) dir.chats.set(String(chat.id), chat);
}

function peerToAuthor(dir: PeerDirectory, peer: TL): ExportAuthor | undefined {
  if(!peer) return undefined;
  if(peer._ === 'peerUser') {
    const user = dir.users.get(String(peer.user_id));
    return {id: 'user' + peer.user_id, name: userName(user) || 'Deleted Account', username: peerUsername(user)};
  }
  const chatId = peer.channel_id ?? peer.chat_id;
  const chat = dir.chats.get(String(chatId));
  return {
    id: (peer._ === 'peerChannel' ? 'channel' : 'chat') + chatId,
    name: chat?.title || String(chatId),
    username: peerUsername(chat)
  };
}

/** Telegram tweb PeerId -> TL Peer */
function peerIdToPeer(peerId: number): TL {
  return peerId > 0 ? {_: 'peerUser', user_id: peerId} : {_: 'peerChannel', channel_id: -peerId};
}

function resolveAuthor(dir: PeerDirectory, msg: TL): ExportAuthor | undefined {
  if(msg.from_id) return peerToAuthor(dir, msg.from_id);
  // Channel posts and incoming private messages have no from_id.
  if(msg.out) return peerToAuthor(dir, peerIdToPeer(dir.myId));
  return peerToAuthor(dir, msg.peer_id);
}

function convertEntities(entities: TL[] | undefined): ExportEntity[] {
  if(!entities?.length) return [];
  return entities.map((e) => {
    const name: string = e._.replace(/^messageEntity/, '');
    const out: ExportEntity = {
      type: name.charAt(0).toLowerCase() + name.slice(1),
      offset: e.offset,
      length: e.length
    };
    if(e.url) out.url = e.url;
    if(e.user_id !== undefined) out.user_id = String(e.user_id);
    if(e.language) out.language = e.language;
    if(e.document_id !== undefined) out.document_id = String(e.document_id);
    if(e.collapsed) out.collapsed = true;
    return out;
  });
}

function convertReactions(reactions: TL): ExportReaction[] | undefined {
  const results: TL[] | undefined = reactions?.results;
  if(!results?.length) return undefined;
  return results.map((r) => {
    const reaction = r.reaction;
    const out: ExportReaction = {count: r.count};
    if(reaction?._ === 'reactionEmoji') out.emoji = reaction.emoticon;
    else if(reaction?._ === 'reactionCustomEmoji') out.custom_emoji_id = String(reaction.document_id);
    else if(reaction?._ === 'reactionPaid') out.paid = true;
    return out;
  });
}

function textOf(value: TL): string {
  if(typeof value === 'string') return value;
  return value?.text ?? '';
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/flac': 'flac',
  'application/x-tgsticker': 'tgs',
  'application/pdf': 'pdf',
  'application/zip': 'zip'
};

function sanitizeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '_').slice(0, 120);
}

function documentType(doc: TL): MediaType {
  const attrs: TL[] = doc.attributes ?? [];
  const has = (type: string) => attrs.find((a) => a._ === type);
  if(has('documentAttributeSticker') || doc.mime_type === 'application/x-tgsticker') return 'sticker';
  const video = has('documentAttributeVideo');
  if(has('documentAttributeAnimated') && (video || doc.mime_type === 'image/gif')) return 'gif';
  if(video) return video.round_message ? 'round' : 'video';
  const audio = has('documentAttributeAudio');
  if(audio) return audio.voice ? 'voice' : 'audio';
  return 'file';
}

const TYPE_TO_KIND: Partial<Record<MediaType, MediaKind>> = {
  photo: 'photo',
  video: 'video',
  gif: 'video',
  round: 'video',
  voice: 'audio',
  audio: 'audio',
  file: 'file',
  sticker: 'sticker'
};

const KIND_DIR: Record<MediaKind, string> = {
  photo: 'photos',
  video: 'videos',
  audio: 'audio',
  file: 'files',
  sticker: 'stickers'
};

function largestPhotoSize(photo: TL): {type: string, size: number, w: number, h: number} | undefined {
  let best: {type: string, size: number, w: number, h: number} | undefined;
  for(const s of photo.sizes ?? []) {
    let size: number;
    if(s._ === 'photoSize') size = s.size;
    else if(s._ === 'photoSizeProgressive') size = Math.max(...s.sizes);
    else continue;
    if(!best || s.w * s.h > best.w * best.h) best = {type: s.type, size, w: s.w, h: s.h};
  }
  return best;
}

function describeMedia(msg: TL): {media?: ExportMedia, download?: MediaDownload} {
  const m = msg.media;
  if(!m || m._ === 'messageMediaEmpty') return {};

  switch(m._) {
    case 'messageMediaPhoto': {
      const photo = m.photo;
      if(!photo || photo._ !== 'photo') return {media: {type: 'photo', skipped: 'unavailable'}};
      const best = largestPhotoSize(photo);
      const media: ExportMedia = {type: 'photo', width: best?.w, height: best?.h, size: best?.size, mime_type: 'image/jpeg'};
      if(!best) return {media: {...media, skipped: 'unavailable'}};
      return {
        media,
        download: {
          kind: 'photo',
          dcId: photo.dc_id,
          size: best.size,
          path: `media/${KIND_DIR.photo}/photo_${msg.id}.jpg`,
          location: {
            _: 'inputPhotoFileLocation',
            id: photo.id,
            access_hash: photo.access_hash,
            file_reference: photo.file_reference,
            thumb_size: best.type
          }
        }
      };
    }

    case 'messageMediaDocument': {
      const doc = m.document;
      if(!doc || doc._ !== 'document') return {media: {type: 'file', skipped: 'unavailable'}};
      const type = documentType(doc);
      const attrs: TL[] = doc.attributes ?? [];
      const fileNameAttr = attrs.find((a) => a._ === 'documentAttributeFilename');
      const video = attrs.find((a) => a._ === 'documentAttributeVideo');
      const audio = attrs.find((a) => a._ === 'documentAttributeAudio');
      const image = attrs.find((a) => a._ === 'documentAttributeImageSize');
      const sticker = attrs.find((a) => a._ === 'documentAttributeSticker');
      const ext = MIME_EXT[doc.mime_type] ?? 'bin';
      const fileName = sanitizeFileName(fileNameAttr?.file_name || `${type}.${ext}`);

      const media: ExportMedia = {
        type,
        file_name: fileNameAttr?.file_name,
        mime_type: doc.mime_type,
        size: Number(doc.size),
        width: video?.w ?? image?.w,
        height: video?.h ?? image?.h,
        duration: video?.duration ?? audio?.duration,
        title: audio?.title,
        performer: audio?.performer,
        emoji: sticker?.alt || undefined
      };

      const kind = TYPE_TO_KIND[type]!;
      return {
        media,
        download: {
          kind,
          dcId: doc.dc_id,
          size: Number(doc.size),
          path: `media/${KIND_DIR[kind]}/${msg.id}_${fileName}`,
          location: {
            _: 'inputDocumentFileLocation',
            id: doc.id,
            access_hash: doc.access_hash,
            file_reference: doc.file_reference,
            thumb_size: ''
          }
        }
      };
    }

    case 'messageMediaWebPage': {
      const page = m.webpage;
      return {
        media: {
          type: 'webpage',
          url: page?.url,
          site_name: page?.site_name,
          title: page?.title,
          description: page?.description
        }
      };
    }

    case 'messageMediaPoll': {
      const voters = new Map<string, number>();
      for(const r of m.results?.results ?? []) voters.set(String(r.option), r.voters);
      return {
        media: {
          type: 'poll',
          question: textOf(m.poll?.question),
          answers: (m.poll?.answers ?? []).map((a: TL) => ({
            text: textOf(a.text),
            voters: voters.get(String(a.option))
          })),
          total_voters: m.results?.total_voters
        }
      };
    }

    case 'messageMediaGeo':
    case 'messageMediaGeoLive':
      return {media: {type: 'geo', latitude: m.geo?.lat, longitude: m.geo?.long}};

    case 'messageMediaVenue':
      return {
        media: {type: 'venue', latitude: m.geo?.lat, longitude: m.geo?.long, title: m.title, address: m.address}
      };

    case 'messageMediaContact':
      return {
        media: {type: 'contact', phone_number: m.phone_number, first_name: m.first_name, last_name: m.last_name}
      };

    case 'messageMediaDice':
      return {media: {type: 'dice', emoji: m.emoticon, value: m.value}};

    default:
      return {media: {type: 'other', raw_type: m._}};
  }
}

function serviceDetails(action: TL): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for(const [key, value] of Object.entries(action ?? {})) {
    if(key === '_' || key === 'flags' || key === 'pFlags') continue;
    if(['string', 'number', 'boolean'].includes(typeof value)) out[key] = value;
    else if(Array.isArray(value) && value.every((v) => typeof v !== 'object')) out[key] = value.map(String);
  }
  return Object.keys(out).length ? out : undefined;
}

export function normalizeMessage(dir: PeerDirectory, msg: TL): {message: ExportMessage, download?: MediaDownload} {
  const message: ExportMessage = {
    id: msg.id,
    type: msg._ === 'messageService' ? 'service' : 'message',
    date: msg.date,
    date_iso: new Date(msg.date * 1000).toISOString(),
    from: resolveAuthor(dir, msg),
    text: msg.message ?? '',
    entities: convertEntities(msg.entities)
  };

  if(msg.edit_date && !msg.edit_hide) message.edit_date = msg.edit_date;
  if(msg.post_author) message.post_author = msg.post_author;
  if(msg.grouped_id !== undefined) message.grouped_id = String(msg.grouped_id);
  if(msg.views !== undefined) message.views = msg.views;
  if(msg.forwards !== undefined) message.forwards = msg.forwards;
  const reactions = convertReactions(msg.reactions);
  if(reactions) message.reactions = reactions;

  if(message.type === 'service') {
    message.action = String(msg.action?._ ?? '').replace(/^messageAction/, '');
    message.action_details = serviceDetails(msg.action);
    return {message};
  }

  const {media, download} = describeMedia(msg);
  if(media) message.media = media;
  return {message, download};
}
