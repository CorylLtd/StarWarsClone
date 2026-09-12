# What is copied from the original, and what is not

Status: accepted

This is a public, non-commercial recreation of Atari's 1983 *Star Wars* arcade
game, published as source on GitHub with no hosted build. Two rights-holders
sit behind the original: Atari owns the game code and its data, and
Lucasfilm/Disney owns the names, the ship designs, the film dialogue and the
John Williams score. We drew the line so that the game *plays* and *looks* like
the cabinet while never shipping a straight copy of film audio or music.

## Copied, as data, from the original source and ROM

- Object shapes (TIE Fighters, Darth's Ship, towers, bunkers, trench, catwalks,
  exhaust port, fireballs, attract-mode objects): vertex tables and draw
  programs traced from the vector ROM, as the Battlezone clone did.
- POKEY sound-effect tables: laser, explosions, tower and trench sounds.
- Rules, timings, spawn patterns, difficulty ramps, scoring, and all on-screen
  text, verbatim, including the Lucasfilm names.

## Deliberately not copied

- **Speech.** The speech ROMs are LPC-compressed recordings of the film's
  actors. We keep the words and the trigger points and play them through our
  own TMS5220 model, but the frames are encoded from a macOS system voice.
- **Music.** The music tables encode John Williams' compositions. We keep the
  cue points and the POKEY voice model, but every cue is an original
  composition that does not follow the Williams melodic contour.
- **The ROM files and the Atari source.** Neither ever enters this repo, and no
  routine is ported line by line; logic is written fresh in TypeScript from an
  understanding of the source.

## Why here and not further either way

Going further (decoding the speech ROMs, re-synthesising the Williams cues)
would copy the two assets with the most aggressive rights-holders for a gain
that only affects audio. Going less far (hand-drawn ships, scrubbed names)
would not change the legal position of a project that announces itself as a
Star Wars clone, and would cost the fidelity that is the whole point.

## Consequences

- The README states the project is unofficial and non-commercial, with no
  affiliation to Lucasfilm, Disney or Atari, and acknowledges the trademarks.
- No LICENSE file is attached, matching the Battlezone clone; the traced data
  is not ours to license.
- The speech and music pipelines are scripts in the repo, so the voice and the
  cues can be replaced without touching the game.
