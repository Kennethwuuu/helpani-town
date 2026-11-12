const images = new Map();

async function loadMedalImage(path) {
  if (!/^\/assets\/medals\/[a-z-]+\.(?:png|svg)$/.test(path)) throw new Error('勋章图片暂时不可用。');
  if (!images.has(path)) {
    const loading = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('勋章图片未能加载。可重试，或选择不加角标。'));
      image.src = path;
    }).catch((error) => { images.delete(path); throw error; });
    images.set(path, loading);
  }
  return images.get(path);
}

// The same composed PNG is previewed, saved to IndexedDB and downloaded.
export async function paintPhotoMedal(context, medal, width, height) {
  if (!medal) return;
  const image = await loadMedalImage(medal.art);
  const scale = Math.min(width / 1600, height / 1000);
  const x = width - 270 * scale, y = 36 * scale;
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.fillStyle = 'rgba(255, 251, 235, .92)';
  context.strokeStyle = 'rgba(177, 149, 92, .7)';
  context.lineWidth = 1.5;
  context.beginPath(); context.roundRect(0, 0, 234, 242, 22); context.fill(); context.stroke();
  context.drawImage(image, 28, 10, 178, 178);
  context.textAlign = 'center';
  context.fillStyle = '#284c37';
  context.font = '600 23px sans-serif';
  context.fillText(window.HelpaniI18n.t(medal.title), 117, 210, 214);
  context.fillStyle = '#6c765c';
  context.font = '18px sans-serif';
  context.fillText(window.HelpaniI18n.t(medal.photoAccent), 117, 233, 214);
  context.restore();
}

export function photoMedalMetadata(medal) {
  return medal ? {id: medal.id, title: medal.title, art: medal.art, photoAccent: medal.photoAccent} : null;
}
