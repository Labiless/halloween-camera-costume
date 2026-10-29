// Riproduzione di GIF animate disegnabili su canvas.
//
// Un <img> GIF disegnato su canvas non si anima in modo affidabile (Chrome fa avanzare
// i frame solo delle immagini visibili), quindi dove possibile decodifichiamo i frame
// con ImageDecoder (Chrome/Android). Se non c'è, o il server della GIF non permette
// di leggerla (CORS), si ripiega su un normale <img>.
//
// Interfaccia: { width, height, tick(now), image(), close() }

export async function loadGif(url) {
  if ('ImageDecoder' in window) {
    try {
      return await decodedGif(url);
    } catch (err) {
      console.warn(`ImageDecoder non disponibile per ${url}, uso <img>`, err);
    }
  }
  return imgGif(url);
}

async function decodedGif(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type')?.split(';')[0] || 'image/gif';
  const decoder = new ImageDecoder({ data: await res.arrayBuffer(), type });
  await decoder.tracks.ready;
  await decoder.completed;
  const count = decoder.tracks.selectedTrack.frameCount;

  // I frame vengono decodificati uno alla volta quando servono: poca memoria anche con GIF lunghe
  let { image: frame } = await decoder.decode({ frameIndex: 0 });
  let index = 0;
  let nextAt = 0;
  let pending = false;
  let closed = false;
  const duration = (f) => Math.max(20, (f.duration ?? 100_000) / 1000);

  return {
    width: frame.displayWidth,
    height: frame.displayHeight,
    tick(now) {
      if (!nextAt) nextAt = now + duration(frame);
      if (pending || closed || count < 2 || now < nextAt) return;
      pending = true;
      index = (index + 1) % count;
      decoder
        .decode({ frameIndex: index })
        .then(({ image }) => {
          if (closed) return image.close();
          frame.close();
          frame = image;
          nextAt = Math.max(nextAt + duration(image), now);
        })
        .catch(() => {})
        .finally(() => (pending = false));
    },
    image: () => frame,
    close() {
      closed = true;
      frame.close();
      decoder.close();
    },
  };
}

function imgGif(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        tick() {},
        image: () => img,
        close() {},
      });
    img.onerror = () => reject(new Error(`GIF non caricabile: ${url}`));
    img.src = url;
  });
}
