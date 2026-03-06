export class Store {
  constructor(initialState) {
    this.state = structuredClone(initialState);
    this.listeners = new Set();
  }

  get() {
    return this.state;
  }

  set(patch) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
