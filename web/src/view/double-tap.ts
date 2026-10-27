// A port shortcut shared by mouse, pen and touch. Distances are CSS pixels
// so touch tolerance does not shrink with the game's native resolution.
const TAP_MS = 350;
const BETWEEN_TAPS_MS = 400;
const MOVE_PX = 12;
const BETWEEN_TAPS_PX = 24;

type TapPointer = Pick<
  PointerEvent,
  | 'button'
  | 'clientX'
  | 'clientY'
  | 'isPrimary'
  | 'pointerId'
  | 'pointerType'
  | 'timeStamp'
>;

interface Tap {
  context: string;
  event: TapPointer;
}

const distance = (a: TapPointer, b: TapPointer): number =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

// The caller supplies a context for an eligible map press, and null for
// controls or blocked input. A changed Level or camera breaks the pair.
export const createDoubleTap = () => {
  let down: Tap | null = null;
  let previous: Tap | null = null;
  const cancel = (): void => {
    down = null;
    previous = null;
  };
  return {
    begin(event: TapPointer, context: string | null): void {
      if (down || context === null || !event.isPrimary || event.button !== 0) {
        cancel();
        return;
      }
      down = { context, event };
    },
    cancel,
    end(event: TapPointer, context: string | null): boolean {
      const started = down;
      if (!started || event.pointerId !== started.event.pointerId) {
        cancel();
        return false;
      }
      down = null;
      if (
        context !== started.context ||
        event.timeStamp - started.event.timeStamp > TAP_MS ||
        distance(event, started.event) > MOVE_PX
      ) {
        cancel();
        return false;
      }
      const paired =
        previous !== null &&
        previous.context === context &&
        previous.event.pointerType === event.pointerType &&
        event.timeStamp - previous.event.timeStamp <= BETWEEN_TAPS_MS &&
        distance(event, previous.event) <= BETWEEN_TAPS_PX;
      previous = paired ? null : { context, event };
      return paired;
    },
    move(event: TapPointer): void {
      if (
        down &&
        event.pointerId === down.event.pointerId &&
        distance(event, down.event) > MOVE_PX
      ) {
        cancel();
      }
    }
  };
};
