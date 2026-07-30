/**
 * Code-only IBL so metals don't go black without an HDRI file.
 * Tries RoomEnvironment + PMREM; on WebGPU this often fails — caller must
 * keep metalness moderate as a fallback.
 */

import { PMREMGenerator, type Scene, type Texture, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { WebGPURenderer } from 'three/webgpu';

export function installProceduralEnvironment(
  renderer: WebGPURenderer | WebGLRenderer,
  scene: Scene,
): Texture | null {
  try {
    // PMREMGenerator is WebGL-oriented; may throw under WebGPURenderer
    const pmrem = new PMREMGenerator(renderer as unknown as WebGLRenderer);
    const envScene = new RoomEnvironment();
    const envTex = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();
    if ('dispose' in envScene && typeof (envScene as { dispose?: () => void }).dispose === 'function') {
      (envScene as { dispose: () => void }).dispose();
    }
    return envTex;
  } catch (err) {
    console.warn('[kitchen] procedural env unavailable under this renderer', err);
    scene.environment = null;
    return null;
  }
}
