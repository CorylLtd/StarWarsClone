import { diatonic, rep, type MusicCue } from './music';

/**
 * The Music Cues: original compositions for this project, played at the
 * arcade's cue points with the arcade's lengths, tempi and voice roles (lead,
 * harmony, inner voice, bass) but melodies of our own; none follows the
 * film score. Voice 1 is the lead. Each voice's units should add up to the
 * same total so the four end together.
 */

// The Dogfight's opening fanfare: 16 quarters at rate 90, about six seconds.
const theme: MusicCue = {
  voices: [
    `{rate 90} {env hard} {vol 9}
     C5e. C5s F5q. G5e A5q   Bb5q. A5e G5q F5q   D5e E5e F5q G5q. A5e   C6h.~ C6q`,
    `{rate 90} {env hard} {vol 7}
     A4e. A4s C5q. E5e F5q   G5q. F5e E5q D5q   Bb4e C5e D5q E5q. F5e   E5h.~ E5q`,
    `{rate 90} {env steel} {vol 7}
     F4q Rq A4q C5q   Bb4q Rq Bb4q Rq   Bb4q C5q Rq F4q   G4h. Rq`,
    `{rate 90} {env hard} {vol 8}
     F2q F2q C3q C3q   Bb2q Bb2q F2q F2q   Bb2q C3q F2q F2q   C3h. C3q`,
  ],
};

// The second Dogfight theme: broad, in half notes at rate 128, eight bars.
const themeB: MusicCue = {
  voices: [
    `{rate 128} {env rise} {vol 8}
     A4h. Bb4q   C5h D5h   F5h. E5q   D5w   C5h A4h   Bb4h. A4q   G4w   A4w`,
    `{rate 128} {env rise} {vol 6}
     F4h. G4q   A4h Bb4h   D5h. C5q   Bb4w   A4h F4h   G4h. F4q   E4w   F4w`,
    `{rate 128} {env rise} {vol 6}
     D4q A3q D4q A3q   F4q C4q F4q C4q   Bb3q F4q Bb3q F4q   Bb3q D4q F4q D4q
     F4q C4q A3q C4q   G3q Bb3q D4q Bb3q   C4q E4q G4q E4q   A3h. Rq`,
    `{rate 128} {env ties} {vol 10}
     D3w~ D3w   Bb2w~ Bb2w   F2w   G2w   C3h C3h   A2w`,
  ],
};

// The descent toward the Death Star: a falling line that ends unresolved, 15 quarters at rate 80.
const descent: MusicCue = {
  voices: [
    `{rate 80} {env hard} {vol 7}
     G6e F6e Eb6e D6e C6q Bb5q   Ab5e G5e F5e Eb5e D5q Rq   Eb5e F5e G5e Ab5e G5h   {vol 5} F5h.`,
    `{rate 80} {env rise} {vol 7}
     Eb6e D6e C6e Bb5e Ab5q G5q   F5e Eb5e D5e C5e B4q Rq   C5e D5e Eb5e F5e Eb5h   {vol 5} D5h.`,
    `{rate 80} {env rise} {vol 6}
     C5h Ab4h   F4h G4h   Eb4h C5h   {vol 4} B4h.`,
    `{rate 80} {env hard} {vol 8}
     C3q C3q Bb2q Bb2q   Ab2q Ab2q G2q G2q   F2q F2q Eb2q Eb2q   D2h.`,
  ],
};

// Darth's Ship's entrance: a dotted march in four bars at rate 72, all voices together.
const vader: MusicCue = {
  voices: [
    `{rate 72} {env rise} {vol 9}
     E5q B4q E5q F5q   D5e. D5s C5q B4h   C5e. C5s D5e. D5s E5q E5q   {vol 8} B4h. Rq`,
    `{rate 72} {env rise} {vol 8}
     C5q G4q C5q D5q   B4e. B4s A4q G4h   A4e. A4s B4e. B4s C5q C5q   {vol 7} G4h. Rq`,
    `{rate 72} {env rise} {vol 7}
     E4q E4q E4q D4q   G4e. G4s E4q E4h   E4e. E4s F4e. F4s G4q G4q   E4h. Rq`,
    `{rate 72} {env rise} {fenv glock} {vol 9}
     E2q E2q E2q D2q   G2e. G2s A2q E2h   A2e. A2s B2e. B2s C3q C3q   B2h. Rq`,
  ],
};

