---
layout: home

hero:
  name: Star Wars Clone
  text: How the game is put together
  tagline: A programmer's guide to the TypeScript and Three.js recreation of Atari's 1983 vector arcade game.
  actions:
    - theme: brand
      text: Start with the overview
      link: /guide/
    - theme: alt
      text: Architecture
      link: /guide/architecture
    - theme: alt
      text: Reference notes
      link: /reference/projection

features:
  - title: A pure simulation
    details: Everything under src/game runs without the DOM or Three.js, in the original's own frame, units and pace, from a seeded random generator. It reports what happened as events.
    link: /guide/architecture
  - title: The arcade's own clock
    details: The simulation steps once per vector-generator field and runs game logic at the cabinet's measured frame rate for each screen, from 21 Hz down to 10.
    link: /guide/timing
  - title: Three stages, one module each
    details: The Dogfight, the Surface and the Trench are separate modules with the same enter and step shape, driven by traced tables.
    link: /guide/dogfight
  - title: Vector drawing through Three.js
    details: A camera that projects exactly as the mathbox and monitor did, including the vertical squash, over batched line geometry and bloom.
    link: /guide/rendering
  - title: Sound synthesised, not sampled
    details: Four POKEY chips and a TMS5220 speech chip are modelled in AudioWorklets and driven by the sound board's own register sequences.
    link: /guide/sound-effects
  - title: Traced data, documented
    details: Shapes, choreography and layouts were traced from the original and are written up in the reference notes, with an ADR on what may and may not enter the repository.
    link: /guide/data
---
