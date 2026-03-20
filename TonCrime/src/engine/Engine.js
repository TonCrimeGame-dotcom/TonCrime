export class Engine {
  constructor({ canvas, ctx, input, scenes }) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.input = input;
    this.scenes = scenes;

    this._running = false;
    this._last = 0;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    requestAnimationFrame(this._tick);
  }

  stop() {
    this._running = false;
  }

  _tick = (now) => {
    if (!this._running) return;

    const dtMs = now - this._last;
    this._last = now;

    // dt clamp (tab switch vs)
    const dt = Math.min(dtMs / 1000, 0.05);

    this.input.beginFrame();

    const scene = this.scenes.current();
    if (scene?.update) scene.update(dt);

    // clear
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.ctx.clearRect(0, 0, w, h);

    if (scene?.render) scene.render(this.ctx, w, h);

    this.input.endFrame();

    requestAnimationFrame(this._tick);
  };
}
