/* Shared, local translations. No remote translation service or visitor data transfer. */
(() => {
  const storageKey = 'helpani.language';
  let locale = 'en';
  try { if (localStorage.getItem(storageKey) === 'zh-CN') locale = 'zh-CN'; } catch {}
  const dictionary = new Map();
  const cache = new Map();
  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  const attributes = ['aria-label', 'aria-description', 'aria-valuetext', 'title', 'alt', 'placeholder', 'content'];
  const normalize = (value) => value.replace(/\s+/g, ' ').trim();
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let phrases;
  let templates = [];
  let dirty = true;

  function compile() {
    if (!dirty) return;
    const literals = [];
    templates = [];
    for (const [source, target] of dictionary) {
      if (/\{\d+\}/.test(source)) {
        const positions = [];
        let expression = '';
        let last = 0;
        for (const match of source.matchAll(/\{(\d+)\}/g)) {
          expression += escape(source.slice(last, match.index)) + '(.+?)';
          positions.push(Number(match[1]));
          last = match.index + match[0].length;
        }
        expression += escape(source.slice(last));
        templates.push({ regex: new RegExp('^' + expression + '$'), target, positions, weight: source.replace(/\{\d+\}/g, '').length });
      } else if (source) literals.push(source);
    }
    templates.sort((a, b) => b.weight - a.weight);
    phrases = literals.length ? new RegExp(literals.sort((a, b) => b.length - a.length).map(escape).join('|'), 'g') : null;
    dirty = false;
  }

  function translate(value, depth = 0) {
    const raw = String(value ?? '');
    if (locale !== 'en') return raw;
    if (/^[\s。，、：；！？（）「」《》]+$/.test(raw)) return raw.replace(/[。，、：；！？（）「」《》]/g, (mark) => ({ '。': '.', '，': ',', '、': ', ', '：': ':', '；': ';', '！': '!', '？': '?', '（': '(', '）': ')', '「': '‘', '」': '’', '《': '‘', '》': '’' })[mark]);
    if (!/[\u3400-\u9fff]/.test(raw)) return raw;
    if (cache.has(raw)) return cache.get(raw);
    compile();
    const source = normalize(raw);
    let result = dictionary.get(source);
    if (result === undefined && depth < 4) {
      for (const template of templates) {
        const match = template.regex.exec(source);
        if (!match) continue;
        const values = {};
        template.positions.forEach((position, index) => { values[position] = translate(match[index + 1], depth + 1); });
        result = template.target.replace(/\{(\d+)\}/g, (_, position) => values[position] ?? '');
        break;
      }
    }
    if (result === undefined) result = phrases ? source.replace(phrases, (part) => dictionary.get(part)) : source;
    // Preserve meaningful spacing around inline elements.
    result = raw.slice(0, raw.length - raw.trimStart().length) + result + raw.slice(raw.trimEnd().length);
    cache.set(raw, result);
    return result;
  }

  function excluded(node) {
    return node.parentElement?.closest('script, style, code, pre, [data-no-i18n]');
  }

  function translateText(node) {
    if (excluded(node)) return;
    const previous = textSources.get(node);
    const source = previous && node.nodeValue === previous.rendered ? previous.source : node.nodeValue;
    const rendered = translate(source);
    textSources.set(node, { source, rendered });
    if (node.nodeValue !== rendered) node.nodeValue = rendered;
  }

  function translateAttributes(node) {
    if (node.closest('script, style, [data-no-i18n]')) return;
    let sources = attributeSources.get(node);
    if (!sources) { sources = new Map(); attributeSources.set(node, sources); }
    for (const name of attributes) {
      if (!node.hasAttribute(name)) continue;
      if (name === 'content' && !node.matches('meta[name="description"]')) continue;
      const current = node.getAttribute(name);
      const previous = sources.get(name);
      const source = previous && current === previous.rendered ? previous.source : current;
      const rendered = translate(source);
      sources.set(name, { source, rendered });
      if (current !== rendered) node.setAttribute(name, rendered);
    }
  }

  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) return translateText(root);
    if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType === Node.TEXT_NODE) translateText(node);
      else translateAttributes(node);
    }
  }

  const observer = new MutationObserver((records) => {
    observer.disconnect();
    try {
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(walk);
        else if (record.type === 'characterData') translateText(record.target);
        else translateAttributes(record.target);
      }
    } finally { observe(); }
  });
  function observe() {
    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: attributes });
  }
  function refresh() {
    observer.disconnect();
    try {
      document.documentElement.lang = locale;
      walk(document.documentElement);
      document.querySelectorAll('[data-language-select]').forEach((select) => { select.value = locale; });
    } finally { observe(); }
  }
  function setLocale(next) {
    if (!['en', 'zh-CN'].includes(next) || locale === next) return;
    locale = next;
    cache.clear();
    try { localStorage.setItem(storageKey, locale); } catch {}
    refresh();
    window.dispatchEvent(new CustomEvent('helpani:languagechange', { detail: { locale } }));
  }
  function sourceText(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const previous = textSources.get(node);
      return previous && node.nodeValue === previous.rendered ? previous.source : node.nodeValue;
    }
    return [...node.childNodes].map(sourceText).join('');
  }
  window.HelpaniI18n = {
    get locale() { return locale; },
    t: translate,
    setLocale,
    refresh,
    sourceText,
    add(entries) {
      for (const [source, target] of Object.entries(entries)) dictionary.set(normalize(source), target);
      dirty = true;
      cache.clear();
    },
  };
  document.documentElement.lang = locale;
  observe();
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-language-select]').forEach((select) => {
      select.addEventListener('change', () => setLocale(select.value));
    });
    refresh();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) setLocale(event.newValue === 'zh-CN' ? 'zh-CN' : 'en');
  });
})();
