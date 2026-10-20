// The game's sound in the browser (docs/spec/audio.md): one piece at a
// time and the sound effects, played by the port of the Sonix driver in
// an AudioWorklet (ADR-0005). What to ask for is music.ts's; this module
// loads the files, keeps the sound setting and talks to the worklet.
import type { Disk, WorkletMessage } from '../audio/worklet';
import workletUrl from '../audio/worklet.ts?worker&url';
import {
  EFFECT_FILES,
  EFFECT_INSTRUMENTS,
  arrangement,
  effectNote,
  type Effect
} from './music';

export interface TableEntry {
  disk: Disk;
  file: string;
  index: number;
  kind: 'score' | 'instrument';
}

interface SoundJson {
  disks: Record<Disk, Record<string, string>>;
  table: (TableEntry | null)[];
}

export interface GameAudio {
  // Ask for a piece by its table entry; it starts when `playAsked` is
  // called, as the game loads a request only at certain moments.
  ask(entry: number): void;
  effect(effect: Effect): void;
  readonly enabled: boolean;
  // Ask for a piece and play it at once.
  play(entry: number): void;
  // Play the piece asked for, if any, in place of the one playing.
  playAsked(): void;
  // Play an entry as it is, without choosing its full arrangement: for
  // the soundboard.
  playExact(entry: number): void;
  readonly playing: boolean;
  stop(): void;
  // The game's table of pieces and effects.
  readonly table: readonly (TableEntry | null)[];
  // Q: switch sound off and on. Off stops the piece playing.
  toggle(): void;
}

const decodeBase64 = (text: string): Uint8Array =>
  Uint8Array.from(atob(text), char => char.charCodeAt(0));

export const loadGameAudio = async (
  random: (n: number) => number,
  base = '/assets/'
): Promise<GameAudio> => {
  const response = await fetch(`${base}audio/sound.json`);
  if (!response.ok) {
    throw new Error(`Failed to load audio/sound.json: ${response.status}`);
  }
  const sound = (await response.json()) as SoundJson;
  const context = new AudioContext();
  await context.audioWorklet.addModule(workletUrl);
  const node = new AudioWorkletNode(context, 'sonix', {
    numberOfInputs: 0,
    outputChannelCount: [2]
  });
  node.connect(context.destination);
  const post = (message: WorkletMessage): void =>
    node.port.postMessage(message);
  post({
    disks: Object.fromEntries(
      Object.entries(sound.disks).map(([disk, files]) => [
        disk,
        Object.fromEntries(
          Object.entries(files).map(([name, data]) => [
            name,
            decodeBase64(data)
          ])
        )
      ])
    ) as Record<Disk, Record<string, Uint8Array>>,
    type: 'files'
  });

  // Browsers start audio only after the player's first input.
  const resume = (): void => {
    void context.resume();
  };
  for (const kind of ['pointerdown', 'keydown'] as const) {
    window.addEventListener(kind, resume, { once: true });
  }

  // Sound starts on (finding:sound-q-toggles-sound).
  let enabled = true;
  let playing = false;
  let asked: number | null = null;
  node.port.onmessage = () => {
    playing = false;
  };

  const entry = (index: number): TableEntry | null =>
    sound.table[index] ?? null;

  const stop = (): void => {
    post({ type: 'stop' });
    playing = false;
  };

  const playEntry = (index: number): void => {
    const piece = entry(index);
    if (!enabled || piece?.kind !== 'score') {
      return;
    }
    post({ disk: piece.disk, file: piece.file, type: 'piece' });
    playing = true;
  };

  const playAsked = (): void => {
    if (asked === null) {
      return;
    }
    const index = arrangement(asked);
    asked = null;
    playEntry(index);
  };

  return {
    ask: index => {
      asked = index;
    },
    effect: effect => {
      const listed = entry(EFFECT_INSTRUMENTS[effect]);
      const instrument =
        EFFECT_FILES[effect] ?? (listed?.kind === 'instrument' ? listed : null);
      if (!enabled || !instrument) {
        return;
      }
      const { frames, note } = effectNote(effect, random);
      post({
        disk: instrument.disk,
        file: instrument.file,
        frames,
        note,
        type: 'effect'
      });
    },
    get enabled() {
      return enabled;
    },
    play: index => {
      asked = index;
      playAsked();
    },
    playAsked,
    playExact: playEntry,
    get playing() {
      return playing;
    },
    stop,
    table: sound.table,
    toggle: () => {
      enabled = !enabled;
      if (!enabled) {
        stop();
      }
    }
  };
};
