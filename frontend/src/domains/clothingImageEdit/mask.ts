// 누끼 RGBA 픽셀의 알파를 흑백 마스크 픽셀로 바꾼다. 보이는 곳은 흰색, 투명한 곳은 검은색이다.
export const convertAlphaToMask = (pixels: Uint8ClampedArray) => {
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    pixels[index] = alpha;
    pixels[index + 1] = alpha;
    pixels[index + 2] = alpha;
    pixels[index + 3] = 255;
  }

  return pixels;
};
