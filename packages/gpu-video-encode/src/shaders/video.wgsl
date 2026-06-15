struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
  );
  var uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(1.0, 0.0),
  );
  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

struct LayerUniforms {
  opacity: f32,
  rectMinX: f32,
  rectMinY: f32,
  rectMaxX: f32,
  rectMaxY: f32,
  rotationRadians: f32,
  centerX: f32,
  centerY: f32,
  aspectRatio: f32,
};

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;
@group(0) @binding(2) var<uniform> layer: LayerUniforms;

// Inverse-rotate a normalized canvas point into the layer's local space.
// X is scaled by aspect ratio so rotation matches CSS pixel-space transforms.
fn inverseRotateCanvasPoint(point: vec2f, center: vec2f, angle: f32, aspect: f32) -> vec2f {
  var p = point - center;
  p.x *= aspect;
  let s = sin(-angle);
  let c = cos(-angle);
  let rotatedX = (p.x * c - p.y * s) / aspect;
  let rotatedY = p.x * s + p.y * c;
  return vec2f(rotatedX, rotatedY) + center;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let center = vec2f(layer.centerX, layer.centerY);
  let localPoint = inverseRotateCanvasPoint(input.uv, center, layer.rotationRadians, layer.aspectRatio);

  let inRectX = step(layer.rectMinX, localPoint.x) * step(localPoint.x, layer.rectMaxX);
  let inRectY = step(layer.rectMinY, localPoint.y) * step(localPoint.y, layer.rectMaxY);
  let inRect = inRectX * inRectY;

  let rectSize = vec2f(layer.rectMaxX - layer.rectMinX, layer.rectMaxY - layer.rectMinY);
  let videoUv = select(
    vec2f(0.5),
    (localPoint - vec2f(layer.rectMinX, layer.rectMinY)) / rectSize,
    rectSize.x > 0.0001 && rectSize.y > 0.0001,
  );
  let tSample = textureSampleBaseClampToEdge(videoTexture, texSampler, clamp(videoUv, vec2f(0.0), vec2f(1.0)));
  let weight = inRect * layer.opacity;

  return vec4f(tSample.rgb, weight);
}
