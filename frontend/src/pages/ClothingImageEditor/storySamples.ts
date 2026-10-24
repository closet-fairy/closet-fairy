export const SAMPLE_SIZE = { width: 480, height: 640 };

const drawGarment = (context: CanvasRenderingContext2D) => {
  context.beginPath();
  context.moveTo(150, 120);
  context.lineTo(330, 120);
  context.lineTo(440, 260);
  context.lineTo(390, 300);
  context.lineTo(340, 250);
  context.lineTo(340, 560);
  context.lineTo(140, 560);
  context.lineTo(140, 250);
  context.lineTo(90, 300);
  context.lineTo(40, 260);
  context.closePath();
};

const createCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE.width;
  canvas.height = SAMPLE_SIZE.height;

  return canvas;
};

const drawBase = (context: CanvasRenderingContext2D) => {
  const background = context.createLinearGradient(
    0,
    0,
    SAMPLE_SIZE.width,
    SAMPLE_SIZE.height,
  );
  background.addColorStop(0, '#d9c7a8');
  background.addColorStop(1, '#8c7a5e');
  context.fillStyle = background;
  context.fillRect(0, 0, SAMPLE_SIZE.width, SAMPLE_SIZE.height);
  context.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  for (let y = 0; y < SAMPLE_SIZE.height; y += 24) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(SAMPLE_SIZE.width, y);
    context.stroke();
  }
  drawGarment(context);
  context.fillStyle = '#3b5b8c';
  context.fill();
  context.fillStyle = '#f2f2f2';
  context.fillRect(150, 300, 180, 18);
};

const drawDefaultMask = (context: CanvasRenderingContext2D) => {
  context.fillStyle = '#000';
  context.fillRect(0, 0, SAMPLE_SIZE.width, SAMPLE_SIZE.height);
  drawGarment(context);
  context.fillStyle = '#fff';
  context.fill();
};

// 붓으로 오른쪽 소매 한 군데를 지운 마스크다.
const drawEditedMask = (context: CanvasRenderingContext2D) => {
  drawDefaultMask(context);
  context.fillStyle = '#000';
  context.beginPath();
  context.arc(380, 280, 34, 0, Math.PI * 2);
  context.fill();
};

const createDrawnCanvas = (
  draw: (context: CanvasRenderingContext2D) => void,
) => {
  const canvas = createCanvas();
  const context = canvas.getContext('2d');

  if (context !== null) {
    draw(context);
  }

  return canvas;
};

/*
 * 레포에 사진 자산을 두지 않으려고, 배경이 있는 원본과 마스크를 직접 그린다.
 * 기본 마스크는 누끼 그대로이고, 편집된 마스크는 소매 한 군데를 지운 것이다.
 */
export const createStorySamples = () => ({
  base: createDrawnCanvas(drawBase),
  defaultMask: createDrawnCanvas(drawDefaultMask),
  editedMask: createDrawnCanvas(drawEditedMask),
});
