export class Input {
  constructor(canvas) {
    this.canvas = canvas;

    this._pressed = false;
    this._justPressed = false;
    this._justReleased = false;

    this.pointer = { x: 0, y: 0 };

    const onDown = (e) => {
      this._pressed = true;
      this._justPressed = true;
      this._setXY(e);
    };
    const onUp = (e) => {
      this._pressed = false;
      this._justReleased = true;
      this._setXY(e);
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

  _setXY(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
  }
}
