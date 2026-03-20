export class Assets {
  constructor() {
    this.images = new Map();
  }

  loadImage(key, src) {
    const img = new Image();
    img.decoding = "async";

    const p = new Promise((resolve) => {
      img.onload = () => resolve(img);
      img.onerror = () => {
        img._failed = true;
        console.warn(`[ASSETS] Image failed to load: ${src}`);
        resolve(null);
      };
    });

    img.src = src;
    this.images.set(key, { img, promise: p, src });
    return p;
  }

  image(key, src) {
    return this.loadImage(key, src);
  }

  addImage(key, src) {
    return this.loadImage(key, src);
  }

  async loadImages(list = []) {
    const promises = [];
    for (const item of list) {
      if (!item || !item.key || !item.src) continue;
      promises.push(this.loadImage(item.key, item.src));
    }
    await Promise.all(promises);
  }

  async loadAll() {
    const promises = [];
    for (const entry of this.images.values()) {
      if (entry?.promise) promises.push(entry.promise);
    }
    await Promise.all(promises);
  }

  getImage(key) {
    const entry = this.images.get(key);
    const img = entry ? entry.img : null;
    if (!img) return null;
    if (img._failed) return null;
    if (img.complete && (img.naturalWidth || img.width)) return img;
    return null;
  }

  get(key) {
    return this.getImage(key);
  }
}
