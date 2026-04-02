function cleanupProfileSceneInputs() {
  if (typeof document === "undefined") return;
  try {
    const inputs = document.querySelectorAll("input");
    inputs.forEach((el) => {
      if (!el) return;
      if (el.id === "chatInput" || el.closest?.("#chatDrawer")) return;
      const type = String(el.type || "").toLowerCase();
      const isProfileTagged = el.dataset?.tcProfileInput === "1";
      let isFixed = false;
      try {
        isFixed = window.getComputedStyle(el).position === "fixed";
      } catch (_) {}
      if (!isProfileTagged && !isFixed && type !== "file") return;
      try {
        if (document.activeElement === el) el.blur();
      } catch (_) {}
      try { el.remove(); } catch (_) {}
    });
  } catch (_) {}
}

export class SceneManager {
  constructor() {
    this.map = new Map();
    this._currentKey = null;
  }

  register(key, scene) {
    this.map.set(key, scene);
  }

  go(key, data) {
    const next = this.map.get(key);
    if (!next) throw new Error(`Scene not found: ${key}`);

    const prev = this.current();
    if (prev?.onExit) prev.onExit();
    if (key !== "profile") cleanupProfileSceneInputs();

    this._currentKey = key;
    if (next?.onEnter) next.onEnter(data);
    try {
      window.dispatchEvent(new CustomEvent("tc:scene-changed", { detail: { key, data } }));
    } catch (_) {}
  }

  current() {
    if (!this._currentKey) return null;
    return this.map.get(this._currentKey) || null;
  }
}
