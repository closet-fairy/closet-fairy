import {
  getOutputGeometry,
  toColumnMajor,
} from '@/domains/clothingImageEdit/outputGeometry';
import type { Quad, Size } from '@/domains/clothingImageEdit/types';

export interface RenderOptions {
  corners: Quad;
  angle: number;
  faintOpacity: number;
}

export interface MaskRegion {
  x: number;
  y: number;
  imageData: ImageData;
}

export interface EditorRenderer {
  setBase: (source: TexImageSource, size: Size) => void;
  setMask: (source: TexImageSource) => void;
  updateMaskRegion: (region: MaskRegion) => void;
  render: (options: RenderOptions) => Size | null;
  dispose: () => void;
  release: () => void;
}

export class EditorRendererError extends Error {}

export const UNSUPPORTED_MESSAGE =
  '이 브라우저에서는 이미지 편집을 할 수 없어요.';

export const isWebGL2Supported = () => {
  const gl = document.createElement('canvas').getContext('webgl2');

  if (gl === null) {
    return false;
  }

  // 브라우저가 동시에 둘 수 있는 컨텍스트 수가 정해져 있어, 확인용 컨텍스트는 바로 돌려준다.
  gl.getExtension('WEBGL_lose_context')?.loseContext();

  return true;
};

const RENDER_ERROR_MESSAGE = '미리보기를 그리지 못했어요.';

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/*
 * 출력 픽셀마다 회전을 거꾸로 풀고 원근을 거꾸로 풀어 원본 픽셀을 찾는다.
 * outputGeometry.ts의 mapOutputToSource와 같은 계산이다.
 * 원근을 편 사각형 밖은 잘려 나간 부분이라, 회전으로 커진 귀퉁이에 비치지 않게 투명으로 둔다.
 * 바탕 알파는 있고 없음만 본다. 누끼를 바탕으로 쓰면 누끼 알파가 마스크와 두 번 곱해져 가장자리가 얇아지기 때문이다.
 */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_base;
uniform sampler2D u_mask;
uniform vec2 u_outputSize;
uniform vec2 u_perspectiveSize;
uniform vec2 u_sourceSize;
uniform vec2 u_inverseRotation;
uniform mat3 u_perspectiveToSource;
uniform float u_faintOpacity;

out vec4 outColor;

