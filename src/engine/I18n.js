export class I18n {
  constructor(store) {
    this.store = store;
    this.dict = {};
  }

  register(allLang) {
    this.dict = { ...this.dict, ...allLang };
  }

  getLang() {
    return this.store?.get?.().lang || "tr";
  }

  setLang(lang) {
    const next = lang === "en" ? "en" : "tr";
    const state = this.store?.get?.() || {};
    this.store?.set?.({ lang: next, ui: { ...(state.ui || {}), langChangedAt: Date.now() } });
    return next;
  }

  toggleLang() {
    return this.setLang(this.getLang() === "tr" ? "en" : "tr");
  }

  t(key, fallback = key) {
    const lang = this.getLang();
    return this.dict?.[lang]?.[key] ?? this.dict?.tr?.[key] ?? fallback;
  }
}
