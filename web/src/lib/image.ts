// 1024 px keeps potholes and litter clearly visible, halves the upload, and Gemini answered
// about 40% faster than at 1600 px in a side-by-side test with the same results.
const MAX_EDGE = 1024;

/** Downscale and re-encode in the browser: smaller upload, and the original EXIF (incl. GPS) is dropped. */
export async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}