// The Surface's battle music: a triplet cell in parallel fourths, dropped by octaves and brought back.
const fourthsCell = `E5e3 E5e3 E5e3 G5e3 E5e3 D5e3 E5q C5q   D5e3 D5e3 D5e3 F5e3 D5e3 C5e3 D5q Rq`;
const fourthsUpper = `A5e3 A5e3 A5e3 C6e3 A5e3 G5e3 A5q F5q   G5e3 G5e3 G5e3 Bb5e3 G5e3 F5e3 G5q Rq`;
const fourthsPulse = `A3e E4e A3e E4e A3e E4e A3q   F3e C4e F3e C4e F3e C4e F3q`;
const fourthsBass = `A2q. A2e E2q A2q   F2q. F2e C3q F2q`;
const fourths: MusicCue = {
  voices: [
    `{rate 96} {env steel} {vol 5} {key 0} ${fourthsUpper} {vol 6} {key -12} ${fourthsUpper} {key -24} ${fourthsUpper} {vol 7} {key 0} ${fourthsUpper}`,
    `{rate 96} {env steel} {vol 5} {key 0} ${fourthsCell} {vol 6} {key -12} ${fourthsCell} {key -24} ${fourthsCell} {vol 7} {key 0} ${fourthsCell}`,
    `{rate 96} {env rise} {vol 6} {key 0} ${fourthsPulse} ${fourthsPulse} {key -12} ${fourthsPulse} {key 0} ${fourthsPulse}`,
    `{rate 96} {env hard} {vol 8} ${rep(4, fourthsBass)}`,
  ],
};

// Into the Trench: twelve bars at rate 135, then three slowing and fading bars.
const rebelArpEb = `Eb4s G4s Bb4s Eb5s Bb4s G4s Eb4s G4s Bb4s Eb5s Bb4s G4s Eb4s G4s Bb4s G4s`;
const rebelArpBb = `Bb3s D4s F4s Ab4s F4s D4s Bb3s D4s F4s Ab4s F4s D4s Bb3s D4s F4s D4s`;
const rebel: MusicCue = {
  voices: [
    `{rate 135} {env rise} {vol 6}
     Bb4q Eb5q G5h   F5q Eb5q F5h   G5q Bb5q Ab5q G5q   F5w
     Eb5q G5q Bb5h   Ab5q G5q F5h   Eb5q F5q G5q Ab5q   Bb5w
     Bb5q G5q Eb5h   F5q G5q Ab5h   G5q F5q Eb5q D5q   Eb5w
     {rate 90} {vol 6} Eb5h {vol 5} Bb4h   {vol 4} G4h {vol 3} Eb4h   {vol 2} Eb4w`,
    `{rate 135} {env rise} {vol 5}
     G4q Bb4q Eb5h   D5q C5q D5h   Eb5q G5q F5q Eb5q   D5w
     Bb4q Eb5q G5h   F5q Eb5q D5h   C5q D5q Eb5q F5q   G5w
     G5q Eb5q Bb4h   D5q Eb5q F5h   Eb5q D5q C5q Bb4q   Bb4w
     {rate 90} {vol 5} Bb4h {vol 4} G4h   {vol 3} Eb4h {vol 2} Bb3h   {vol 2} Bb3w`,
    `{rate 135} {env rise} {vol 3}
     ${rebelArpEb}   ${rebelArpBb}   {vol 5} Eb4q G4q Ab4q Bb4q   Bb4w
     {vol 3} ${rebelArpEb}   ${rebelArpBb}   {vol 5} Eb4q F4q G4q Ab4q   Bb4w
     {vol 3} ${rebelArpEb}   ${rebelArpBb}   {vol 5} G4q F4q Eb4q Bb3q   Eb4w
     {rate 90} {vol 3} G4h {vol 2} Eb4h   {vol 2} Bb3h Bb3h   Eb4w`,
    `{rate 135} {env rise} {vol 6}
     Eb3q Eb3q Bb2q Bb2q   Bb2q Bb2q Bb2q Bb2q   Eb3q Eb3q Ab2q Ab2q   Bb2q Bb2q Bb2q Bb2q
     Eb3q Eb3q Bb2q Bb2q   Bb2q Bb2q Bb2q Bb2q   Ab2q Ab2q Bb2q Bb2q   Eb3w
     Eb3q Eb3q Bb2q Bb2q   Bb2w   Ab2q Bb2q C3q Bb2q   Eb3w
     {rate 90} {vol 5} Eb3h {vol 4} Bb2h   {vol 3} Eb3h {vol 2} Bb2h   Eb3w`,
  ],
};

