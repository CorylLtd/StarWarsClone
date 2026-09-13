import { defineConfig } from 'vitepress';
import type MarkdownIt from 'markdown-it';

/** Links into the source tree are written relative to the docs page; they resolve to the repository on GitHub. */
const REPO = 'https://github.com/CorylLtd/StarWarsClone';
const SOURCE_LINK = /^(?:\.\.\/)+((?:src|scripts|cfg)\/.*|package\.json|vite\.config\.ts|tsconfig\.json|index\.html|CONTEXT\.md|README\.md|local\.config\.json)$/;

/** Rewrite `../../src/foo.ts` style links to the file on GitHub, so pages can cite code without dead-link errors. */
function sourceLinks(md: MarkdownIt): void {
  md.core.ruler.push('source_links', (state) => {
    for (const block of state.tokens) {
      if (!block.children) continue;
      for (const token of block.children) {
        if (token.type !== 'link_open') continue;
        const href = token.attrGet('href');
        const match = href && SOURCE_LINK.exec(href);
        if (!match) continue;
        token.attrSet('href', `${REPO}/blob/main/${match[1]}`);
        token.attrSet('target', '_blank');
        token.attrSet('rel', 'noreferrer');
      }
    }
  });
}

export default defineConfig({
  title: 'Star Wars Clone',
  description: "A programmer's guide to the browser recreation of Atari's 1983 vector arcade game",
  lang: 'en-GB',
  lastUpdated: true,
  cleanUrls: true,
  markdown: {
    config: sourceLinks,
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'Reference', link: '/reference/projection', activeMatch: '/reference/' },
      { text: 'Decisions', link: '/adr/0001-what-is-copied-from-the-original', activeMatch: '/adr/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Orientation',
          items: [
            { text: 'Overview', link: '/guide/' },
            { text: 'Architecture', link: '/guide/architecture' },
            { text: 'Conventions', link: '/guide/conventions' },
          ],
        },
        {
          text: 'The simulation',
          items: [
            { text: 'Timing: fields, frames and pace', link: '/guide/timing' },
            { text: 'Coordinates, units and projection', link: '/guide/coordinates' },
            { text: 'Game state and modes', link: '/guide/state' },
            { text: 'Configuration and tuning', link: '/guide/config' },
            { text: 'Input: the yoke', link: '/guide/input' },
          ],
        },
        {
          text: 'The stages',
          items: [
            { text: 'Dogfight', link: '/guide/dogfight' },
            { text: 'Surface', link: '/guide/surface' },
            { text: 'Trench', link: '/guide/trench' },
            { text: 'Attract, select and initials', link: '/guide/attract' },
          ],
        },
        {
          text: 'Presentation',
          items: [
            { text: 'Rendering', link: '/guide/rendering' },
            { text: 'Sound effects and the POKEY model', link: '/guide/sound-effects' },
            { text: 'Music', link: '/guide/music' },
            { text: 'Speech', link: '/guide/speech' },
          ],
        },
        {
          text: 'Data and tooling',
          items: [
            { text: 'Data tables and scripts', link: '/guide/data' },
            { text: 'Testing and debugging', link: '/guide/testing' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Rules and behaviour',
          items: [
            { text: 'Projection and camera', link: '/reference/projection' },
            { text: 'Dogfight rules', link: '/reference/dogfight-rules' },
            { text: 'Choreography', link: '/reference/choreography' },
            { text: 'Surface rules', link: '/reference/surface-rules' },
            { text: 'Trench rules', link: '/reference/trench-rules' },
            { text: 'Attract rules', link: '/reference/attract-rules' },
          ],
        },
        {
          text: 'Shapes',
          items: [
            { text: 'Dogfight shapes', link: '/reference/shapes-dogfight' },
            { text: 'Surface shapes', link: '/reference/shapes-surface' },
            { text: 'Trench shapes', link: '/reference/shapes-trench' },
            { text: 'Attract shapes', link: '/reference/shapes-attract' },
            { text: 'HUD shapes', link: '/reference/shapes-hud' },
          ],
        },
        {
          text: 'Sound',
          items: [
            { text: 'Sound effects', link: '/reference/sound-effects' },
            { text: 'Music player', link: '/reference/music-player' },
            { text: 'Speech', link: '/reference/speech' },
          ],
        },
      ],
      '/adr/': [
        {
          text: 'Architecture decision records',
          items: [{ text: '0001: What is copied from the original', link: '/adr/0001-what-is-copied-from-the-original' }],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: REPO }],
    search: { provider: 'local' },
    outline: [2, 3],
    footer: {
      message: 'An unofficial, non-commercial fan project. Star Wars and related names are trademarks of Lucasfilm Ltd.',
    },
  },
});
