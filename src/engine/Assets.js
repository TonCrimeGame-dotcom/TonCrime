export class Assets {
  constructor() {
    this.images = new Map();
  }

  // Tek resim yükle
  loadImage(key, src) {
    const img = new Image();

    const p = new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Image failed to load: ${src}`));
    });

    img.src = src;
    this.images.set(key, { img, promise: p });

    return p;
  }

  // Alias'lar (bazı yerler image/addImage çağırabilir)
  image(key, src) {
    return this.loadImage(key, src);
  }

  addImage(key, src) {
    return this.loadImage(key, src);
  }

  // ✅ BootScene bunu çağırıyor: loadImages([{key,src},...])
  async loadImages(list = []) {
    const promises = [];

    for (const item of list) {
      if (!item || !item.key || !item.src) continue;
      promises.push(this.loadImage(item.key, item.src));
    }

    // Hepsini bekle
    await Promise.all(promises);
  }

  // Get image (img elementini döndürür)
  getImage(key) {
    const entry = this.images.get(key);
    return entry ? entry.img : null;
  }

  // Alias
  get(key) {
    return this.getImage(key);
  }
}
