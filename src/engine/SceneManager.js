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

    this._currentKey = key;
    if (next?.onEnter) next.onEnter(data);
  }

  current() {
    if (!this._currentKey) return null;
    return this.map.get(this._currentKey) || null;
  }
}
