// The AudioWorklet that runs the port of the Sonix driver (ADR-0005).
// It holds the game's sound files and plays what the view asks for:
// one piece at a time, and effect notes on the fourth voice
// (docs/spec/audio.md). It posts 'ended' when a piece has played
// through.
import { createSonix, type SonixFiles } from './sonix';

// The parts of the AudioWorklet scope this file uses; the DOM library
// does not declare them.
declare const sampleRate: number;
declare const registerProcessor: (
  name: string,
  processor: new () => AudioWorkletProcessorLike
) => void;
declare class AudioWorkletProcessorLike {
  readonly port: MessagePort;
}
declare const AudioWorkletProcessor: typeof AudioWorkletProcessorLike;

export type Disk = 'disk1' | 'disk2';

export type WorkletMessage =
  | { disks: Record<Disk, Record<string, Uint8Array>>; type: 'files' }
  | { disk: Disk; file: string; type: 'piece' }
  | { type: 'stop' }
  | {
      disk: Disk;
      file: string;
      frames: number;
      note: number;
      type: 'effect';
    };

// The original counts 50 Hz frames.
const FRAME_SECONDS = 1 / 50;
const EFFECT_VOICE = 3;

class SonixProcessor extends AudioWorkletProcessor {
  private sonix = createSonix(sampleRate);
  private disks = new Map<Disk, Map<string, Uint8Array>>();
  private playing = false;
  // Samples left before the effect note is released.
  private effectLeft = 0;

  constructor() {
    super();
    this.port.onmessage = event => this.receive(event.data as WorkletMessage);
  }

  private files(disk: Disk): SonixFiles {
    const files = this.disks.get(disk);
    return name => files?.get(name.toLowerCase());
  }

  private receive(message: WorkletMessage): void {
    switch (message.type) {
      case 'files':
        for (const [disk, files] of Object.entries(message.disks)) {
          this.disks.set(disk as Disk, new Map(Object.entries(files)));
        }
        return;
      case 'piece': {
        const smus = this.disks.get(message.disk)?.get(message.file);
        if (smus) {
          this.sonix.playScore(smus, this.files(message.disk));
          this.playing = true;
        }
        return;
      }
      case 'stop':
        this.sonix.stopScore();
        this.playing = false;
        return;
      case 'effect': {
        const name = message.file.replace(/\.instr$/, '');
        const instrument = this.sonix.loadInstrument(
          name,
          this.files(message.disk)
        );
        if (instrument) {
          this.sonix.releaseNote(EFFECT_VOICE);
          this.sonix.startNote(EFFECT_VOICE, instrument, message.note, 255);
          this.effectLeft = Math.round(
            message.frames * FRAME_SECONDS * sampleRate
          );
        }
        return;
      }
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const [left, right] = outputs[0] ?? [];
    if (!left) {
      return true;
    }
    const other = right ?? new Float32Array(left.length);
    this.sonix.render(left, other);
    if (this.effectLeft > 0) {
      this.effectLeft -= left.length;
      if (this.effectLeft <= 0) {
        this.sonix.releaseNote(EFFECT_VOICE);
      }
    }
    if (this.playing && !this.sonix.scorePlaying) {
      this.playing = false;
      this.port.postMessage('ended');
    }
    return true;
  }
}

registerProcessor('sonix', SonixProcessor);
