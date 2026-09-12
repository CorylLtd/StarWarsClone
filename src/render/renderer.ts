import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { CAMERA, SCREEN } from '../game/config';
import type { Rng } from '../game/random';
import type { GameEvent, GameState } from '../game/types';
import { edge, LineMaterials, linesFromEdges, type EdgeList } from './lines';
import { createStarfield } from './starfield';

/** The colour vector monitor's phosphors, near enough. */
export const COLOR = {
  white: 0xf4f4ff,
  red: 0xff3030,
  green: 0x30ff30,
  blue: 0x4060ff,
  yellow: 0xffe030,
  cyan: 0x30f0ff,
  dimWhite: 0x8888a0,
};

const MSAA_SAMPLES = 4;
/** Retina reports 2, which quadruples the fill; 1.5 keeps 2 px lines crisp at under half the cost. */
const MAX_PIXEL_RATIO = 1.5;

/** Bloom tuning for the phosphor look, carried over from the Battlezone clone. */
export const BLOOM = {
  strength: 0.2,
  radius: 0.1,
  threshold: 0.2,
};

/**
 * Projects GameState onto a Three.js scene. Owns no game logic. The camera
 * reads the same CAMERA record as the simulation's projection, so what the
 * simulation says is under the cursor is what the player sees there.
 */
export class WorldRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly materials: LineMaterials;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly placeholders: LineSegments2[] = [];

  constructor(
    private readonly container: HTMLElement,
    rng: Rng,
  ) {
    const { width, height } = this.size();
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.domElement.className = 'world';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(CAMERA.fovYDeg, SCREEN.aspect, CAMERA.near, CAMERA.far);
    this.camera.rotation.order = 'YXZ';
    this.materials = new LineMaterials(width, height);

    this.scene.add(createStarfield(rng, COLOR.dimWhite));
    this.addPlaceholders();

    const pixelRatio = this.renderer.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
      samples: MSAA_SAMPLES,
      type: THREE.HalfFloatType,
    });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  private size(): { width: number; height: number } {
    return { width: Math.max(1, this.container.clientWidth), height: Math.max(1, this.container.clientHeight) };
  }

  /** Call whenever the screen frame changes size. */
  resize(): void {
    const { width, height } = this.size();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.materials.resize(width, height);
    this.bloom.setSize(width, height);
  }

  /**
   * Skeleton stand-ins so the vector look can be judged: a few coloured
   * wireframes ahead of the camera. Removed once traced shapes arrive.
   */
  private addPlaceholders(): void {
    const specs: { color: number; pos: [number, number, number]; size: number }[] = [
      { color: COLOR.red, pos: [-60, 10, -220], size: 14 },
      { color: COLOR.green, pos: [50, -15, -300], size: 18 },
      { color: COLOR.blue, pos: [0, 30, -420], size: 22 },
      { color: COLOR.yellow, pos: [90, 25, -520], size: 20 },
    ];
    for (const s of specs) {
      const mesh = linesFromEdges(octahedronEdges(s.size), this.materials.make(s.color));
      mesh.position.set(...s.pos);
      this.scene.add(mesh);
      this.placeholders.push(mesh);
    }
  }

  handleEvent(_event: GameEvent): void {}

  render(state: GameState, dt: number): void {
    this.camera.rotation.set(state.view.pitch, state.view.yaw, state.view.roll);
    for (const [i, m] of this.placeholders.entries()) {
      m.rotation.y += dt * (0.4 + i * 0.15);
      m.rotation.x += dt * 0.25;
    }
    this.composer.render();
  }
}

function octahedronEdges(r: number): EdgeList {
  const out: EdgeList = [];
  const top: [number, number, number] = [0, r, 0];
  const bottom: [number, number, number] = [0, -r, 0];
  const ring: [number, number, number][] = [
    [r, 0, 0],
    [0, 0, r],
    [-r, 0, 0],
    [0, 0, -r],
  ];
  for (let i = 0; i < 4; i++) {
    edge(out, ring[i], ring[(i + 1) % 4]);
    edge(out, top, ring[i]);
    edge(out, bottom, ring[i]);
  }
  return out;
}
