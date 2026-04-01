export class I18n {
  constructor(store) {
    this.store = store;
    this.dict = {};
    this._syncDocumentLang(this.getLang());
  }

  register(allLang) {
    this.dict = { ...this.dict, ...allLang };
    this._syncDocumentLang(this.getLang());
  }

  getLang() {
    return this.store?.get?.().lang || "tr";
  }

  setLang(lang) {
    const next = lang === "en" ? "en" : "tr";
    const state = this.store?.get?.() || {};
    this.store?.set?.({ lang: next, ui: { ...(state.ui || {}), langChangedAt: Date.now() } });
    this._syncDocumentLang(next);
    return next;
  }

  toggleLang() {
    return this.setLang(this.getLang() === "tr" ? "en" : "tr");
  }

  t(key, fallback = key) {
    const lang = this.getLang();
    return this.dict?.[lang]?.[key] ?? this.dict?.tr?.[key] ?? fallback;
  }

  _syncDocumentLang(lang) {
    try {
      document?.documentElement?.setAttribute?.("lang", lang === "en" ? "en" : "tr");
    } catch (_) {}
  }
}
