import type { TextCanvasElement } from '@opensource/video-preview';

/**
 * Renders a text canvas element to a PNG object URL for GPU image compositing.
 */
export async function rasterizeTextElement(element: TextCanvasElement): Promise<string> {
  const width = Math.max(1, Math.round(element.width));
  const height = Math.max(1, Math.round(element.height));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to create 2D canvas context for text rasterization');
  }

  if (element.backgroundColor && element.backgroundColor !== 'transparent') {
    context.fillStyle = element.backgroundColor;
    context.fillRect(0, 0, width, height);
  }

  context.fillStyle = element.color;
  context.font = `${element.fontWeight} ${element.fontSize}px ${element.fontFamily}`;
  context.textAlign = element.textAlign;
  context.textBaseline = 'middle';

  const padding = 8;
  const textX =
    element.textAlign === 'left'
      ? padding
      : element.textAlign === 'right'
        ? width - padding
        : width / 2;

  const lines = element.content.split('\n');
  const lineHeight = element.fontSize * 1.2;
  const blockHeight = lines.length * lineHeight;
  let y = height / 2 - blockHeight / 2 + lineHeight / 2;

  for (const line of lines) {
    context.fillText(line, textX, y, width - padding * 2);
    y += lineHeight;
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
        return;
      }
      reject(new Error('Failed to rasterize text element'));
    }, 'image/png');
  });

  return URL.createObjectURL(blob);
}
