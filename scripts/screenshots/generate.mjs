// Generates localized Chrome Web Store screenshots (1280×800) into docs/screenshots/<lang>/
// and promo images (440×280, 1400×560) into docs/promo/. All images are 24-bit PNG without alpha.
// Usage: npm run screenshots [-- --no-build]
// Requires Google Chrome; set CHROME_PATH if it isn't in the default location.
import {execFile, execSync} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {cp, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {extname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {deflateSync, inflateSync} from 'node:zlib';
import {build} from 'vite';
import {
  CHART_SVG, DAY, LANGS, SCENE_NAMES, backdrop, chat, exportMessages, fileName, people, popupConfigs, texts
} from './data.mjs';

const root = resolve(import.meta.dirname, '../..');
const here = import.meta.dirname;
const outRoot = join(root, 'docs/screenshots');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if(!existsSync(chromePath)) {
  console.error(`Chrome not found at ${chromePath}. Set CHROME_PATH.`);
  process.exit(1);
}

if(!process.argv.includes('--no-build')) execSync('npm run build', {cwd: root, stdio: 'inherit'});

const tmp = await mkdtemp(join(tmpdir(), 'tgdl-shots-'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- popup with fake chrome.* APIs ----------

const messages = {};
for(const lang of LANGS) {
  messages[lang] = JSON.parse(await readFile(join(root, `public/_locales/${lang}/messages.json`), 'utf8'));
}

await cp(join(root, 'dist'), join(tmp, 'ext'), {recursive: true});
await writeFile(
  join(tmp, 'ext/stub.js'),
  `window.__TGDL_MESSAGES = ${JSON.stringify(messages)};\n` + await readFile(join(here, 'stub.js'), 'utf8')
);
const popupHtmlPath = join(tmp, 'ext/popup/index.html');
const popupHtml = await readFile(popupHtmlPath, 'utf8');
await writeFile(popupHtmlPath, popupHtml.replace('<script type="module"', '<script src="../stub.js"></script>\n<script type="module"'));

await cp(join(here, 'scene.css'), join(tmp, 'scene.css'));
await cp(join(root, 'docs/store-icon-128.png'), join(tmp, 'icon.png'));

// ---------- HTML export rendered by the real exporter ----------

await build({
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  build: {
    outDir: join(tmp, 'lib'),
    emptyOutDir: true,
    minify: false,
    lib: {entry: join(root, 'src/main/formats/html.ts'), formats: ['es'], fileName: () => 'html.mjs'}
  }
});
const {toHtml} = await import(pathToFileURL(join(tmp, 'lib/html.mjs')).href);

for(const lang of LANGS) {
  const dir = join(tmp, `export-${lang}`);
  await mkdir(join(dir, 'media/photos'), {recursive: true});
  await writeFile(join(dir, 'media/photos/1203_chart.svg'), CHART_SVG);
  const doc = {
    chat: chat(lang),
    exportedAt: (DAY + 8 * 3600) * 1000,
    range: {mode: 'all'},
    locale: lang,
    messages: exportMessages(lang)
  };
  await writeFile(join(dir, 'messages.html'), toHtml(doc));
}

// ---------- scenes ----------

const lockIcon = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg>';
const authorColors = {anna: '', max: 'c2', kate: 'c3', ilya: 'c4'};

const initials = (title) => title.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function chatBackdrop(lang) {
  const c = chat(lang);
  const sub = lang === 'ru' ? '24 участника' : '24 members';
  const bubbles = backdrop[lang].map((m, i) => {
    const time = `<small>${10 + i}:${String(i * 7 % 60).padStart(2, '0')}</small>`;
    if(m.out) return `<div class="bubble out">${esc(m.text)}${time}</div>`;
    return `<div class="bubble"><b class="${authorColors[m.from]}">${esc(people[lang][m.from])}</b>${esc(m.text)}${time}</div>`;
  }).join('');
  return `<div class="chat">
    <div class="chat-head"><div class="chat-avatar">${esc(initials(c.title))}</div>
      <div><div class="chat-title">${esc(c.title)}</div><div class="chat-sub">${sub}</div></div></div>
    <div class="messages">${bubbles}</div>
  </div>`;
}

function popupFrame(lang, cfg) {
  const encoded = Buffer.from(JSON.stringify(cfg), 'utf8').toString('base64');
  return `<iframe class="popup" src="/ext/popup/index.html?lang=${lang}&cfg=${encodeURIComponent(encoded)}"></iframe>`;
}

function exportView(lang) {
  const files = texts[lang].zipFiles.map((f) => `<li>${esc(f)}</li>`).join('');
  return `<div class="zip"><div class="zip-head"><div class="zip-icon">ZIP</div><div class="zip-name">${esc(fileName(lang))}</div></div>
    <ul>${files}</ul></div>`;
}

function scenePage(lang, index) {
  const [title, lead] = texts[lang].scenes[index];
  const bullets = texts[lang].bullets[index].map((b) => `<li>${esc(b)}</li>`).join('');
  const cfg = popupConfigs(lang)[index];
  const address = cfg ? 'web.telegram.org/k/' : `file:///Downloads/${fileName(lang).replace('.zip', '')}/messages.html`;
  const page = cfg ? chatBackdrop(lang) + popupFrame(lang, cfg) : `<iframe class="export" src="/export-${lang}/messages.html"></iframe>`;
  const extra = cfg ? `<ul class="bullets">${bullets}</ul>` : exportView(lang);

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><link rel="stylesheet" href="/scene.css"></head>
<body>
  <section class="copy">
    <div class="brand"><img src="/icon.png" alt="">${esc(messages[lang].extName.message)}</div>
    <h1>${esc(title)}</h1>
    <p class="lead">${esc(lead)}</p>
    ${extra}
  </section>
  <div class="window">
    <div class="toolbar">
      <div class="dots"><i></i><i></i><i></i></div>
      <div class="address">${cfg ? lockIcon : ''}${esc(address)}</div>
      ${cfg ? '<div class="ext"><img src="/icon.png" alt=""></div>' : ''}
    </div>
    <div class="page">${page}</div>
  </div>
  <script>
    // Chrome sizes extension popups to their content, up to 600 px.
    const frame = document.querySelector('.popup');
    if(frame) setInterval(() => {
      const body = frame.contentDocument && frame.contentDocument.body;
      if(body) frame.style.height = Math.min(600, body.scrollHeight) + 'px';
    }, 50);
  </script>
</body>
</html>`;
}

await mkdir(join(tmp, 'scenes'));
for(const lang of LANGS) {
  for(let i = 0; i < SCENE_NAMES.length; ++i) {
    await writeFile(join(tmp, `scenes/${lang}-${i}.html`), scenePage(lang, i));
  }
}

// ---------- promo images (not localized, so English only) ----------

const PROMOS = [
  {name: 'small-440x280', width: 440, height: 280},
  {name: 'marquee-1400x560', width: 1400, height: 560}
];

function promoPage(name) {
  const title = esc(messages.en.extName.message);
  const pills = '<div class="pills"><span class="pill">HTML</span><span class="pill">JSON</span><span class="pill">Markdown</span></div>';
  const head = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="/promo.css"></head>';

  if(name.startsWith('small')) {
    return `${head}<body class="small"><img class="icon" src="/icon.png" alt=""><h1>${title}</h1>${pills}</body></html>`;
  }

  const file = (left, top, color, ext, label, sub) =>
    `<div class="file" style="left:${left}px;top:${top}px"><b style="background:${color}">${ext}</b><span>${esc(label)}<small>${esc(sub)}</small></span></div>`;

  return `${head}<body class="marquee">
    <section class="copy">
      <img class="icon" src="/icon.png" alt="">
      <h1>${title}</h1>
      <p>Export Telegram chats, groups and channels — with photos, videos and files.</p>
      ${pills}
    </section>
    ${popupFrame('en', popupConfigs('en')[0])}
    ${file(724, 120, '#ff8a5c', 'HTML', 'messages.html', '12,400 messages')}
    ${file(760, 236, '#4fae4e', 'JSON', 'messages.json', 'Structured data')}
    ${file(712, 352, '#8774e1', 'ZIP', fileName('en'), '380 media files')}
    <script>
      const frame = document.querySelector('.popup');
      setInterval(() => {
        const body = frame.contentDocument && frame.contentDocument.body;
        if(body) frame.style.height = Math.min(600, body.scrollHeight) + 'px';
      }, 50);
    </script>
  </body></html>`;
}

await cp(join(here, 'promo.css'), join(tmp, 'promo.css'));
for(const promo of PROMOS) await writeFile(join(tmp, `scenes/${promo.name}.html`), promoPage(promo.name));

// ---------- static server ----------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'
};
const server = createServer(async(req, res) => {
  try {
    const path = join(tmp, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if(!path.startsWith(tmp)) throw new Error('forbidden');
    const body = await readFile(path);
    res.writeHead(200, {'content-type': MIME[extname(path)] ?? 'application/octet-stream'});
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const {port} = server.address();

// ---------- capture ----------

/** Re-encodes an RGBA PNG as 24-bit RGB (the store rejects images with alpha). */
function stripAlpha(png) {
  let pos = 8;
  let ihdr;
  const idat = [];
  while(pos < png.length) {
    const len = png.readUInt32BE(pos);
    const type = png.toString('ascii', pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + len);
    if(type === 'IHDR') ihdr = Buffer.from(data);
    else if(type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const colorType = ihdr[9];
  if(ihdr[8] !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error('Unsupported PNG');
  if(colorType === 2) return png;

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(height * (width * 3 + 1));
  let prev = Buffer.alloc(stride);

  for(let y = 0; y < height; ++y) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for(let x = 0; x < stride; ++x) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let add = 0;
      if(filter === 1) add = a;
      else if(filter === 2) add = b;
      else if(filter === 3) add = (a + b) >> 1;
      else if(filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = (line[x] + add) & 0xff;
    }
    const o = y * (width * 3 + 1);
    for(let x = 0; x < width; ++x) {
      out[o + 1 + x * 3] = line[x * 4];
      out[o + 2 + x * 3] = line[x * 4 + 1];
      out[o + 3 + x * 3] = line[x * 4 + 2];
    }
    prev = line;
  }

  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  ihdr[9] = 2;
  return Buffer.concat([
    png.subarray(0, 8),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(out, {level: 9})),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const CRC_TABLE = Array.from({length: 256}, (_, n) => {
  let c = n;
  for(let k = 0; k < 8; ++k) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for(const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function capture(url, width, height, target, lang = 'en') {
  const shot = join(tmp, 'shot.png');
  await promisify(execFile)(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-dark-mode',
    '--force-device-scale-factor=1',
    `--lang=${lang}`,
    `--user-data-dir=${join(tmp, 'profile')}`,
    `--window-size=${width},${height}`,
    '--virtual-time-budget=3000',
    `--screenshot=${shot}`,
    `http://127.0.0.1:${port}${url}`
  ], {timeout: 60_000});
  await writeFile(target, stripAlpha(await readFile(shot)));
  console.log(`✓ ${target.slice(root.length + 1)}`);
}

try {
  for(const lang of LANGS) {
    const dir = join(outRoot, lang);
    await rm(dir, {recursive: true, force: true});
    await mkdir(dir, {recursive: true});

    for(let i = 0; i < SCENE_NAMES.length; ++i) {
      await capture(`/scenes/${lang}-${i}.html`, 1280, 800, join(dir, `${SCENE_NAMES[i]}.png`), lang);
    }
  }

  const promoDir = join(root, 'docs/promo');
  await mkdir(promoDir, {recursive: true});
  for(const promo of PROMOS) {
    await capture(`/scenes/${promo.name}.html`, promo.width, promo.height, join(promoDir, `${promo.name}.png`));
  }
} finally {
  server.close();
  await rm(tmp, {recursive: true, force: true});
}
