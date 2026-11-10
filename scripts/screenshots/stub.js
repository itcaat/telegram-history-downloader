// Fake chrome.* APIs so the built popup can be rendered outside the extension.
// Expects `window.__TGDL_MESSAGES` ({en, ru}) to be defined before this script.
(() => {
  const params = new URLSearchParams(location.search);
  const lang = params.get('lang') || 'en';
  const cfg = JSON.parse(decodeURIComponent(escape(atob(params.get('cfg')))));
  const messages = window.__TGDL_MESSAGES[lang];

  const now = Date.now();
  const job = cfg.state.job;
  if(job) {
    job.startedAt = now - (cfg.startedAgo || 0);
    if(cfg.finished) job.finishedAt = now;
  }

  function getMessage(key, subs) {
    const entry = messages[key];
    if(!entry) return '';
    const args = subs == null ? [] : [].concat(subs);
    let text = entry.message;
    for(const [name, p] of Object.entries(entry.placeholders || {})) {
      const value = args[Number(p.content.slice(1)) - 1] ?? '';
      text = text.replace(new RegExp(`\\$${name}\\$`, 'gi'), value);
    }
    return text;
  }

  window.chrome = {
    i18n: {getUILanguage: () => lang, getMessage},
    storage: {local: {get: async() => ({form: cfg.form}), set: async() => {}}},
    tabs: {
      query: async() => [{id: 1, url: 'https://web.telegram.org/k/'}],
      sendMessage: async() => ({result: cfg.state})
    },
    scripting: {executeScript: async() => {}}
  };

  if(cfg.scroll) {
    addEventListener('load', () => setTimeout(() => scrollTo(0, document.body.scrollHeight), 200));
  }
})();