void main() {
  vec2 outputPoint = vec2(gl_FragCoord.x, u_outputSize.y - gl_FragCoord.y);
  vec2 offset = outputPoint - u_outputSize * 0.5;
  float c = u_inverseRotation.x;
  float s = u_inverseRotation.y;
  vec2 perspectivePoint =
    vec2(c * offset.x + s * offset.y, -s * offset.x + c * offset.y) +
    u_perspectiveSize * 0.5;

  if (
    perspectivePoint.x < 0.0 || perspectivePoint.y < 0.0 ||
    perspectivePoint.x > u_perspectiveSize.x || perspectivePoint.y > u_perspectiveSize.y
  ) {
    outColor = vec4(0.0);
    return;
  }

  vec3 projected = u_perspectiveToSource * vec3(perspectivePoint, 1.0);

  if (projected.z <= 0.0) {
    outColor = vec4(0.0);
    return;
  }

  vec2 sourcePoint = projected.xy / projected.z;

  if (
    sourcePoint.x < 0.0 || sourcePoint.y < 0.0 ||
    sourcePoint.x > u_sourceSize.x || sourcePoint.y > u_sourceSize.y
  ) {
    outColor = vec4(0.0);
    return;
  }

  vec2 uv = sourcePoint / u_sourceSize;
  vec4 base = texture(u_base, uv);
  float mask = texture(u_mask, uv).r;
  float alpha = mix(u_faintOpacity, 1.0, mask) * step(0.5 / 255.0, base.a);

  outColor = vec4(base.rgb * alpha, alpha);
}
`;

const getUniforms = (gl: WebGL2RenderingContext, program: WebGLProgram) => ({
  base: gl.getUniformLocation(program, 'u_base'),
  mask: gl.getUniformLocation(program, 'u_mask'),
  outputSize: gl.getUniformLocation(program, 'u_outputSize'),
  perspectiveSize: gl.getUniformLocation(program, 'u_perspectiveSize'),
  sourceSize: gl.getUniformLocation(program, 'u_sourceSize'),
  inverseRotation: gl.getUniformLocation(program, 'u_inverseRotation'),
  perspectiveToSource: gl.getUniformLocation(program, 'u_perspectiveToSource'),
  faintOpacity: gl.getUniformLocation(program, 'u_faintOpacity'),
});

interface GlState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  uniforms: ReturnType<typeof getUniforms>;
  baseTexture: WebGLTexture;
  maskTexture: WebGLTexture;
}

const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) => {
  const shader = gl.createShader(type);

  if (shader === null) {
    throw new EditorRendererError(UNSUPPORTED_MESSAGE);
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new EditorRendererError(UNSUPPORTED_MESSAGE, { cause: log });
  }

  return shader;
};

const createTexture = (gl: WebGL2RenderingContext) => {
  const texture = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
};

const initialize = (
  canvas: HTMLCanvasElement,
  preserveDrawingBuffer: boolean,
): GlState => {
  const gl = canvas.getContext('webgl2', {
    premultipliedAlpha: true,
    preserveDrawingBuffer,
    antialias: false,
  });

  if (gl === null) {
    throw new EditorRendererError(UNSUPPORTED_MESSAGE);
  }

  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(
    program,
    compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER),
  );
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new EditorRendererError(UNSUPPORTED_MESSAGE, {
      cause: gl.getProgramInfoLog(program),
    });
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // 누끼와 마스크의 알파·색을 그대로 읽어야 해서, 미리 곱하거나 뒤집지 않는다.
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

  return {
    gl,
    program,
    buffer,
    uniforms: getUniforms(gl, program),
    baseTexture: createTexture(gl),
    maskTexture: createTexture(gl),
  };
};

interface CreateEditorRendererOptions {
  preserveDrawingBuffer?: boolean;
  onRestored?: () => void;
  onError?: (error: unknown) => void;
}

export const createEditorRenderer = (
  canvas: HTMLCanvasElement,
  options: CreateEditorRendererOptions = {},
): EditorRenderer => {
  const { preserveDrawingBuffer = false, onRestored, onError } = options;
  let state: GlState | null = initialize(canvas, preserveDrawingBuffer);
  let baseSource: { source: TexImageSource; size: Size } | null = null;
  let maskSource: TexImageSource | null = null;

  const uploadTexture = (
    getTexture: (glState: GlState) => WebGLTexture,
    source: TexImageSource,
  ) => {
    if (state === null) {
      return;
    }

    const { gl } = state;
    gl.bindTexture(gl.TEXTURE_2D, getTexture(state));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  };

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    state = null;
  };

  // iOS는 앱을 백그라운드로 보내면 WebGL 컨텍스트를 잃을 수 있어, 복구되면 들고 있던 원본으로 다시 올린다.
  const handleContextRestored = () => {
    try {
      state = initialize(canvas, preserveDrawingBuffer);
    } catch (error) {
      onError?.(error);
      return;
    }

    if (baseSource !== null) {
      uploadTexture((glState) => glState.baseTexture, baseSource.source);
    }

    if (maskSource !== null) {
      uploadTexture((glState) => glState.maskTexture, maskSource);
    }

    onRestored?.();
  };

  canvas.addEventListener('webglcontextlost', handleContextLost);
  canvas.addEventListener('webglcontextrestored', handleContextRestored);

  const dispose = () => {
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored);

    if (state !== null) {
      const { gl, program, buffer, baseTexture, maskTexture } = state;
      gl.deleteTexture(baseTexture);
      gl.deleteTexture(maskTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    }
  };

  return {
    setBase: (source, size) => {
      baseSource = { source, size };
      uploadTexture((glState) => glState.baseTexture, source);
    },
    setMask: (source) => {
      maskSource = source;
      uploadTexture((glState) => glState.maskTexture, source);
    },
    updateMaskRegion: ({ x, y, imageData }) => {
      if (state === null) {
        return;
      }

      const { gl, maskTexture } = state;
      gl.bindTexture(gl.TEXTURE_2D, maskTexture);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        x,
        y,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imageData,
      );
    },
    render: (renderOptions) => {
      if (state === null || baseSource === null || maskSource === null) {
        return null;
      }

      const geometry = getOutputGeometry(
        baseSource.size,
        renderOptions.corners,
        renderOptions.angle,
      );

      // 컨텍스트를 잃은 경우와 달리, 아래 두 실패는 같은 옵션으로 다시 그려도 그대로라 알린다.
      if (geometry === null) {
        onError?.(new EditorRendererError(RENDER_ERROR_MESSAGE));
        return null;
      }

      const { gl, uniforms, baseTexture, maskTexture } = state;
      const {
        outputSize,
        perspectiveSize,
        inverseRotation,
        perspectiveToSource,
      } = geometry;

      canvas.width = outputSize.width;
      canvas.height = outputSize.height;

      // 드로잉 버퍼가 한도에 걸려 줄어들면 결과가 조용히 작아지므로 그리지 않는다.
      if (
        gl.drawingBufferWidth !== outputSize.width ||
        gl.drawingBufferHeight !== outputSize.height
      ) {
        onError?.(new EditorRendererError(RENDER_ERROR_MESSAGE));
        return null;
      }

      gl.viewport(0, 0, outputSize.width, outputSize.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, baseTexture);
      gl.uniform1i(uniforms.base, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, maskTexture);
      gl.uniform1i(uniforms.mask, 1);

      gl.uniform2f(uniforms.outputSize, outputSize.width, outputSize.height);
      gl.uniform2f(
        uniforms.perspectiveSize,
        perspectiveSize.width,
        perspectiveSize.height,
      );
      gl.uniform2f(
        uniforms.sourceSize,
        baseSource.size.width,
        baseSource.size.height,
      );
      gl.uniform2f(
        uniforms.inverseRotation,
        inverseRotation[0],
        inverseRotation[1],
      );
      gl.uniformMatrix3fv(
        uniforms.perspectiveToSource,
        false,
        toColumnMajor(perspectiveToSource),
      );
      gl.uniform1f(uniforms.faintOpacity, renderOptions.faintOpacity);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      return outputSize;
    },
    dispose,
    // 한 번 쓰고 버리는 렌더러는 컨텍스트까지 돌려준다. 브라우저가 동시에 둘 수 있는 컨텍스트 수가 정해져 있다.
    release: () => {
      const gl = state?.gl;
      dispose();
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      state = null;
    },
  };
};

const createPngBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });

// 저장할 표시 이미지를 미리보기와 같은 렌더러로 그려 PNG로 뽑는다.
export const renderToPngBlob = async (
  base: TexImageSource,
  size: Size,
  mask: TexImageSource,
  options: Omit<RenderOptions, 'faintOpacity'>,
) => {
  const canvas = document.createElement('canvas');
  const renderer = createEditorRenderer(canvas, {
    preserveDrawingBuffer: true,
  });

  try {
    renderer.setBase(base, size);
    renderer.setMask(mask);

    if (renderer.render({ ...options, faintOpacity: 0 }) === null) {
      throw new EditorRendererError('표시 이미지를 그리지 못했어요.');
    }

    const blob = await createPngBlob(canvas);

    if (blob === null) {
      throw new EditorRendererError('표시 이미지를 만들지 못했어요.');
    }

    return blob;
  } finally {
    renderer.release();
  }
};
