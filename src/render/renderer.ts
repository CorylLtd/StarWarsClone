import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import {
  COCKPIT,
  COCKPIT_SHIFT,
  DEATH_STAR_DETAIL,
  DEATH_STAR_MINI,
  GAUGE,
  GAUGE_BASE,
  GAUGE_DIGIT,
  GAUGE_TITLE,
  HUD_TEXT,
} from '../data/hud';
import {
  CURSOR,
  DARTHS_SHIP,
  FIREBALL_BASES,
  FIREBALL_FUSE_TIPS,
  FIREBALL_HURT_TIPS,
  FIREBALL_TIPS,
  LASER_COLOURS,
  LASER_SPLASHES,
  TIE_FIGHTER,
  TIE_PIECE_CABIN,
  TIE_PIECE_PORT_WING,
  TIE_PIECE_STBD_WING,
} from '../data/vectorRom';
import { DOGFIGHT, LASER, SELECT, VG } from '../game/config';
import { visibleStars } from '../game/dogfight/stars';
import { toView } from '../game/frame';
import type { Alien, GameEvent, GameState } from '../game/types';
import { selectTarget } from '../game/update';
import { ArcadeCamera } from './arcadeCamera';
import { alienGlowColor, explosionColor, FLASH_CYCLE, gaugeColorName, vgColor } from './colors';
import { LineMaterials, linesFromEdges } from './lines';
import { LineSet } from './lineSet';
import { modelEdges, placeFromOriginal } from './models';
import { drawSurface, GROUND_DOT_COLOR } from './surfaceView';
import { drawDeathStarEnd, drawTorpedo, drawTrench, drawTrenchMessages } from './trenchView';
import { drawAttractScreen, drawInitialsScreen } from './attractView';
import { drawNumber, drawText, textWidth } from './text';

const MSAA_SAMPLES = 4;
const MAX_PIXEL_RATIO = 1.5;

/** Bloom tuning for the phosphor look, carried over from the Battlezone clone. */
export const BLOOM = {
  strength: 0.06,
  radius: 0.05,
  threshold: 0.5,
};

interface AlienMeshes {
  tie: LineSegments2;
  darth: LineSegments2;
  material: LineMaterial;
}

/**
 * Projects GameState onto two Three.js scenes: a 3-D scene seen through the
 * arcade camera, and a 2-D overlay in vector-generator units for everything
 * the original drew flat (cursor, lasers, fireballs, cockpit, HUD, text).
 * Owns no game logic.
 */
