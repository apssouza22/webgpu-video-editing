export function getExecDevice(): 'wasm' | 'webgpu' {
  if (!('gpu' in navigator)) {
    return 'wasm';
  }

  return 'webgpu';
}
