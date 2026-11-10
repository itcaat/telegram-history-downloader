import {getLabels, type Labels} from '../labels';
import type {ExportEntity, ExportMedia, ExportMessage} from '../model';
import {
  dayKey,
  formatBytes,
  formatDateTime,
  formatDay,
  formatDuration,
  formatTime,
  reactionLabel,
  type ExportDocument
} from './document';
import {renderEntities, type EntityRenderer} from './entities';

const escapeMd = (s: string) => s.replace(/([\\`*_~[\]<>|])/g, '\\$1');

/** Markdown hard line breaks inside a paragraph */
const breakLines = (s: string) => s.replace(/\n/g, '  \n');

/** Encodes characters that would break a `[text](url)` link target */
const mdUrl = (url: string) => url.trim().replace(/[()\s<>]/g, (c) => encodeURIComponent(c));

/** `**  text **` is not valid emphasis, so surrounding whitespace is moved outside of the markers. */
function emphasize(inner: string, left: string, right = left) {
  const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  if(!m[2]) return inner;
  return m[1] + left + m[2] + right + m[3];
}

function inlineCode(raw: string) {
  const longest = Math.max(0, ...(raw.match(/`+/g) ?? []).map((s) => s.length));
  const fence = '`'.repeat(longest + 1);
  const pad = raw.startsWith('`') || raw.endsWith('`') ? ' ' : '';
  return fence + pad + raw + pad + fence;
}

const renderer: EntityRenderer = {
  text: (s) => breakLines(escapeMd(s)),
  wrap(e: ExportEntity, inner: string, raw: string) {
    switch(e.type) {
      case 'bold': return emphasize(inner, '**');
      case 'italic': return emphasize(inner, '_');
      case 'strike': return emphasize(inner, '~~');
      case 'underline': return emphasize(inner, '<u>', '</u>');
      case 'spoiler': return emphasize(inner, '||');
      case 'code': return inlineCode(raw);
      case 'pre': {
        const fence = raw.includes('```') ? '~~~~' : '```';
        return `\n\n${fence}${e.language ?? ''}\n${raw}\n${fence}\n\n`;
      }
      case 'blockquote':
        return '\n\n' + inner.split('\n').map((line) => '> ' + line).join('\n') + '\n\n';
      case 'textUrl': return `[${inner}](${mdUrl(e.url ?? '')})`;
      case 'mention': return `[${inner}](https://t.me/${raw.replace(/^@/, '')})`;
      case 'mentionName': return `[${inner}](tg://user?id=${e.user_id})`;
      case 'url': return /^https?:\/\//i.test(raw) ? `<${raw}>` : inner;
      default: return inner;
    }
  }
};

function mediaLine(media: ExportMedia, L: Labels): string {
  switch(media.type) {
    case 'webpage':
      if(!media.url) return '';
      return `> 🔗 [${escapeMd(media.title || media.site_name || media.url)}](${mdUrl(media.url)})` +
        (media.description ? `  \n> ${escapeMd(media.description).replace(/\n/g, '  \n> ')}` : '');

    case 'poll': {
      const answers = (media.answers ?? [])
        .map((a) => `> - ${escapeMd(a.text)}${a.voters !== undefined ? ` (${a.voters})` : ''}`)
        .join('\n');
      const total = media.total_voters !== undefined ? `\n> \n> ${media.total_voters} ${L.voters}` : '';
      return `> 📊 **${escapeMd(media.question ?? '')}**\n${answers}${total}`;
    }

    case 'geo':
    case 'venue': {
      const title = [media.title, media.address].filter(Boolean).join(', ') || `${media.latitude}, ${media.longitude}`;
      return `📍 [${escapeMd(title)}](https://maps.google.com/?q=${media.latitude},${media.longitude})`;
    }

    case 'contact':
      return `👤 ${escapeMd([media.first_name, media.last_name].filter(Boolean).join(' '))} ${escapeMd(media.phone_number ?? '')}`;

    case 'dice':
      return `${media.emoji ?? '🎲'} ${media.value ?? ''}`;
  }

  const parts: string[] = [L.media[media.type]];
  if(media.file_name) parts.push(media.file_name);
  if(media.performer || media.title) parts.push([media.performer, media.title].filter(Boolean).join(' — '));
  if(media.duration) parts.push(formatDuration(media.duration));
  if(media.size) parts.push(formatBytes(media.size));
  const caption = escapeMd(parts.join(' · '));

  if(media.file) {
    const path = mdUrl(media.file);
    const isImage = media.type === 'photo' || (media.type === 'sticker' && media.mime_type === 'image/webp');
    return isImage ? `![${caption}](${path})` : `📎 [${caption}](${path})`;
  }

  return `_[${caption}${media.skipped ? ' — ' + L.skipped[media.skipped] : ''}]_`;
}

function renderMessage(m: ExportMessage, doc: ExportDocument, L: Labels): string {
  const locale = doc.locale;

  if(m.type === 'service') {
    const details = m.action_details ? ': ' + Object.values(m.action_details).join(', ') : '';
    return `_${escapeMd(`${m.from?.name ?? ''} · ${m.action ?? L.service}${details}`)}_`;
  }

  const author = m.post_author && m.from ? `${m.from.name} (${m.post_author})` : m.from?.name ?? m.post_author ?? '';
  const meta: string[] = [formatTime(m.date, locale)];
  if(m.edit_date) meta.push(L.edited);
  if(m.views !== undefined) meta.push(`👁 ${m.views}`);
  if(m.forwards) meta.push(`↪ ${m.forwards}`);
  meta.push(`#${m.id}`);

  const lines: string[] = [`**${escapeMd(author)}** · ${meta.join(' · ')}`];
  if(m.media) {
    const line = mediaLine(m.media, L);
    if(line) lines.push(line);
  }
  if(m.text) lines.push(renderEntities(m.text, m.entities, renderer).trim());
  if(m.reactions?.length) lines.push(m.reactions.map((r) => `${reactionLabel(r)} ${r.count}`).join(' · '));

  return lines.join('\n\n');
}

export function toMarkdown(doc: ExportDocument): string {
  const L = getLabels(doc.locale);
  const out: string[] = [
    `# ${escapeMd(doc.chat.title)}`,
    `${L.messages}: ${doc.messages.length} · ${L.exportedAt}: ${formatDateTime(doc.exportedAt / 1000, doc.locale)}`
  ];
  let lastDay = '';

  for(const m of doc.messages) {
    const key = dayKey(m.date);
    if(key !== lastDay) {
      lastDay = key;
      out.push(`## ${formatDay(m.date, doc.locale)}`);
    }
    out.push(renderMessage(m, doc, L));
    out.push('---');
  }

  return out.join('\n\n') + '\n';
}