// The Trench: a quick figure repeated over a pedal, three voices in harmony at rate 152.
const rrA1 = `G5e G5e G5e3 A5e3 G5e3 E5q C5q   D5e D5e D5e3 E5e3 D5e3 B4q G4q`;
const rrB1 = `E5e G5e C6e G5e E5q G5q   A5e G5e F5e E5e D5h`;
const rrA2 = `E5e E5e E5e3 F5e3 E5e3 C5q A4q   B4e B4e B4e3 C5e3 B4e3 G4q E4q`;
const rrB2 = `C5e E5e G5e E5e C5q E5q   F5e E5e D5e C5e B4h`;
const rrA3 = `C5e C5e C5e3 C5e3 C5e3 G4q E4q   G4e G4e G4e3 G4e3 G4e3 D4q C4q`;
const rrB3 = `G4e C5e E5e C5e G4q C5q   F4e G4e A4e G4e G4h`;
const rebelRepeats: MusicCue = {
  voices: [
    `{rate 152} {env rise} {vol 8} ${rrA1} ${rrA1} ${rrB1} ${rrA1} ${rrA1} ${rrB1} C6h. Rq`,
    `{rate 152} {env rise} {vol 6} ${rrA2} ${rrA2} ${rrB2} ${rrA2} ${rrA2} ${rrB2} E5h. Rq`,
    `{rate 152} {env rise} {vol 6} ${rrA3} ${rrA3} ${rrB3} ${rrA3} ${rrA3} ${rrB3} G4h. Rq`,
    `{rate 152} {env hard} {vol 6} ${rep(26, 'C3h')}`,
  ],
};

// After the Death Star: a bright phrase, again an octave up, then a fading coda; rate 128.
const endLead = `D5e G5e B5e G5e D6q B5q   C6e B5e A5e G5e A5h   B5e A5e G5e F#5e G5q E5q   D5q G5q D6h`;
const endHarmony = `B4e D5e G5e D5e B5q G5q   A5e G5e F#5e E5e F#5h   G5e F#5e E5e D5e E5q C5q   B4q D5q B5h`;
const endChords = `G4q Rq G4q Rq   D4q Rq D4q Rq   G4q Rq C4q Rq   D4q Rq G4h`;
const endBass = `G2w~ G2h C3h   D3w~ D3h G2h`;
const end: MusicCue = {
  voices: [
    `{rate 128} {env hard} {vol 8} ${endLead} {key 12} {env rise} ${endLead} {key 0}
     {vol 10} G5q B5q D6q G6q   {vol 9} F#6h {vol 8} E6h   {vol 7} D6h {vol 6} B5h   {vol 5} G5h. {vol 4} D5q   G5w`,
    `{rate 128} {env rise} {vol 7} ${endHarmony} {key 12} ${endHarmony} {key 0}
     {vol 9} D5q G5q B5q D6q   {vol 8} D6h {vol 7} C6h   {vol 6} B5h {vol 5} G5h   {vol 4} D5h. D5q   D5w`,
    `{rate 128} {env rise} {vol 6} ${endChords} ${endChords}
     {fenv glock} G4w   D4w   G4w   D4h. D4q   G4w`,
    `{rate 128} {env hard} {vol 8} ${endBass} ${endBass}
     G2w   D3w   G2w   D3h. D3q   G2w`,
  ],
};

// Game over without a high score: a quiet air over off-beat chords, eight bars at rate 84.
const benChord = (top: string, bottom: string): [string, string] => [
  `Re ${top}e Re ${top}e Re ${top}e Re ${top}e`,
  `Re ${bottom}e Re ${bottom}e Re ${bottom}e Re ${bottom}e`,
];
const benBars = [benChord('C5', 'A4'), benChord('C5', 'A4'), benChord('B4', 'G4'), benChord('C5', 'G4'), benChord('C5', 'A4'), benChord('A4', 'F4'), benChord('B4', 'G4')];
const ben: MusicCue = {
  voices: [
    `{rate 84} {env hard} {vol 8}
     E5h C5q D5q   E5q. D5e C5q A4q   B4h G4q B4q   C5h. Rq   A4q C5q E5q A5q   G5q. E5e D5q C5q   B4q D5q C5q B4q   A4w`,
    `{rate 84} {env rise} {vol 5} ${benBars.map((b) => b[0]).join('   ')}   A4h. Rq`,
    `{rate 84} {env rise} {vol 5} ${benBars.map((b) => b[1]).join('   ')}   E4h. Rq`,
    `{rate 84} {env rise} {vol 7}
     A2q Rq E2q Rq   F2q Rq C3q Rq   G2q Rq D3q Rq   C3q Rq G2q Rq   A2q Rq E2q Rq   F2q Rq C3q Rq   G2q Rq G2q Rq   A2w`,
  ],
};

// The High Score Table and Initials Entry: a swing tune in thirds over a walking bass, 31 bars at rate 150.
const cantinaA = `C5e E5e G5e A5e G5q E5q   D5e F5e A5e Bb5e A5h   G5e E5e C5e E5e G5q Re Bb4e   C5q. Re C5h
                  A4e C5e E5e F5e E5q C5q   D5e F5e A5e Bb5e A5h   G5e F5e E5e D5e C5q A4q   C5w`;
