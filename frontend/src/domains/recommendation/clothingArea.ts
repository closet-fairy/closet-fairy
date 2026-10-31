export interface ClothingArea {
  left: number;
  top: number;
  width: number;
  height: number;
  ratio: number;
}

interface PixelBlob {
  size: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const ALPHA_THRESHOLD = 24;
const MIN_BLOB_SHARE = 0.01;

type AlphaImage = Pick<ImageData, 'data' | 'width' | 'height'>;

const measureBlobs = ({ data, width, height }: AlphaImage) => {
  const pixelCount = width * height;
  const isUnvisited = new Uint8Array(pixelCount);

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    isUnvisited[pixel] = data[pixel * 4 + 3] >= ALPHA_THRESHOLD ? 1 : 0;
  }

  const blobs: PixelBlob[] = [];
  const stack = new Int32Array(pixelCount);

  for (let start = 0; start < pixelCount; start += 1) {
    if (isUnvisited[start] === 0) continue;

    const blob = {
      size: 0,
      minX: width,
      maxX: 0,
      minY: height,
      maxY: 0,
    };
    let stackSize = 1;

    stack[0] = start;
    isUnvisited[start] = 0;

    while (stackSize > 0) {
      stackSize -= 1;

      const pixel = stack[stackSize];
      const x = pixel % width;
      const y = Math.floor(pixel / width);

      blob.size += 1;
      blob.minX = Math.min(blob.minX, x);
      blob.maxX = Math.max(blob.maxX, x);
      blob.minY = Math.min(blob.minY, y);
      blob.maxY = Math.max(blob.maxY, y);

      for (let nextY = Math.max(y - 1, 0); nextY <= y + 1; nextY += 1) {
        for (let nextX = Math.max(x - 1, 0); nextX <= x + 1; nextX += 1) {
          const next = nextY * width + nextX;

          if (nextY < height && nextX < width && isUnvisited[next] === 1) {
            isUnvisited[next] = 0;
            stack[stackSize] = next;
            stackSize += 1;
          }
        }
      }
    }

    blobs.push(blob);
  }

  return blobs;
};

// 누끼에 남은 작은 점 하나가 영역을 넓히지 않도록, 가장 큰 덩어리에 견줘 아주 작은 덩어리는 뺀다.
export const getClothingArea = (
  image: AlphaImage,
  sourceRatio: number,
): ClothingArea | null => {
  const blobs = measureBlobs(image);

  if (blobs.length === 0) return null;

  const minSize = Math.max(...blobs.map(({ size }) => size)) * MIN_BLOB_SHARE;
  const kept = blobs.filter(({ size }) => size >= minSize);
  const minX = Math.min(...kept.map((blob) => blob.minX));
  const maxX = Math.max(...kept.map((blob) => blob.maxX));
  const minY = Math.min(...kept.map((blob) => blob.minY));
  const maxY = Math.max(...kept.map((blob) => blob.maxY));
  const width = (maxX + 1 - minX) / image.width;
  const height = (maxY + 1 - minY) / image.height;

  return {
    left: minX / image.width,
    top: minY / image.height,
    width,
    height,
    ratio: (width / height) * sourceRatio,
  };
};
