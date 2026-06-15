export const LAYER_UNIFORM_SIZE = 48;

export interface LayerUniformClip {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

export function createLayerUniformData(
  clip: LayerUniformClip,
  aspectRatio: number,
): Float32Array {
  const centerX = clip.x + clip.width / 2;
  const centerY = clip.y + clip.height / 2;
  const data = new Float32Array(LAYER_UNIFORM_SIZE / 4);

  data[0] = clip.opacity;
  data[1] = clip.x;
  data[2] = clip.y;
  data[3] = clip.x + clip.width;
  data[4] = clip.y + clip.height;
  data[5] = (clip.rotation * Math.PI) / 180;
  data[6] = centerX;
  data[7] = centerY;
  data[8] = aspectRatio;

  return data;
}