const cantinaB = `E5q G5q A5q. G5e   F5q A5q Bb5h   A5e G5e F5e E5e D5q F5q   E5q. D5e C5h
                  {synth on} D5q~ F5q~ A5q.~ G5e   {synth off} F5q D5q Bb4h   A4e C5e D5e F5e E5q D5q   G5w`;
const cantinaA2 = `C5e E5e G5e A5e G5q E5q   D5e F5e A5e Bb5e A5h   G5e E5e C5e E5e G5q Re Bb4e   C5q. Re C5h
                   {synth on} A4e~ C5e~ E5e~ F5e~ E5q~ C5q {synth off}   G5e F5e E5e D5e C5q A4q   C5q Re C5e Rh`;
const cantinaLead = `${cantinaA} ${cantinaA} ${cantinaB} ${cantinaA2}`;
const stab = (low: string, high: string) => `Re ${low}e Re ${high}e Re ${low}e Re ${high}e`;
const cantinaStabsA = [stab('E4', 'G4'), stab('F4', 'A4'), stab('E4', 'G4'), stab('E4', 'Bb4'), stab('F4', 'A4'), `Re F4e Re A4e Re D4e Re F4e`, `Re D4e Re F4e Re B3e Re D4e`, `E4h. Rq`].join('   ');
const cantinaStabsB = [stab('C4', 'E4'), stab('F4', 'A4'), stab('F4', 'A4'), stab('E4', 'G4'), stab('F4', 'A4'), stab('D4', 'F4'), `Re F4e Re A4e Re D4e Re F4e`, stab('B3', 'D4')].join('   ');
const cantinaStabsA2 = [stab('E4', 'G4'), stab('F4', 'A4'), stab('E4', 'G4'), stab('E4', 'Bb4'), stab('F4', 'A4'), `Re D4e Re F4e Re B3e Re D4e`, `E4q Re E4e Rh`].join('   ');
const cantinaBassA = `C3q E3q G3q A3q   D3q F3q A3q F3q   C3q E3q G3q E3q   C3q Bb2q A2q G2q   F2q A2q C3q A2q   D3q F3q A3q F3q   G2q B2q D3q F3q   C3q G2q E2q G2q`;
const cantinaBassB = `A2q C3q E3q C3q   F2q A2q C3q A2q   D3q F3q A3q F3q   C3q E3q G3q E3q   D3q F3q A3q F3q   Bb2q D3q F3q D3q   F2q A2q G2q B2q   G2q B2q D3q F3q`;
const cantinaBassA2 = `C3q E3q G3q A3q   D3q F3q A3q F3q   C3q E3q G3q E3q   C3q Bb2q A2q G2q   F2q A2q C3q A2q   G2q B2q D3q F3q   C3q Rq C3e Rh`;
const cantina: MusicCue = {
  voices: [
    `{rate 150} {env steel} {vol 8} ${cantinaLead}`,
    `{rate 150} {env steel} {vol 6} ${diatonic(cantinaLead, -2)}`,
    `{rate 150} {env steel} {vol 6} ${cantinaStabsA}   ${cantinaStabsA}   ${cantinaStabsB}   ${cantinaStabsA2}`,
    `{rate 150} {env steel} {vol 7} ${cantinaBassA}   ${cantinaBassA}   ${cantinaBassB}   ${cantinaBassA2}`,
  ],
};

// The Torpedo's dive: four voices sliding down in semitones, faster and faster, then again in a rush.
function torpedoVoice(offset: number): string {
  const run = (from: number, rateStart: number, rateStep: number, notes: number) => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const out: string[] = [`{rate ${rateStart}}`];
    for (let i = 0; i < notes; i++) {
      const n = from - i;
      out.push(`${names[((n % 12) + 12) % 12]}${Math.floor(n / 12)}:2~`, `{rate +${rateStep}}`);
    }
    return out.join(' ');
  };
  return `{vol 15} {env none} {synth on} {key ${offset}} ${run(84, 60, 2, 40)} ${run(84, 200, 1, 40)} R:2`;
}
const torpedo: MusicCue = {
  voices: [torpedoVoice(0), torpedoVoice(-3), torpedoVoice(-7), torpedoVoice(-12)],
};

export const MUSIC_CUES: Record<string, MusicCue> = {
  theme,
  themeB,
  descent,
  vader,
  fourths,
  rebel,
  rebelRepeats,
  end,
  ben,
  cantina,
  torpedo,
};

/** The original cue's length in seconds, for keeping ours in step with the game's timing. */
export const ORIGINAL_CUE_SECONDS: Record<string, number> = {
  theme: 6.28,
  themeB: 8.59,
  descent: 6.24,
  vader: 7.4,
  fourths: 10.93,
  rebel: 15.91,
  rebelRepeats: 11.69,
  end: 13.79,
  ben: 12.68,
  cantina: 27.64,
  torpedo: 1.3,
};
