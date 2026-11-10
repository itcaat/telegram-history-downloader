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

const esc = (s: string) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function safeUrl(url: string) {
  const trimmed = url.trim();
  if(/^(https?:|tg:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if(/^[\w-]+(\.[\w-]+)+/.test(trimmed)) return 'https://' + trimmed;
  return '#';
}

const link = (href: string, inner: string) =>
  `<a href="${esc(safeUrl(href))}" target="_blank" rel="noopener noreferrer">${inner}</a>`;

const renderer: EntityRenderer = {
  text: esc,
  wrap(e: ExportEntity, inner: string, raw: string) {
    switch(e.type) {
      case 'bold': return `<strong>${inner}</strong>`;
      case 'italic': return `<em>${inner}</em>`;
      case 'underline': return `<u>${inner}</u>`;
      case 'strike': return `<s>${inner}</s>`;
      case 'spoiler': return `<span class="spoiler">${inner}</span>`;
      case 'code': return `<code>${inner}</code>`;
      case 'pre': return `<pre${e.language ? ` data-language="${esc(e.language)}"` : ''}><code>${inner}</code></pre>`;
      case 'blockquote': return `<blockquote>${inner}</blockquote>`;
      case 'textUrl': return link(e.url ?? '', inner);
      case 'url': return link(raw, inner);
      case 'email': return link('mailto:' + raw, inner);
      case 'phone': return link('tel:' + raw.replace(/[^\d+]/g, ''), inner);
      case 'mention': return link('https://t.me/' + raw.replace(/^@/, ''), inner);
      case 'mentionName': return link('tg://user?id=' + e.user_id, inner);
      case 'hashtag':
      case 'cashtag':
      case 'botCommand': return `<span class="tag">${inner}</span>`;
      default: return inner;
    }
  }
};

function mediaCaption(media: ExportMedia, L: Labels) {
  const parts: string[] = [L.media[media.type]];
  if(media.file_name) parts.push(media.file_name);
  if(media.performer || media.title) parts.push([media.performer, media.title].filter(Boolean).join(' — '));
  if(media.duration) parts.push(formatDuration(media.duration));
  if(media.size) parts.push(formatBytes(media.size));
  if(media.skipped) parts.push(L.skipped[media.skipped]);
  return esc(parts.join(' · '));
}

function renderMedia(media: ExportMedia, L: Labels): string {
  const file = media.file ? esc(media.file) : undefined;

  switch(media.type) {
    case 'webpage':
      if(!media.url) return '';
      return `<div class="webpage">${link(media.url, esc(media.site_name || media.url))}` +
        (media.title ? `<div class="wp-title">${esc(media.title)}</div>` : '') +
        (media.description ? `<div class="wp-desc">${esc(media.description)}</div>` : '') +
        `</div>`;

    case 'poll': {
      const answers = (media.answers ?? []).map((a) =>
        `<li>${esc(a.text)}${a.voters !== undefined ? ` <span class="muted">(${a.voters})</span>` : ''}</li>`).join('');
      const total = media.total_voters !== undefined ? `<div class="muted">${media.total_voters} ${L.voters}</div>` : '';
      return `<div class="poll"><div class="label">📊 ${esc(media.question ?? '')}</div><ul>${answers}</ul>${total}</div>`;
    }

    case 'geo':
    case 'venue': {
      const url = `https://maps.google.com/?q=${media.latitude},${media.longitude}`;
      const title = [media.title, media.address].filter(Boolean).join(', ') || `${media.latitude}, ${media.longitude}`;
      return `<div class="attachment">📍 ${link(url, esc(title))}</div>`;
    }

    case 'contact':
      return `<div class="attachment">👤 ${esc([media.first_name, media.last_name].filter(Boolean).join(' '))} ` +
        `${esc(media.phone_number ?? '')}</div>`;

    case 'dice':
      return `<div class="attachment">${esc(media.emoji ?? '🎲')} ${media.value ?? ''}</div>`;
  }

  if(file) {
    switch(media.type) {
      case 'photo':
        return `<a href="${file}" target="_blank"><img class="photo" src="${file}" loading="lazy" alt=""></a>`;
      case 'sticker':
        if(media.mime_type === 'image/webp') return `<img class="sticker" src="${file}" loading="lazy" alt="${esc(media.emoji ?? '')}">`;
        if(media.mime_type === 'video/webm') return `<video class="sticker" src="${file}" autoplay loop muted playsinline></video>`;
        break;
      case 'gif':
        return `<video class="photo" src="${file}" autoplay loop muted playsinline></video>`;
      case 'video':
      case 'round':
        return `<video class="photo${media.type === 'round' ? ' round' : ''}" src="${file}" controls preload="metadata"></video>`;
      case 'voice':
      case 'audio':
        return `<div class="attachment"><div class="muted">${mediaCaption(media, L)}</div>` +
          `<audio src="${file}" controls preload="none"></audio></div>`;
    }
    return `<div class="attachment">📎 <a href="${file}" target="_blank">${mediaCaption(media, L)}</a></div>`;
  }

  return `<div class="attachment muted">[${mediaCaption(media, L)}]</div>`;
}

function renderMessage(m: ExportMessage, doc: ExportDocument, L: Labels): string {
  const locale = doc.locale;

  if(m.type === 'service') {
    const details = m.action_details ? ' ' + esc(Object.values(m.action_details).join(', ')) : '';
    return `<div class="service" id="msg${m.id}">${esc(m.from?.name ?? '')} · ${esc(m.action ?? L.service)}${details}</div>`;
  }

  const meta: string[] = [`<span title="${esc(formatDateTime(m.date, locale))}">${formatTime(m.date, locale)}</span>`];
  if(m.edit_date) meta.push(`<span title="${esc(formatDateTime(m.edit_date, locale))}">${L.edited}</span>`);
  if(m.views !== undefined) meta.push(`👁 ${m.views}`);
  if(m.forwards) meta.push(`↪ ${m.forwards}`);

  const author = m.post_author && m.from ? `${m.from.name} (${m.post_author})` : m.from?.name ?? m.post_author ?? '';
  const text = m.text ? `<div class="text">${renderEntities(m.text, m.entities, renderer)}</div>` : '';
  const reactions = m.reactions?.length
    ? `<div class="reactions">${m.reactions.map((r) => `<span class="reaction">${esc(reactionLabel(r))} ${r.count}</span>`).join('')}</div>`
    : '';

  return `<div class="message" id="msg${m.id}">` +
    `<div class="head"><span class="author">${esc(author)}</span><span class="meta">${meta.join(' · ')}</span>` +
    `<a class="anchor" href="#msg${m.id}">#${m.id}</a></div>` +
    (m.media ? renderMedia(m.media, L) : '') +
    text +
    reactions +
    `</div>`;
}

const STYLE = `
:root{color-scheme:light dark;--bg:#f4f4f5;--card:#fff;--muted:#707579;--accent:#3390ec;--border:#e4e4e7}
@media (prefers-color-scheme:dark){:root{--bg:#18181b;--card:#212121;--muted:#aaa;--accent:#8774e1;--border:#333}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
header{position:sticky;top:0;background:var(--card);border-bottom:1px solid var(--border);padding:12px 20px;z-index:1}
header h1{margin:0;font-size:18px}
header .muted{font-size:13px}
main{max-width:760px;margin:0 auto;padding:16px}
.day{text-align:center;margin:20px 0 10px}
.day span{background:var(--card);border-radius:12px;padding:3px 12px;font-size:13px;color:var(--muted)}
.message{background:var(--card);border-radius:12px;padding:8px 12px;margin:6px 0;overflow-wrap:anywhere}
.head{display:flex;gap:8px;align-items:baseline;font-size:13px;margin-bottom:4px}
.author{font-weight:600;color:var(--accent)}
.meta,.muted{color:var(--muted)}
.anchor{margin-left:auto;color:var(--muted);text-decoration:none;font-size:12px}
.text{white-space:pre-wrap}
.photo{display:block;max-width:100%;max-height:480px;border-radius:8px;margin:4px 0}
.round{border-radius:50%;width:240px;height:240px;object-fit:cover}
.sticker{width:160px;height:160px;object-fit:contain}
.attachment,.webpage,.poll{border-left:3px solid var(--accent);padding:4px 10px;margin:4px 0}
.wp-title{font-weight:600}
.poll ul{margin:4px 0;padding-left:20px}
.label{font-weight:600}
.reactions{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.reaction{background:var(--bg);border-radius:12px;padding:1px 8px;font-size:13px}
.service{text-align:center;color:var(--muted);font-size:13px;margin:8px 0}
blockquote{border-left:3px solid var(--accent);margin:4px 0;padding:2px 10px}
pre{background:var(--bg);padding:8px;border-radius:6px;overflow-x:auto;white-space:pre}
code{font-family:ui-monospace,Menlo,monospace;font-size:13px}
.spoiler{background:var(--muted);color:transparent;border-radius:4px;cursor:pointer}
.spoiler:hover{background:none;color:inherit}
.tag{color:var(--accent)}
a{color:var(--accent)}
audio{width:100%;max-width:400px}
`;

export function toHtml(doc: ExportDocument): string {
  const L = getLabels(doc.locale);
  const body: string[] = [];
  let lastDay = '';

  for(const m of doc.messages) {
    const key = dayKey(m.date);
    if(key !== lastDay) {
      lastDay = key;
      body.push(`<div class="day"><span>${esc(formatDay(m.date, doc.locale))}</span></div>`);
    }
    body.push(renderMessage(m, doc, L));
  }

  const subtitle = `${L.messages}: ${doc.messages.length} · ${L.exportedAt}: ${formatDateTime(doc.exportedAt / 1000, doc.locale)}`;

  return `<!DOCTYPE html>
<html lang="${doc.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.chat.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<header><h1>${esc(doc.chat.title)}</h1><div class="muted">${esc(subtitle)}</div></header>
<main>
${body.join('\n')}
</main>
</body>
</html>
`;
}
