export class I18n {
  constructor(store) {
    this.store = store;
    this.dict = {};
  }

  register(allLang) {
    this.dict = { ...this.dict, ...allLang };
  }

  t(key) {
    const lang = this.store.get().lang || "tr";
    return this.dict?.[lang]?.[key] ?? key;
  }
}