export class WorldRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new ArcadeCamera();
  private readonly overlay = new THREE.Scene();
  private readonly overlayCamera: THREE.OrthographicCamera;
  private readonly materials: LineMaterials;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly aliens: AlienMeshes[] = [];
  private readonly pieces: { port: LineSegments2; stbd: LineSegments2; cabin: LineSegments2; material: LineMaterial }[] = [];
  private readonly flat: LineSet;
  private readonly stars: THREE.Points;
  private readonly starPositions: Float32Array;
  private readonly flash: THREE.Mesh;
  /** Buildings and fragments of the surface, rebuilt every frame in camera-relative coordinates. */
  private readonly ground: LineSet;
  private readonly groundDots: THREE.Points;
  private readonly groundDotPositions: Float32Array;
  private frame = 0;

  constructor(private readonly container: HTMLElement) {
    const { width, height } = this.size();
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.autoClear = false;
    this.renderer.domElement.className = 'world';
    container.appendChild(this.renderer.domElement);

    this.materials = new LineMaterials(width, height);
    this.overlayCamera = new THREE.OrthographicCamera(-VG.halfWidth, VG.halfWidth, VG.halfHeight, -VG.halfHeight, -10, 10);

    for (let i = 0; i < DOGFIGHT.alienSlots; i++) {
      const material = this.materials.make(0x30ff30);
      const tie = linesFromEdges(modelEdges(TIE_FIGHTER), material);
      const darth = linesFromEdges(modelEdges(DARTHS_SHIP), material);
      tie.visible = darth.visible = false;
      tie.frustumCulled = darth.frustumCulled = false;
      this.scene.add(tie, darth);
      this.aliens.push({ tie, darth, material });
    }
    for (let i = 0; i < 8; i++) {
      const material = this.materials.make(0xffe030);
      const port = linesFromEdges(modelEdges(TIE_PIECE_PORT_WING), material);
      const stbd = linesFromEdges(modelEdges(TIE_PIECE_STBD_WING), material);
      const cabin = linesFromEdges(modelEdges(TIE_PIECE_CABIN), material);
      for (const m of [port, stbd, cabin]) {
        m.visible = false;
        m.frustumCulled = false;
        this.scene.add(m);
      }
      this.pieces.push({ port, stbd, cabin, material });
    }

    this.flat = new LineSet(2048, width, height);
    this.overlay.add(this.flat.mesh);
    this.ground = new LineSet(1024, width, height);
    this.scene.add(this.ground.mesh);
    this.groundDotPositions = new Float32Array(64 * 3);
    const dotGeom = new THREE.BufferGeometry();
    dotGeom.setAttribute('position', new THREE.BufferAttribute(this.groundDotPositions, 3));
    this.groundDots = new THREE.Points(dotGeom, new THREE.PointsMaterial({ color: GROUND_DOT_COLOR, size: 2.5, sizeAttenuation: false }));
    this.groundDots.frustumCulled = false;
    this.groundDots.visible = false;
    this.scene.add(this.groundDots);

    this.starPositions = new Float32Array(64 * 3);
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(this.starPositions, 3));
    this.stars = new THREE.Points(starGeom, new THREE.PointsMaterial({ color: 0xc8c8dc, size: 2.5, sizeAttenuation: false }));
    this.stars.frustumCulled = false;
    this.overlay.add(this.stars);

    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(VG.halfWidth * 2, VG.halfHeight * 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }),
    );
    this.flash.visible = false;
    this.overlay.add(this.flash);

    const pixelRatio = this.renderer.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
      samples: MSAA_SAMPLES,
      type: THREE.HalfFloatType,
    });
    // Dev tuning: ?bloom=strength,radius,threshold overrides the defaults.
    const params = new URLSearchParams(location.search);
    const tune = (params.get('bloom') ?? '').split(',').map(Number);
    const strength = Number.isFinite(tune[0]) && tune.length === 3 ? tune[0] : BLOOM.strength;
    const radius = tune.length === 3 ? tune[1] : BLOOM.radius;
    const threshold = tune.length === 3 ? tune[2] : BLOOM.threshold;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), strength, radius, threshold);
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const overlayPass = new RenderPass(this.overlay, this.overlayCamera);
    overlayPass.clear = false;
    this.composer.addPass(overlayPass);
    // Open the game with ?nobloom to judge the raw lines.
    if (!params.has('nobloom')) this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  private size(): { width: number; height: number } {
    return { width: Math.max(1, this.container.clientWidth), height: Math.max(1, this.container.clientHeight) };
  }

  resize(): void {
    const { width, height } = this.size();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.materials.resize(width, height);
    this.flat.resize(width, height);
    this.ground.resize(width, height);
    this.bloom.setSize(width, height);
  }

  handleEvent(_event: GameEvent): void {}

  render(state: GameState, _dt: number): void {
    this.frame += 1;
    const p = state.player;
    this.camera.setBasis(p.basis);
    const playing = state.mode === 'playing' || state.mode === 'dying';
    const onSurface = playing && state.stage === 'surface';
    const inTrench = playing && state.stage === 'trench' && state.trench.phase === 'flying';
    const afterTrench = playing && state.stage === 'trench' && state.trench.phase !== 'flying';
    const inSpace = playing && state.stage === 'dogfight';

    this.drawAliens(state, inSpace);
    this.drawPieces(state, inSpace);
    this.drawStars(state, inSpace || (afterTrench && state.trench.phase === 'next') || state.mode === 'attract');
    this.ground.begin();
    if (onSurface) {
      const n = drawSurface(state, this.ground, this.groundDotPositions);
      this.groundDots.geometry.setDrawRange(0, n);
      (this.groundDots.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      this.groundDots.visible = n > 0;
    } else {
      this.groundDots.visible = false;
    }
    if (inTrench) drawTrench(state, this.ground, this.frame);
    this.ground.end();

    const f = this.flat;
    f.begin();
    if (playing) {
      if (inSpace) this.drawDeathStar(state);
      if (!afterTrench) {
        this.drawFireballs(state);
        this.drawLasers(state);
        this.drawCockpit(state);
        if (state.mode === 'playing') this.drawCursor(state);
      }
      this.drawHud(state);
      if (onSurface) this.drawSurfaceMessages(state);
      if (inTrench) {
        drawTorpedo(state, this.flat, this.frame);
        drawTrenchMessages(state, this.flat, this.frame);
      }
      if (afterTrench) {
        drawDeathStarEnd(state, this.flat, this.frame);
        if (state.trench.force === 1 && state.trench.phase === 'explosion1') drawTrenchMessages(state, this.flat, this.frame);
      }
      if (state.mode === 'dying') this.drawGameOverGrowing(state);
    } else if (state.mode === 'select') {
      this.drawSelect(state);
      this.drawHud(state);
      this.drawCursor(state);
    } else if (state.mode === 'initials') {
      this.drawInitials(state);
      this.drawCursor(state);
    } else {
      this.drawAttract(state);
    }
    f.end();
    this.flash.visible = playing && p.flashFrames > 0 && p.flashFrames % 4 !== 0;

    this.renderer.clear();
    this.composer.render();
  }

  private drawAliens(state: GameState, inSpace: boolean): void {
    for (let i = 0; i < this.aliens.length; i++) {
      const m = this.aliens[i];
      const a: Alien | null = inSpace ? state.dogfight.aliens[i] : null;
      if (!a || !a.drawn) {
        m.tie.visible = m.darth.visible = false;
        continue;
      }
      const mesh = a.kind === 'tie' ? m.tie : m.darth;
      (a.kind === 'tie' ? m.darth : m.tie).visible = false;
      mesh.visible = true;
      placeFromOriginal(mesh, a.pos, a.basis);
      m.material.color.copy(alienGlowColor(a.glow));
    }
  }

  private drawPieces(state: GameState, inSpace: boolean): void {
    const pieces = inSpace ? state.dogfight.explosions : [];
    for (let i = 0; i < this.pieces.length; i++) {
      const slot = this.pieces[i];
      const piece = pieces[i];
      slot.port.visible = slot.stbd.visible = slot.cabin.visible = false;
      if (!piece) continue;
      const mesh = piece.shape === 'portWing' ? slot.port : piece.shape === 'stbdWing' ? slot.stbd : slot.cabin;
      mesh.visible = true;
      placeFromOriginal(mesh, piece.pos, state.dogfight.munge);
      slot.material.color.copy(explosionColor(piece.timer));
    }
  }

  private drawStars(state: GameState, inSpace: boolean): void {
    const pts = inSpace ? visibleStars(state) : [];
    for (let i = 0; i < pts.length && i < 64; i++) {
      this.starPositions[i * 3] = pts[i].x;
      this.starPositions[i * 3 + 1] = pts[i].y + VG.offsetY;
      this.starPositions[i * 3 + 2] = -1;
    }
    this.stars.geometry.setDrawRange(0, Math.min(pts.length, 64));
    (this.stars.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.stars.visible = pts.length > 0;
  }

  private drawCursor(state: GameState): void {
    const c = state.player.cursor;
    const color = state.mode === 'select' && selectTarget(state) >= 0 ? vgColor('YLW') : vgColor('TRQ');
    for (const stroke of CURSOR) this.flat.polyline(stroke, color, c.x, c.y + VG.offsetY);
  }

  private hoodShift(state: GameState): { x: number; y: number } {
    const pot = state.player.cursorPot;
    return {
      x: Math.sign(pot.x) * Math.floor(Math.abs(pot.x) * COCKPIT_SHIFT.x),
      y: Math.sign(pot.y) * Math.floor(Math.abs(pot.y) * COCKPIT_SHIFT.y),
    };
  }

  private drawCockpit(state: GameState): void {
    const shift = this.hoodShift(state);
    for (const strokes of Object.values(COCKPIT)) {
      for (const s of strokes) this.flat.polyline(s.points, vgColor(s.color, s.lum), shift.x, shift.y);
    }
  }

  private drawLasers(state: GameState): void {
    const p = state.player;
    if (p.laserFrames === 0 && p.laserHit === 0) return;
    const shift = this.hoodShift(state);
    const guns = p.laserLeftPair ? [LASER.guns.upperLeft, LASER.guns.lowerLeft] : [LASER.guns.upperRight, LASER.guns.lowerRight];
    const end = { x: p.laserAt.x, y: p.laserAt.y + VG.offsetY };
    for (const [g, gun] of guns.entries()) {
      const start = { x: gun.x + shift.x, y: gun.y + shift.y };
      if (p.laserHit > 0) {
        this.flat.segment(start.x, start.y, 0, end.x, end.y, 0, vgColor('TRQ', p.laserHit * 0x3f));
        continue;
      }
      // Successive halves of the remaining distance, each in the next colour of the rotating table.
      let x = start.x;
      let y = start.y;
      const offset = g === 0 ? 0 : 4;
      for (let i = 0; i < 8; i++) {
        const last = Math.abs(end.x - x) <= 8 && Math.abs(end.y - y) <= 8;
        const nx = last ? end.x : x + (end.x - x) / 2;
        const ny = last ? end.y : y + (end.y - y) / 2;
        const [name, lum] = LASER_COLOURS[(i + offset + this.frame) % LASER_COLOURS.length];
        if (lum > 0) this.flat.segment(x, y, 0, nx, ny, 0, vgColor(name, lum));
        x = nx;
        y = ny;
        if (last) break;
      }
    }
    if (p.laserHit > 0) {
      const splash = LASER_SPLASHES[this.frame % LASER_SPLASHES.length];
      for (const stroke of splash.polylines) this.flat.polyline(stroke, vgColor(splash.color, 0xff), end.x, end.y);
    }
  }

  private drawFireballs(state: GameState): void {
    for (const fb of state.dogfight.fireballs) {
      // A shot fired after this frame's projection has no screen position yet; drawing it would flash it full size at the centre.
      if (!fb || fb.halfDistance <= 0) continue;
      const cx = fb.at.x;
      const cy = fb.at.y + VG.offsetY;
      const factor = Math.min(4, Math.max(1 / 64, 512 / Math.max(1, fb.halfDistance)));
      if (fb.kind === 'live') {
        const base = FIREBALL_BASES[Math.floor(this.frame / 4) % 4];
        const red = vgColor('RED', 0xff);
        for (const stroke of base) this.flat.polyline(stroke, red, cx, cy, factor);
        const tips = FIREBALL_TIPS[this.frame % 4];
        const flash = vgColor(FLASH_CYCLE[this.frame % 7], 0xff);
        for (const tip of FIREBALL_FUSE_TIPS[Math.floor(this.frame / 4) % 4]) {
          for (const stroke of tips) this.flat.polyline(stroke, flash, cx + tip[0] * factor, cy + tip[1] * factor, factor);
        }
      } else if (fb.kind === 'hurt') {
        const purple = vgColor('PRP', Math.min(0xff, 16 * fb.timer + 0x0f));
        const hf = Math.min(2, Math.max(1 / 8, factor * 2));
        const tips = FIREBALL_TIPS[this.frame % 4];
        for (const tip of FIREBALL_HURT_TIPS[this.frame % 4]) {
          for (const stroke of tips) this.flat.polyline(stroke, purple, cx + tip[0] * hf, cy + tip[1] * hf, hf);
        }
      } else {
        const white = vgColor('WHT', Math.min(0xff, 16 * fb.timer));
        const gf = (factor * fb.timer) / 15;
        const tips = FIREBALL_TIPS[this.frame % 4];
        for (const tip of FIREBALL_HURT_TIPS[this.frame % 4]) {
          for (const stroke of tips) this.flat.polyline(stroke, white, cx + tip[0] * gf, cy + tip[1] * gf, gf);
        }
      }
    }
  }

  /** The Death Star: a fixed miniature at the +X direction during the fight, growing detail during the zoom. */
  private drawDeathStar(state: GameState): void {
    const d = state.dogfight;
    const v = toView(state.player.basis, d.deathStarDir);
    if (!(v.x > 0 && Math.abs(v.y) < v.x && Math.abs(v.z) < v.x)) return;
    const cx = (VG.focal * v.y) / v.x;
    const cy = (VG.focal * v.z) / v.x + VG.offsetY;
    if (d.phase !== 'zoom') {
      for (const s of DEATH_STAR_MINI) this.flat.polyline(s.points, vgColor(s.color, s.lum), cx, cy, 0.5);
      return;
    }
    const binary = Math.floor(d.zoomScale / 128);
    const linear = d.zoomScale % 128;
    const factor = Math.pow(2, 2 - binary) * ((256 - linear) / 256);
    for (const strokes of Object.values(DEATH_STAR_DETAIL)) {
      for (const s of strokes) this.flat.polyline(s.points, vgColor(s.color, s.lum), cx, cy, factor);
    }
  }

  private drawHud(state: GameState): void {
    const f = this.flat;
    const red = vgColor('RED');
    const green = vgColor('GRN');
    drawText(f, HUD_TEXT.scoreLabel.text, HUD_TEXT.scoreLabel.x, HUD_TEXT.scoreLabel.y, red);
    drawText(f, HUD_TEXT.waveLabel.text, HUD_TEXT.waveLabel.x, HUD_TEXT.waveLabel.y, red);
    drawNumber(f, state.score, HUD_TEXT.scoreDigits.x, HUD_TEXT.scoreDigits.y, green, 8, 2);
    drawNumber(f, state.mode === 'select' ? 0 : state.wave + 1, HUD_TEXT.waveNumber.x, HUD_TEXT.waveNumber.y, green, 1);
    if (state.lastScoreFade > 32) {
      drawNumber(f, state.lastScore, HUD_TEXT.lastScore.x, HUD_TEXT.lastScore.y, vgColor('YLW', state.lastScoreFade / 2), 6, 1);
    }
    if (state.mode !== 'playing' && state.mode !== 'dying') return;
    // Shield gauge.
    const shields = Math.max(0, Math.min(9, state.shields));
    const animating = state.player.gaugeFrames > 0;
    const colorName = animating ? FLASH_CYCLE[this.frame % 7] : gaugeColorName(shields);
    const color = vgColor(colorName, animating ? 0xff : 0x80);
    if (state.shields <= 0 && !animating) {
      const text = 'SHIELD GONE';
      drawText(f, text, -textWidth(text, 2) / 2, 460, vgColor(FLASH_CYCLE[this.frame % 7], 0x80), 2);
    } else if (shields > 0) {
      const g = GAUGE[shields];
      for (const stroke of g.right) f.polyline(stroke, color, GAUGE_BASE.x, GAUGE_BASE.y);
      for (const stroke of g.left) f.polyline(stroke, color, GAUGE_BASE.x, GAUGE_BASE.y);
      drawText(f, GAUGE_TITLE.text, GAUGE_TITLE.x, GAUGE_TITLE.y, color);
      drawText(f, String(shields), GAUGE_DIGIT.x, GAUGE_DIGIT.y, color);
    }
    // First-wave hints, alternating every 16 frames for the first 100 frames.
    if (state.stage === 'dogfight' && state.firstWave && state.wave === 0 && state.dogfight.frame < 100 && state.dogfight.phase === 'fight') {
      const shoot = Math.floor(state.dogfight.frame / 16) % 2 === 0;
      const text = shoot ? 'SHOOT FIREBALLS' : 'SHOOT TIE FIGHTERS';
      drawText(f, text, -textWidth(text) / 2, VG.limitTop - 24, shoot ? vgColor('WHT') : red);
    }
  }

  /** The tower messages: points for the next tower, the towers left, and the cleared line. */
  private drawSurfaceMessages(state: GameState): void {
    const f = this.flat;
    const s = state.surface;
    const red = vgColor('RED');
    const green = vgColor('GRN');
    if (state.wave < 1) return;
    if (s.allTowersCleared) {
      drawText(f, 'CLEARED ALL LASER TOWERS', -284, 384, vgColor(FLASH_CYCLE[this.frame % 7], 0x80));
    } else if (s.towersLeft > 0) {
      if ((Math.floor(s.frame) & 0x30) !== 0) {
        drawText(f, 'POINTS NEXT TOWER', -128, 384, red);
        drawNumber(f, s.nextTowerPoints, -304, 384, green, 5, 1);
      }
    } else {
      drawText(f, '50,000 FOR SHOOTING ALL TOWERS', -356, 384, red);
    }
    drawText(f, 'TOWERS', 314, 444, red);
    drawNumber(f, s.towersLeft, 360, 408, green, 2, 1);
  }

  private drawGameOverGrowing(state: GameState): void {
    const t = Math.min(1, state.modeFrames / 32);
    const scale = 0.5 + 1.5 * t;
    const text = 'GAME OVER';
    drawText(this.flat, text, -textWidth(text, scale) / 2, -12 * scale, vgColor('TRQ'), scale);
  }

  private drawSelect(state: GameState): void {
    const f = this.flat;
    const center = (text: string, y: number, color: THREE.Color, scale = 1): void =>
      drawText(f, text, -textWidth(text, scale) / 2, y, color, scale);
    center('SELECT A DEATH STAR', 360, vgColor('RED'));
    center('FIRE LASER AT DESIRED DEATH STAR', 320, vgColor('PRP'));
    const countdown = Math.floor((state.selectFrames * 8) / SELECT.countdownFrames);
    center(`COUNTDOWN ${countdown}`, 270, vgColor('GRN'));
    const labels = [
      ['EASY', 'WAVE 1', 'NO BONUS'],
      ['MEDIUM', 'WAVE 3', 'BONUS 400,000'],
      ['HARD', 'WAVE 5', 'BONUS 800,000'],
    ];
    for (let i = 0; i < SELECT.positions.length; i++) {
      const pos = SELECT.positions[i];
      for (const s of DEATH_STAR_MINI) f.polyline(s.points, vgColor(s.color, s.lum), pos.x, pos.y);
      const colors = [vgColor('GRN'), vgColor('YLW'), vgColor('RED')];
      for (let j = 0; j < labels[i].length; j++) {
        const text = labels[i][j];
        drawText(f, text, pos.x - textWidth(text) / 2, pos.y - 110 - j * 30, colors[i]);
      }
    }
  }

  private drawAttract(state: GameState): void {
    drawAttractScreen(state, this.flat, this.frame);
  }

  private drawInitials(state: GameState): void {
    drawInitialsScreen(state, this.flat, this.frame);
  }
}
