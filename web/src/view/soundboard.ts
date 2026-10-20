// A page with a button for every piece of music and sound effect in the
// game, to try them out (docs/spec/audio.md). Pieces are the game's
// table entries, each played as it is; effects play as the game plays
// them (finding:sound-effect-notes). Open /soundboard.html.
import { loadGameAudio } from './audio';
import { EFFECT, type Effect } from './music';

const status = document.querySelector<HTMLElement>('#status')!;
const board = document.querySelector<HTMLElement>('#board')!;

const choose = (n: number): number => Math.floor(Math.random() * n);

const section = (title: string): HTMLElement => {
  const heading = document.createElement('h2');
  heading.textContent = title;
  const row = document.createElement('div');
  board.append(heading, row);
  return row;
};

const button = (
  row: HTMLElement,
  label: string,
  onClick: (element: HTMLButtonElement) => void
): void => {
  const element = document.createElement('button');
  element.textContent = label;
  element.addEventListener('click', () => onClick(element));
  row.append(element);
};

try {
  const audio = await loadGameAudio(choose);
  status.textContent =
    'Click a piece to play it from the start, Stop to end it. Effects play on top.';

  let current: HTMLButtonElement | null = null;
  const mark = (element: HTMLButtonElement | null): void => {
    current?.classList.remove('playing');
    current = element;
    current?.classList.add('playing');
  };
  // Clear the mark once a piece has played through.
  setInterval(() => {
    if (!audio.playing) {
      mark(null);
    }
  }, 250);

  const controls = section('Controls');
  button(controls, 'Stop', () => {
    audio.stop();
    mark(null);
  });

  for (const [title, disk] of [
    ['Music on Disk 1', 'disk1'],
    ['Music on Disk 2', 'disk2']
  ] as const) {
    const row = section(title);
    for (const entry of audio.table) {
      if (entry?.kind === 'score' && entry.disk === disk) {
        button(
          row,
          `${entry.index}: ${entry.file.replace(/\.smus$/, '')}`,
          element => {
            audio.playExact(entry.index);
            mark(element);
          }
        );
      }
    }
  }

  const effects = section('Sound effects');
  const names: Record<Effect, string> = {
    [EFFECT.bell]: 'Bell (message box)',
    [EFFECT.chime]: 'Bell (short)',
    [EFFECT.magic]: 'Magic',
    [EFFECT.sword]: 'Sword',
    [EFFECT.whoosh]: 'Whoosh'
  };
  for (const effect of Object.values(EFFECT)) {
    button(effects, names[effect], () => audio.effect(effect));
  }
} catch (error) {
  status.textContent = `No sound: ${
    error instanceof Error ? error.message : String(error)
  }. Run bun run export:web.`;
}
