import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';

// Wasm e modelli sono in /public, così funziona anche senza internet.
const WASM = `${import.meta.env.BASE_URL}mediapipe/wasm`;
// Full range: riconosce volti anche a qualche metro (alla festa le persone non sono a 30cm).
const MODEL = `${import.meta.env.BASE_URL}models/blaze_face_full_range.tflite`;

let promise;

// Il detector è costoso da creare: lo teniamo in cache tra un cambio scena e l'altro.
export function getFaceDetector() {
  promise ??= create().catch((err) => {
    promise = undefined;
    throw err;
  });
  return promise;
}

async function create() {
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  let lastError;
  for (const delegate of ['GPU', 'CPU']) {
    try {
      return await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
        minSuppressionThreshold: 0.3,
      });
    } catch (err) {
      console.warn(`FaceDetector ${delegate} non disponibile`, err);
      lastError = err;
    }
  }
  throw lastError;
}
