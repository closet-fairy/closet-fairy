export const readImagePixels = (image: HTMLImageElement, maxSide: number) => {
  const { naturalWidth, naturalHeight } = image;

  if (naturalWidth === 0 || naturalHeight === 0) return null;

  const scale = Math.min(maxSide / Math.max(naturalWidth, naturalHeight), 1);
  const canvas = document.createElement('canvas');

  canvas.width = Math.max(Math.round(naturalWidth * scale), 1);
  canvas.height = Math.max(Math.round(naturalHeight * scale), 1);

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (context === null) return null;

  // 다른 출처의 사진은 CORS 허용이 없으면 픽셀을 읽을 수 없어 예외가 난다.
  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
};
