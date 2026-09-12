/**
 * Sound engine stub. The POKEY effects, the TMS5220 speech model and the music
 * arrive in their own milestones; for now this only owns the AudioContext so
 * the unlock-on-gesture wiring is in place.
 */
export class SoundEngine {
  private context: AudioContext | null = null;

  /** Browsers refuse to start audio without a user gesture; call from a key or pointer handler. */
  unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    this.context = new AudioContext();
  }
}
