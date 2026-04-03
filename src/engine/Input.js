export class Input {
  constructor(canvas) {
    this.canvas = canvas;

    this._pressed = false;
    this._justPressed = false;
    this._justReleased = false;
    this._downPos = null;
    this._clickListeners = new Set();

    this.pointer = { x: 0, y: 0 };

    const onDown = (e) => {
      this._pressed = true;
      this._justPressed = true;
      this._setXY(e);
      this._downPos = { x: this.pointer.x, y: this.pointer.y };
    };
    const onUp = (e) => {
      this._pressed = false;
      this._justReleased = true;
      this._setXY(e);
      const down = this._downPos;
      this._downPos = null;

      if (down) {
        const dx = this.pointer.x - down.x;
        const dy = this.pointer.y - down.y;
        const moved = Math.hypot(dx, dy);
        if (moved <= 10) {
          for (const fn of this._clickListeners) {
            try {
              fn({ x: this.pointer.x, y: this.pointer.y, event: e });
            } catch (_) {}
          }
        }
      }
    };
    const onMove = (e) => this._setXY(e);

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
  }

  beginFrame() {
    // frame start flags are already set by events
  }

  endFrame() {
    this._justPressed = false;
    this._justReleased = false;
  }

  isDown() {
    return this._pressed;
  }

  justPressed() {
    return this._justPressed;
  }

  justReleased() {
    return this._justReleased;
  }

  onClick(fn) {
    if (typeof fn !== "function") return () => {};
    this._clickListeners.add(fn);
    return () => {
      this._clickListeners.delete(fn);
    };
  }

  _setXY(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
  }
}
