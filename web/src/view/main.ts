import {
  answerMeeting,
  createSim,
  forcesOnMap,
  formatClock,
  fullMapDots,
  giveOrder,
  glassWatches,
  isHeld,
  listFightOnAnimationLevel,
  mirrorListing,
  releaseWatched,
  tickSim,
  watchEntry,
  type Force,
  type Meeting,
  type SimState
} from '../sim/index';
import {
  drawBattle,
  fightOnAnimationLevel,
  markFallen,
  spawnBattle,
  stepBattle,
  walkAfterBattle,
  type BattleStage
} from './animation-combat';
import {
  animationIconAt,
  buildScene,
  drawAnimationIcons,
  drawFigures,
  groundPictures,
  scriptWorld,
  spawnParty,
  startErrand,
  stepStage,
  takeLanded,
  walkedOff,
  type Stage
} from './animation-level';
import {
  advanceAnimationPace,
  animationPace,
  type AnimationPace
} from './animation-pace';
import {
  drawStatusBox,
  eyeStatus,
  figureAt,
  figureStatus,
  insideStatusBox,
  isSelectable,
  type StatusBox
} from './animation-status';
import {
  ARCHIVE_MESSAGES,
  archiveButtonAt,
  archiveMenu,
  archiveMessage,
  drawArchiveWindow,
  type ArchiveWindow
} from './archive-window';
import {
  blackToTransparent,
  loadAnimationAssets,
  loadCampaignAssets,
  loadFullMapAssets,
  loadTitleAssets,
  type AnimationAssets,
  type CampaignAssets,
  type TitleAssets
} from './assets';
import { loadGameAudio, type GameAudio } from './audio';
import { autosaveDue, autosavePoint, type AutosaveView } from './autosave';
import {
  BOOT_PICTURES,
  bootSequence,
  bootView,
  createBootRenderer,
  pressBootKey,
  startBoot,
  stepBoot,
  type BootSequence
} from './boot-sequence';
import {
  clampCamera,
  dragCamera,
  drawCampaignLevel,
  edgeScrollDirection,
  hoverTargetAt,
  iconPlacements,
  isOverIcons,
  stepCamera,
  viewHeightPx,
  viewWidthPx,
  type Camera,
  type IconPlacement
} from './campaign-level';
import {
  ANIMATION_ROUND_MS,
  ANNOUNCEMENT_BUTTONS,
  EVIL_WON,
  GOOD_WON,
  ORDERS_MS,
  cameraForFight,
  combatHoldsTime,
  drawCombatUi,
  openCombatWindow,
  pressCombatUi,
  rowLabel,
  startCombatUi,
  stepCombatUi,
  type CombatUi
} from './combat-window';
import {
  drawCouncilMessage,
  stepCouncilMessage,
  type CouncilMessageWindow
} from './council-message';
import {
  advanceEncounterTalk,
  drawEncounterNotice,
  drawEncounterTalk,
  startEncounterTalk,
  stepEncounterTalk,
  type EncounterTalk
} from './encounter-talk';
import {
  ENDING_VIEW,
  drawEndingFigures,
  endingFigures,
  isWon
} from './ending-scene';
import {
  drawEndingScreen,
  endingScreen,
  stepEndingScreen,
  turnEndingPage,
  type EndingScreen
} from './ending-screen';
import type { Figure } from './figure-script';
import { drawText } from './font';
import {
  drawInfoWindow,
  forceWindowLines,
  layoutInfoWindow,
  type InfoWindow
} from './force-window';
import {
  BLINK_PHASE_MS,
  campaignCameraFor,
  drawFullMapLevel,
  fullMapIconAt,
  fullMapIconPlacements,
  type FullMapLevel
} from './full-map-level';
import {
  AUTOSAVE_FAILED,
  SAVED,
  clickGameMenu,
  drawGameMenu,
  gameMenuMessage,
  hoverGameMenu,
  loadFailed,
  openGameMenu,
  pressGameMenuKey,
  saveFailed,
  type GameMenu,
  type GameMenuStep
} from './game-menu';
import { drawGandalfsLetter, type GandalfsLetter } from './gandalfs-letter';
import {
  drawMeetingUi,
  meetingHoldsTime,
  openMeetingUi,
  pressMeetingUi,
  stepMeetingUi,
  type MeetingUi
} from './meeting-window';
import { openBox, stepBox, type MessageBox } from './message-box';
import {
  drawMirrorWindow,
  layoutMirrorWindow,
  type MirrorWindow
} from './mirror-window';
import { PIECE } from './music';
import {
  IDLE_ORDER,
  drawOrderPointerTag,
  drawOrderWindow,
  isInOrderWindow,
  layoutOrderWindow,
  orderWindowOptionAt,
  pickForceAt,
  pickMember,
  toggleOrder,
  type OrderState,
  type OrderWindow
} from './order-window';
import { takePassingMessage, type PassingMessage } from './passing-message';
import {
  chooseObject,
  drawProvisionsWindow,
  holdsClock,
  openObjectList,
  openProvisions,
  provisionsButtonAt,
  type ProvisionsWindow
} from './provisions-window';
import {
  AUTOSAVE_ID,
  LEGACY_ARCHIVE_NAME,
  browserStorage,
  createSaveSlots,
  type SlotSummary
} from './save-slots';
import { NATIVE_HEIGHT, NATIVE_WIDTH, createScreen, type Fit } from './screen';
import { QUIET, figureEffects, soundCues, type SoundView } from './sound-cues';
import { placeScenery } from './special-scenery';
import {
  drawSpeedWindow,
  layoutSpeedWindow,
  speedWindowOptionAt,
  type SpeedWindow
} from './speed-window';
import { createTickDriver } from './tick-driver';
import {
  clickTitleMenu,
  drawTitleMenu,
  hoverTitleMenu,
  openTitleMenu,
  pressTitleMenuKey,
  type TitleMenu,
  type TitleSaves,
  type TitleStep
} from './title-menu';
import {
  drawWarEventMessage,
  takeWarEventMessage,
  type WarEventMessage
} from './war-event-message';
import {
  drawWindowFrame,
  windowStyle,
  windowText,
  type Box
} from './window-frame';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
if (!canvas) {
  throw new Error('No #screen canvas');
}
const screen = createScreen(canvas);

// Loading and failure notes are shown in the page, not on the canvas:
// the game's font is one of the assets being loaded.
const drawMessage = (lines: string[]): void => {
  const status = document.querySelector<HTMLPreElement>('#status');
  if (status) {
    status.textContent = lines.join('\n');
    status.hidden = lines.length === 0;
  }
};

const iconAt = (
  placements: IconPlacement[],
  pointer: Camera
): IconPlacement | undefined =>
  placements.find(
    ({ icon, x, y }) =>
      pointer.x >= x &&
      pointer.x < x + icon.image.width &&
      pointer.y >= y &&
      pointer.y < y + icon.image.height
  );

// How long an active Force's icon stays in each half of its flash
// (finding:ui-campaign-level-display). The original's rate has not
// been traced; this is provisional.
const FLASH_INTERVAL_MS = 500;
// The original picks some combat message wordings at random; the view
// may, since the wording changes nothing in the sim.
const choose = (n: number): number => Math.floor(Math.random() * n);
// Script times are in the original's vertical blanks, 50 a second.
const vblankAt = (ms: number): number => Math.floor((ms * 50) / 1000);

// Restart the party's figures from now once a talk no longer holds them.
const resumeStage = (stage: Stage, now: number): Stage => ({
  ...stage,
  figures: stage.figures.map(figure => ({ ...figure, next: vblankAt(now) }))
});
// The middle of a button, where a key's press lands.
const centre = (button: Box): Camera => ({
  x: button.x + Math.floor(button.width / 2),
  y: button.y + Math.floor(button.height / 2)
});
// A press that moves no further than this is a click, not a drag.
const CLICK_TOLERANCE_PX = 3;

// The Level on show; the game opens on the Animation Level
// (finding:ui-game-starts-on-animation-level).
type Level = 'animation' | 'campaign' | 'full-map';
// What the one message box shows (message-box.ts): the fight's
// announcement or an ignored fight's boxes, a Force's or a Place's
// window, Gandalf's letter, the meeting window or its notice, a pass-by,
// the provisions sack's windows, a status line or a War Event.
type BoxKind =
  | 'fight'
  | 'info'
  | 'letter'
  | 'meeting'
  | 'passing'
  | 'provisions'
  | 'status'
  | 'war';
// The empty roster entry 0, watched when the Animation Level shows a
// spot with nobody there.
const NOBODY = 0;

// `run` holds the whole view's state and handlers, in this order; search for
// the name to jump to a part:
// - state: `level` through `lastTime`, one `let` per open window or Level
// - the boot sequence: `boot`, its key handler; then the title menu,
//   `titleMenu`, whose choices `chooseOnTitle` carries out through
//   `startGame`
// - the Animation Level: `goDownToAnimation`, `startAnimationFight`,
//   `beginTalk`, `handleAnimationPress`
// - the Full Map Level: `goUp`, `goDown`, `handleFullMapPress`
// - the Campaign Level and Orders: `mapPoint`, `handleOrderClick`
// - the Game Speed window: `toggleSpeedWindow`, `pressSpeedWindow`
// - pointer and key handlers: `addEventListener` calls, `endDrag`
// - drawing: `drawOverlay`, then `frame`, the per-frame loop that ticks the
//   sim and opens fights, meetings and messages
const run = (
  assets: CampaignAssets,
  fullMap: FullMapLevel,
  animation: AnimationAssets,
  title: TitleAssets,
  audio: GameAudio | null
): void => {
  // The view's clock: real time less the time spent in the in-game
  // menu, so every timer and figure stands still while it is open
  // (docs/spec/game-menu.md).
  let menuMs = 0;
  let menuOpenedAt = 0;
  const viewNow = (): number => performance.now() - menuMs;
  let level: Level = 'animation';
  // The roster entry the Animation Level watches, and its scene.
  let watched = 0;
  const scene = document.createElement('canvas');
  const figureWorld = scriptWorld(animation, choose);
  let stage: Stage = { figures: [], party: 0 };
  // On the Campaign Level, whether the pointer is the magnifying glass,
  // waiting for a click on a Force to go down to (manual, pdf-p15).
  let lookingDown = false;
  // On the Full Map Level, whether the pointer is the magnifying glass,
  // waiting for a click on the map to go down to (manual, pdf-p9).
  let zooming = false;
  let hiresPointer: Camera | null = null;
  let mirror: MirrorWindow | null = null;
  let archive: ArchiveWindow | null = null;
  // The Archive window saves to and restores the slot named Archive
  // (docs/spec/saving.md), standing in for the original's single file
  // (finding:ui-single-save-slot). Game Speed and the camera are not
  // saved, and a restore stays on this Level.
  const saveSlots = createSaveSlots(browserStorage());
  const archiveSlot = (): SlotSummary | undefined => {
    const slots = saveSlots.list();
    return slots.ok
      ? slots.value.find(slot => slot.name === LEGACY_ARCHIVE_NAME)
      : undefined;
  };
  const saveGame = (): ArchiveWindow => {
    const slot = archiveSlot();
    const result = slot
      ? saveSlots.saveOver(slot.id, sim)
      : saveSlots.save(LEGACY_ARCHIVE_NAME, sim);
    return archiveMessage(
      result.ok ? ARCHIVE_MESSAGES.saved : ARCHIVE_MESSAGES.saveFailed
    );
  };
  const restoreGame = (): ArchiveWindow => {
    const slot = archiveSlot();
    const result = slot ? saveSlots.load(slot.id, assets.tilemap) : null;
    if (!result || (!result.ok && result.reason !== 'other-version')) {
      return archiveMessage(ARCHIVE_MESSAGES.noArchive);
    }
    if (!result.ok) {
      return archiveMessage(ARCHIVE_MESSAGES.otherVersion);
    }
    // The restored game stays on this Level, watching whom it watches.
    sim = watchEntry(result.value, level === 'animation' ? watched : null);
    // A message already on screen was shown; the restored game's own
    // waiting announcements follow.
    warMessage = null;
    // A restored meeting or Council gets a fresh window.
    meetingUi = null;
    councilWindow = null;
    passingMessage = null;
    talk = null;
    provisions = null;
    statusBox = null;
    infoWindow = null;
    putDownMessage = null;
    landedMessage = null;
    box = null;
    boxWaiting = false;
    return archiveMessage(ARCHIVE_MESSAGES.restored);
  };
  // The Archive window, from the scroll or A (finding:ui-archive-window).
  const openArchive = (): void => {
    mirror = null;
    speedWindow = null;
    zooming = false;
    canvas.style.cursor = 'default';
    archive = archiveMenu();
  };
  // Galadriel's Mirror, from the eye or S (docs/spec/full-map.md).
  const toggleMirror = (): void => {
    mirror = mirror
      ? null
      : layoutMirrorWindow(mirrorListing(sim.roster, sim.places));
  };
  const fullMapPlacements = fullMapIconPlacements(fullMap.icons);
  const magnifier = fullMap.icons.find(
    icon => icon.name === 'magnifying-glass'
  );
  const placements = iconPlacements(assets.icons);
  const driver = createTickDriver();
  const newSim = (): SimState =>
    createSim(0x14_18, assets.startingState, assets.tilemap);
  let sim: SimState = newSim();
  // Open on the Ring-bearer's Force at Hobbiton, the one Force the
  // player commands at the start (docs/spec/starting-state.md). The
  // game itself opens on the Animation Level; this view starts on
  // the Campaign Level.
  const openingCamera = (): Camera => {
    const opening = forcesOnMap(sim.roster).find(
      force => force.leader.index === sim.ringBearer
    );
    return opening
      ? clampCamera(
          {
            x: opening.position.x + 8 - viewWidthPx(assets.tilemap) / 2,
            y: opening.position.y + 8 - viewHeightPx(assets.tilemap) / 2
          },
          assets.tilemap
        )
      : { x: 0, y: 0 };
  };
  let camera: Camera = openingCamera();
  let fit: Fit = screen.resize();
  let pointer: Camera | null = null;
  let drag: { camera: Camera; pointer: Camera } | null = null;
  let speedWindow: SpeedWindow | null = null;
  let infoWindow: InfoWindow | null = null;
  let order: OrderState = IDLE_ORDER;
  // The fight's announcement or combat window, while a fight is on
  // (docs/spec/combat.md).
  let combat: CombatUi | null = null;
  let battle: BattleStage | null = null;
  // The War Event announcement on screen, if any
  // (docs/spec/war-events.md).
  let warMessage: WarEventMessage | null = null;
  // The meeting window, or the notice an answer leaves
  // (docs/spec/forces.md).
  let meetingUi: MeetingUi | null = null;
  // The Council of Elrond's message, while it holds the game
  // (docs/spec/council-of-elrond.md).
  let councilWindow: CouncilMessageWindow | null = null;
  let talk: EncounterTalk | null = null;
  // The provisions sack's window, the Force on screen's members and the
  // Character who last acted (docs/spec/objects.md).
  let provisions: ProvisionsWindow | null = null;
  let party: number[] = [];
  // The selected Character, one for the whole game: a figure clicked on
  // the Animation Level, the glass's pick or the sack's
  // (finding:ui-animation-level-clicking-a-figure-selects-it).
  let chosenCharacter: number | null = null;
  // Put Down's message, waiting for the object to be down, and then to
  // be raised.
  let putDownMessage: ProvisionsWindow | null = null;
  let landedMessage: ProvisionsWindow | null = null;
  // The status box a figure click or the eye opened.
  let statusBox: StatusBox | null = null;
  let passingMessage: PassingMessage | null = null;
  // The one message box open, and whether a box raised since waits for
  // its deadline, holding the game
  // (finding:ui-message-box-opening-waits-for-the-open-box).
  let box: MessageBox<BoxKind> | null = null;
  let boxWaiting = false;
  // Deliberately survives Archive restores, and is never saved.
  const givenTips = new Set<number>();
  // The game's ending, once a fight has ended it.
  let ending: EndingScreen | null = null;
  // The sound (docs/spec/audio.md): what the view showed last frame, the
  // Animation Level's Place and how many Levels have been entered.
  let placeTile: number | null = null;
  let levelEntries = 0;
  let soundLevel: Level = level;
  let lastSound: SoundView = QUIET;
  let lastFigures: Figure[] = [];
  let animationPaceState: AnimationPace = animationPace();
  // The page opens on the boot sequence (docs/spec/boot-sequence.md),
  // which holds the screen, the keys and Title until a new game starts.
  let boot: BootSequence | null = bootSequence(viewNow());
  const drawBoot = createBootRenderer(title, assets.texts);
  // Title starts with the first input, as browsers require, and plays
  // under the whole sequence
  // (finding:sound-title-music-in-the-boot-sequence).
  const startTitle = (started: boolean): void => {
    if (started) {
      audio?.play(PIECE.title);
    }
  };
  window.addEventListener('pointerdown', () => {
    if (boot) {
      const result = startBoot(boot, viewNow());
      boot = result.boot;
      startTitle(result.started);
    }
  });
  // The title menu, once the boot sequence is over
  // (docs/spec/title-menu.md); Title plays on under it.
  let titleMenu: TitleMenu | null = null;
  // Until a game starts, the boot sequence or the title menu holds the
  // screen and the keys, and nothing is saved.
  const onTitle = (): boolean => boot !== null || titleMenu !== null;
  const titleSaves = (): TitleSaves => {
    const autosave = saveSlots.autosaved();
    const slots = saveSlots.list();
    return {
      autosave: autosave.ok ? autosave.value : null,
      slots: slots.ok ? slots.value : []
    };
  };
  const titleScreen = {
    creditsStep: null,
    fade: null,
    logoY: BOOT_PICTURES.logo.y,
    picture: 'title',
    verse: false
  } as const;
  window.addEventListener('keydown', event => {
    if (titleMenu) {
      if (event.key.toLowerCase() === 'q') {
        audio?.toggle();
      }
      chooseOnTitle(pressTitleMenuKey(titleMenu, event.key, titleSaves()));
      return;
    }
    if (!boot) {
      return;
    }
    // Q switches sound off or on here too (finding:sound-q-toggles-sound).
    if (boot.startedAt !== null && event.key.toLowerCase() === 'q') {
      audio?.toggle();
    }
    const started = boot.startedAt === null;
    boot = pressBootKey(boot, viewNow());
    startTitle(started);
  });
  // Gandalf's letter, waiting for the new game's first Animation Level.
  let letter: GandalfsLetter | null = null;
  const soundView = (): SoundView => {
    if (level !== soundLevel) {
      soundLevel = level;
      levelEntries += 1;
    }
    const meeting = sim.meeting;
    return {
      boxes: [
        infoWindow && `info:${infoWindow.lines.join('|')}`,
        combat && `combat:${combat.kind}`,
        meetingUi && `meeting:${meetingUi.kind}`,
        councilWindow && 'council',
        passingMessage && `passing:${passingMessage.text}`,
        warMessage && `war:${warMessage.event}`,
        provisions && `provisions:${provisions.kind}`,
        archive && `archive:${archive.kind}`,
        mirror && 'mirror',
        speedWindow && 'speed',
        talk && `talk:${talk.page}`,
        ending && ending.page >= 0 && `ending:${ending.page}`
      ].filter((box): box is string => typeof box === 'string'),
      ending: !ending
        ? 'none'
        : !isWon(sim.ending!)
          ? 'lost'
          : ending.page === ending.pages.length - 1
            ? 'won-last-page'
            : 'won',
      fight: !combat
        ? 'none'
        : combat.kind === 'announcement'
          ? 'announced'
          : combat.kind === 'boxes'
            ? 'ignored'
            : combat.message === GOOD_WON
              ? 'good-won'
              : combat.message === EVIL_WON
                ? 'evil-won'
                : 'fought',
      following:
        meetingUi?.kind === 'window' && meeting?.kind === 'follow'
          ? meeting.b
          : null,
      level,
      levelEntries,
      placeTile: level === 'animation' ? placeTile : null
    };
  };
  const updateSound = (): void => {
    if (!audio) {
      return;
    }
    const next = soundView();
    for (const cue of soundCues(lastSound, next)) {
      switch (cue.kind) {
        case 'stop':
          audio.stop();
          break;
        case 'ask':
          audio.ask(cue.entry);
          break;
        case 'play-asked':
          audio.playAsked();
          break;
        case 'play':
          audio.play(cue.entry);
          break;
        case 'effect':
          audio.effect(cue.effect);
          break;
      }
    }
    lastSound = next;
    // The figures on the Animation Level, in a fixed order, for the
    // fight effects (finding:sound-fight-effects).
    const figures =
      level === 'animation'
        ? [...stage.figures, ...(battle?.stage.figures ?? [])]
        : [];
    for (const effect of figureEffects(lastFigures, figures, choose)) {
      audio.effect(effect);
    }
    lastFigures = figures;
  };
  let lastTime = viewNow();

  // The pointer in native pixels; hi-res pixels are half as wide.
  const toNative = (event: PointerEvent, xScale = 1): Camera => {
    const rect = canvas.getBoundingClientRect();
    const deviceX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const deviceY = (event.clientY - rect.top) * (canvas.height / rect.height);
    return {
      x: Math.floor(((deviceX - fit.x) * xScale) / fit.scale),
      y: Math.floor((deviceY - fit.y) / fit.scale)
    };
  };
  const toHires = (event: PointerEvent): Camera => toNative(event, 2);

  // The one message box (message-box.ts). What a box of each kind shows,
  // if anything; a combat window is not a message box.
  const boxContent = (kind: BoxKind): object | null => {
    switch (kind) {
      case 'fight':
        return combat?.kind === 'window' ? null : combat;
      case 'info':
        return infoWindow;
      case 'letter':
        return letter?.kind === 'open' ? letter : null;
      case 'meeting':
        return meetingUi;
      case 'passing':
        return passingMessage;
      case 'provisions':
        return provisions;
      case 'status':
        return statusBox;
      case 'war':
        return warMessage;
    }
  };
  const hasButtons = (kind: BoxKind): boolean =>
    (kind === 'fight' && combat?.kind === 'announcement') ||
    (kind === 'meeting' && meetingHoldsTime(meetingUi)) ||
    (kind === 'provisions' && holdsClock(provisions));
  // Open the box for what a kind now shows, at once.
  const showBox = (kind: BoxKind, now: number): void => {
    const ref = boxContent(kind);
    box = ref
      ? openBox(kind, ref, hasButtons(kind), now, level, driver.speed)
      : null;
  };
  // Follow the open box once it is answered, or turned into the next box
  // of its kind: a list chosen from, a meeting's notice, a fight's boxes.
  const syncBox = (now: number): void => {
    if (box && boxContent(box.kind) !== box.ref) {
      showBox(box.kind, now);
    }
  };
  // Close the open box, pressing its default if it has buttons, as a
  // timeout, a later box, a click on a Force or a Place and leaving a
  // Level do (finding:ui-message-box-opening-waits-for-the-open-box,
  // finding:ui-message-box-closed-on-leaving-a-level). Pressing "Ignore it"
  // leaves the fight's own boxes open.
  const closeBox = (now: number): void => {
    syncBox(now);
    if (!box) {
      return;
    }
    const kind = box.kind;
    box = null;
    switch (kind) {
      case 'fight':
        if (combat?.kind === 'announcement') {
          ({ sim, ui: combat } = stepCombatUi(
            combat,
            sim,
            combat.deadline,
            choose,
            0,
            driver.speed
          ));
          showBox('fight', now);
        } else {
          combat = null;
        }
        return;
      case 'meeting':
        // "Continue on"; a notice it leaves is dropped with the box.
        if (meetingUi?.kind === 'window') {
          sim = stepMeetingUi(meetingUi, sim, meetingUi.deadline).sim;
        }
        meetingUi = null;
        return;
      case 'info':
        infoWindow = null;
        return;
      case 'letter':
        letter = null;
        return;
      case 'passing':
        passingMessage = null;
        return;
      case 'provisions':
        provisions = null;
        return;
      case 'status':
        statusBox = null;
        return;
      case 'war':
        warMessage = null;
        return;
    }
  };
  // The next box the game has raised and not yet shown. Within a tick,
  // pass-bys are raised during the roster sweep, before the meeting or
  // fight that stops it, and War Events at its end (sim/state.ts). The
  // Campaign Level opens meetings and fights; the Animation Level shows
  // Gandalf's letter and Put Down's message.
  const raisedBox = (): BoxKind | null => {
    if (
      level === 'full-map' ||
      talk ||
      ending ||
      sim.ending ||
      councilWindow ||
      sim.council ||
      combatHoldsTime(combat)
    ) {
      return null;
    }
    if (level === 'animation' && letter?.kind === 'pending') {
      return 'letter';
    }
    if (level === 'animation' && landedMessage) {
      return 'provisions';
    }
    if (sim.passings.length > 0) {
      return 'passing';
    }
    if (level === 'campaign' && sim.meeting && !meetingUi) {
      return 'meeting';
    }
    if (level === 'campaign' && sim.fight && !combat) {
      return 'fight';
    }
    return sim.announcements.length > 0 ? 'war' : null;
  };
  const raiseBox = (kind: BoxKind, now: number): void => {
    switch (kind) {
      case 'letter':
        letter = { kind: 'open' };
        break;
      case 'provisions':
        provisions = landedMessage;
        landedMessage = null;
        break;
      case 'passing':
        ({ message: passingMessage, sim } = takePassingMessage(sim));
        break;
      case 'war':
        ({ message: warMessage, sim } = takeWarEventMessage(sim));
        break;
      case 'meeting':
      case 'fight':
        // A decision window drops any half-given Order or open window
        // (finding:ui-pointer-and-icon-column).
        if (kind === 'meeting') {
          meetingUi = openMeetingUi(assets.window.font.metrics, sim, now);
        } else {
          combat = startCombatUi(sim, now);
        }
        speedWindow = null;
        drag = null;
        setOrder(IDLE_ORDER);
        break;
      default:
        break;
    }
    showBox(kind, now);
  };
  // Time the open box out and open the boxes raised, one at a time, in
  // order. A box raised before the open box's deadline waits, and
  // `boxWaiting` holds the game until it opens.
  const stepBoxes = (now: number): void => {
    syncBox(now);
    for (;;) {
      const raised = raisedBox();
      const step = stepBox(box, now, level, raised !== null);
      boxWaiting = step.waiting;
      if (step.close) {
        closeBox(now);
      }
      if (!step.open || box || !raised) {
        return;
      }
      raiseBox(raised, now);
      if (!box) {
        return;
      }
    }
  };

  // Down to the Animation Level, watching a roster entry: its scene is
  // built once, from where it stands (docs/spec/animation-level.md).
  // Returns whether it went down: an entry with no position cannot be
  // watched.
  // `again` rebuilds the scene for the same watch as it moves on, which
  // is not a new entry to the Level.
  const goDownToAnimation = (index: number, again = false): boolean => {
    const entry = sim.roster[index];
    if (!entry?.position) {
      return false;
    }
    const force = forcesOnMap(sim.roster).find(
      candidate => candidate.leader.index === index
    );
    goDownTo(
      index,
      entry.position,
      entry.facing,
      force?.members ?? [entry],
      again
    );
    return true;
  };
  // Down to the Animation Level at a spot with nobody watched, as the
  // glass does with no Good Leader in reach: the empty roster entry 0
  // stands at the spot, rounded down to 16 pixels, and no figures walk
  // (finding:ui-magnifying-glass-watches-the-first-good-leader-near-the-spot).
  const goDownToSpot = (point: Camera): void => {
    goDownTo(NOBODY, { x: point.x & ~15, y: point.y & ~15 }, 0, []);
  };
  const goDownTo = (
    index: number,
    position: Camera,
    facing: number,
    members: SimState['roster'],
    again = false
  ): void => {
    if (!again) {
      // Leaving a Level closes its box
      // (finding:ui-message-box-closed-on-leaving-a-level).
      closeBox(viewNow());
      animationPaceState = animationPace();
    }
    watched = index;
    sim = watchEntry(sim, index);
    // The Place's tile byte, when it has scenery of its own, picks its
    // music (finding:sound-place-music).
    placeTile = null;
    buildScene(
      scene,
      animation,
      assets.tilemap,
      { facing, position },
      sim.clock.quarterHour,
      choose,
      (tile, random, strips) => {
        placeTile = tile;
        return placeScenery(tile, random, strips);
      }
    );
    if (!again) {
      levelEntries += 1;
    }
    party = members.map(member => member.index);
    if (box?.kind === 'provisions') {
      closeBox(viewNow());
    }
    provisions = null;
    stage = spawnParty(
      members.map(member => ({
        figure: member.figure,
        index: member.index,
        strength: member.strength
      })),
      figureWorld,
      choose
    );
    // Their scripts' times count from now.
    const start = vblankAt(viewNow());
    stage = {
      ...stage,
      figures: stage.figures.map(figure => ({ ...figure, next: start })),
      pictures: groundPictures(sim.objectPlacements, position, choose)
    };
    putDownMessage = null;
    landedMessage = null;
    level = 'animation';
    lookingDown = false;
    infoWindow = null;
    speedWindow = null;
    drag = null;
    setOrder(IDLE_ORDER);
    canvas.style.cursor = 'default';
  };

  // The ending's still picture: the Animation Level's scene on Mount
  // Doom or Hobbiton, built for the empty roster entry 0, with its
  // figures copied on once (finding:ui-ending-scenes-are-still-pictures).
  const startEnding = (now: number): void => {
    const end = sim.ending!;
    buildScene(
      scene,
      animation,
      assets.tilemap,
      {
        facing: sim.roster[0]?.facing ?? 0,
        position: ENDING_VIEW[isWon(end) ? 'won' : 'lost']
      },
      sim.clock.quarterHour,
      choose,
      placeScenery
    );
    const ctx = scene.getContext('2d');
    if (ctx) {
      drawEndingFigures(ctx, animation.figures, endingFigures(end, choose));
    }
    ending = endingScreen(end, assets.texts, now);
  };

  const startAnimationFight = (now: number, attacked = false): void => {
    const fight = sim.fight!;
    if (level !== 'animation') {
      goDownToAnimation(fight.good);
    }
    // The scene lists the fight again around the watched Character
    // (finding:combat-animation-level-lists-the-fight-again).
    sim = listFightOnAnimationLevel(sim, watched);
    battle = spawnBattle(sim, figureWorld, choose, vblankAt(now));
    // The combat window closes the open box itself
    // (finding:ui-message-box-opening-waits-for-the-open-box).
    closeBox(now);
    combat = openCombatWindow(sim, now);
    if (attacked && combat.kind === 'window') {
      combat = {
        ...combat,
        message: `${sim.roster[watched]!.name} is attacked by ${rowLabel(
          sim.roster[fight.evil]!.name,
          sim.roster[fight.evil]!.strength
        )}.`
      };
    }
  };

  // Up from the Animation Level to the Campaign Level, centred on the
  // watched Character.
  const goUpFromAnimation = (): void => {
    // Leaving the Level closes its box, pressing its default
    // (finding:ui-message-box-closed-on-leaving-a-level).
    closeBox(viewNow());
    talk = null;
    provisions = null;
    const position = sim.roster[watched]?.position;
    if (position) {
      camera = clampCamera(
        {
          x: position.x + 8 - viewWidthPx(assets.tilemap) / 2,
          y: position.y + 8 - viewHeightPx(assets.tilemap) / 2
        },
        assets.tilemap
      );
    }
    level = 'campaign';
    sim = watchEntry(sim, null);
    setOrder(IDLE_ORDER);
  };

  const beginTalk = (meeting: Meeting, now: number): void => {
    talk = startEncounterTalk(
      sim.roster[meeting.a]!,
      sim.roster[meeting.b]!,
      stage,
      figureWorld,
      assets.texts,
      givenTips,
      choose,
      now
    );
    stage = talk.party;
  };

  const advanceTalk = (now: number): void => {
    if (talk) {
      talk = advanceEncounterTalk(talk, now);
      if (!talk) {
        stage = resumeStage(stage, now);
      }
    }
  };

  const handleAnimationPress = (event: PointerEvent): void => {
    const point = toNative(event);
    const icon = animationIconAt(animation.icons, point);
    const now = viewNow();
    if (holdsClock(provisions)) {
      // While a box with buttons is up only its buttons answer: a press
      // off them, the icons included, does nothing
      // (finding:ui-message-box-presses-off-the-buttons).
      pressProvisions(point, now);
    } else if (icon?.name === 'map') {
      goUpFromAnimation();
    } else if (icon?.name === 'eye') {
      openEye(now);
    } else if (icon?.name === 'sack' && !battle && !talk && !sim.fight) {
      // The sack is ignored during a fight (finding:ui-provisions-window).
      closeBox(now);
      provisions = openProvisions(
        assets.window.font.metrics,
        sim,
        party,
        chosenCharacter,
        now
      );
      if (provisions.kind === 'menu') {
        chosenCharacter = provisions.chosen;
      }
      showBox('provisions', now);
    } else if (talk) {
      advanceTalk(viewNow());
    } else if (
      !icon &&
      !battle &&
      !sim.fight &&
      !(statusBox && insideStatusBox(statusBox, point))
    ) {
      // A figure clicked shows its status line and, on the Good side,
      // becomes the selected Character; nothing during a fight
      // (finding:ui-animation-level-clicking-a-figure-selects-it).
      const owner = figureAt(stage, figureWorld.frames, point);
      if (owner !== null) {
        closeBox(now);
        statusBox = figureStatus(sim.roster, sim.places, owner);
        showBox('status', now);
        if (isSelectable(owner)) {
          chosenCharacter = owner;
        }
      }
    }
  };
  // A press on the provisions sack's buttons.
  const pressProvisions = (point: Camera, now: number): void => {
    if (!provisions || provisions.kind === 'message') {
      return;
    }
    const pressed = provisionsButtonAt(provisions, point);
    const position = sim.roster[watched]?.position;
    if (!pressed || !position) {
      return;
    }
    if (typeof pressed.value === 'number') {
      if (provisions.kind !== 'menu') {
        const { chosen, kind } = provisions;
        ({ sim, window: provisions } = chooseObject(
          assets.window.font.metrics,
          sim,
          chosen,
          kind,
          pressed.value,
          position,
          assets.texts,
          givenTips,
          choose,
          now
        ));
        // Take and Put Down send the member's figure: Take's message
        // shows as it sets off, Put Down's once the object is down.
        if (kind !== 'use') {
          const sent = startErrand(stage, kind, chosen, pressed.value);
          if (sent) {
            stage = sent;
            if (kind === 'put-down' && provisions) {
              putDownMessage = provisions;
              provisions = null;
            }
          }
        }
      }
    } else {
      provisions = openObjectList(
        assets.window.font.metrics,
        sim,
        provisions.chosen,
        pressed.value,
        position,
        now
      );
    }
    syncBox(now);
  };
  // The eye, or S: the selected Character's status
  // (finding:ui-animation-level-eye-shows-the-selected-status).
  const openEye = (now: number): void => {
    closeBox(now);
    statusBox = eyeStatus(sim.roster, sim.places, chosenCharacter);
    showBox('status', now);
  };

  // Up to the Full Map Level (manual, pdf-p3). Any half-given Order or
  // open window is dropped, as when a decision window opens
  // (finding:ui-pointer-and-icon-column).
  // The Full Map Level cannot be entered while a box with buttons is
  // up, and entering it closes the Campaign Level's box
  // (finding:ui-message-box-closed-on-leaving-a-level).
  const goUp = (): void => {
    if (box?.buttons) {
      return;
    }
    closeBox(viewNow());
    level = 'full-map';
    zooming = false;
    mirror = null;
    archive = null;
    speedWindow = null;
    infoWindow = null;
    drag = null;
    pointer = null;
    setOrder(IDLE_ORDER);
    canvas.style.cursor = 'default';
  };

  const startZoom = (): void => {
    zooming = true;
    canvas.style.cursor = magnifier ? 'none' : 'zoom-in';
  };

  // Down to the Campaign Level, centred on the clicked spot.
  const goDown = (point: Camera): void => {
    camera = campaignCameraFor(point, assets.tilemap);
    level = 'campaign';
    zooming = false;
    hiresPointer = null;
    setOrder(IDLE_ORDER);
  };

  const handleFullMapPress = (event: PointerEvent): void => {
    const point = toHires(event);
    // A press on a button acts on it; anywhere else clears the window.
    if (archive) {
      const button = archiveButtonAt(archive, point);
      archive = button
        ? button.choice === 'save'
          ? saveGame()
          : restoreGame()
        : null;
      return;
    }
    // A press anywhere clears the Mirror.
    if (mirror) {
      mirror = null;
      return;
    }
    // The Game Speed window is laid out in lo-res pixels, as on the
    // Campaign Level, so a hi-res point is halved across.
    if (speedWindow) {
      pressSpeedWindow({ x: Math.floor(point.x / 2), y: point.y });
      return;
    }
    const icon = fullMapIconAt(fullMapPlacements, point);
    if (icon?.icon.name === 'scroll') {
      openArchive();
    } else if (icon?.icon.name === 'eye') {
      zooming = false;
      canvas.style.cursor = 'default';
      toggleMirror();
    } else if (icon?.icon.name === 'hourglass') {
      zooming = false;
      canvas.style.cursor = 'default';
      toggleSpeedWindow();
    } else if (icon?.icon.name === 'magnifying-glass') {
      if (zooming) {
        zooming = false;
        canvas.style.cursor = 'default';
      } else {
        startZoom();
      }
    } else if (zooming && !icon) {
      goDown(point);
    }
  };

  // The map point under the pointer, or null outside the map view.
  const mapPoint = (native: Camera | null): Camera | null =>
    native &&
    native.x >= 0 &&
    native.x < viewWidthPx(assets.tilemap) &&
    native.y >= 0 &&
    native.y < viewHeightPx(assets.tilemap)
      ? { x: native.x + camera.x, y: native.y + camera.y }
      : null;

  const targetAt = (native: Camera | null, forces: Force[]) => {
    const point = mapPoint(native);
    return point
      ? hoverTargetAt(forces, sim.places, sim.placeKinds, assets.tilemap, point)
      : null;
  };

  // The Order window for the Force being ordered, rebuilt from the
  // live roster each time so it tracks the Force while it moves.
  const orderWindowFor = (): OrderWindow | null => {
    const current = order;
    if (current.kind !== 'pick-destination') {
      return null;
    }
    const force = forcesOnMap(sim.roster).find(
      candidate => candidate.leader.index === current.leaderIndex
    );
    return force
      ? layoutOrderWindow(assets.window.font.metrics, force, sim.places)
      : null;
  };

  const setOrder = (next: OrderState): void => {
    order = next;
    canvas.style.cursor = order.kind === 'idle' ? 'grab' : 'crosshair';
  };

  // A press while an Order is being given (finding:ui-giving-an-order):
  // pick the Force, pick a member in its window, or set the destination.
  const handleOrderClick = (native: Camera): void => {
    const window = orderWindowFor();
    if (window && isInOrderWindow(window, native.x, native.y)) {
      const option = orderWindowOptionAt(window, native.x, native.y);
      if (option) {
        setOrder(pickMember(order, option.memberIndex));
      }
      return;
    }
    const point = mapPoint(native);
    if (!point) {
      return;
    }
    if (order.kind === 'pick-force') {
      setOrder(pickForceAt(order, forcesOnMap(sim.roster), point));
    } else if (order.kind === 'pick-destination') {
      sim = giveOrder(sim, order.selected, point);
      setOrder(IDLE_ORDER);
    }
  };

  // The one Game Speed window, opened under the hourglass of either
  // Level; the setting is shared (manual, pdf-p13).
  const toggleSpeedWindow = (): void => {
    if (speedWindow) {
      speedWindow = null;
      return;
    }
    const hourglass =
      level === 'full-map'
        ? fullMapPlacements.find(p => p.icon.name === 'hourglass')
        : placements.find(p => p.icon.name === 'hourglass');
    speedWindow = layoutSpeedWindow(
      318,
      hourglass ? hourglass.y + hourglass.icon.image.height + 2 : 2,
      driver.paused
    );
  };

  // A press while the Game Speed window is open picks an option, if
  // any, and closes the window.
  const pressSpeedWindow = (point: Camera): void => {
    if (!speedWindow) {
      return;
    }
    const option = speedWindowOptionAt(speedWindow, point.x, point.y);
    if (option?.value === 'pause') {
      driver.paused = !driver.paused;
    } else if (option) {
      driver.speed = option.value;
      driver.paused = false;
    }
    speedWindow = null;
  };

  const startDrag = (event: PointerEvent, at: Camera): void => {
    drag = { camera, pointer: at };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  // A press on the fight's announcement or combat window; returns
  // whether it answered the announcement.
  const pressFight = (point: Camera): boolean => {
    if (!combat) {
      return false;
    }
    const now = viewNow();
    const before = combat;
    const result = pressCombatUi(combat, sim, point, now, driver.speed);
    sim = result.sim;
    combat = result.ui;
    if (
      before.kind === 'announcement' &&
      combat?.kind === 'window' &&
      sim.fight
    ) {
      if (fightOnAnimationLevel(sim)) {
        startAnimationFight(now);
      } else {
        camera = clampCamera(
          cameraForFight(sim.fight.position, camera, {
            height: viewHeightPx(assets.tilemap),
            width: viewWidthPx(assets.tilemap)
          }),
          assets.tilemap
        );
      }
    }
    syncBox(now);
    return before.kind === 'announcement' && combat !== before;
  };
  // A press on the meeting window; returns whether it answered it.
  const pressMeeting = (point: Camera): boolean => {
    if (!meetingUi) {
      return false;
    }
    const now = viewNow();
    const result = pressMeetingUi(meetingUi, sim, point);
    const meeting = sim.meeting;
    sim = result.sim;
    meetingUi = result.ui;
    syncBox(now);
    if (result.choice === 'go-there' && meeting) {
      goDownToAnimation(meeting.a);
      if (meeting.kind === 'talk') {
        beginTalk(meeting, now);
      }
    }
    return result.choice !== null;
  };
  // The keys that answer a box with buttons: N presses its default and Y
  // the other button (finding:ui-message-box-presses-off-the-buttons).
  const answerBoxKey = (key: string): boolean => {
    if (!box?.buttons || (key !== 'n' && key !== 'y')) {
      return false;
    }
    if (combat?.kind === 'announcement') {
      const choice = key === 'n' ? 'ignore-it' : 'go-there';
      pressFight(
        centre(ANNOUNCEMENT_BUTTONS.find(button => button.choice === choice)!)
      );
    } else if (meetingUi?.kind === 'window') {
      const button =
        key === 'n'
          ? meetingUi.buttons.find(b => b.choice === 'continue-on')
          : meetingUi.buttons.find(b => b.choice !== 'continue-on');
      if (button) {
        pressMeeting(centre(button));
      }
    } else if (key === 'n') {
      // The provisions sack's windows: the default closes them.
      closeBox(viewNow());
    }
    return true;
  };
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', event => {
    if (gameMenu) {
      chooseInGame(clickGameMenu(gameMenu, toNative(event), titleSaves()));
      return;
    }
    if (titleMenu) {
      chooseOnTitle(clickTitleMenu(titleMenu, toNative(event), titleSaves()));
      return;
    }
    if (boot) {
      return;
    }
    if (ending) {
      ending = turnEndingPage(ending, viewNow());
      return;
    }
    // The Council's message cannot be dismissed, and nothing else
    // answers while it is up.
    if (councilWindow) {
      return;
    }
    // Fight options take presses on either Level. A press off the
    // announcement's buttons does nothing, unless it is a click on a
    // Force or a Place (finding:ui-message-box-presses-off-the-buttons).
    if (level !== 'full-map' && combatHoldsTime(combat)) {
      if (battle?.phase === 'approach') {
        return;
      }
      const point = toNative(event);
      if (
        !pressFight(point) &&
        combat?.kind === 'announcement' &&
        level === 'campaign' &&
        !iconAt(placements, point)
      ) {
        startDrag(event, point);
      }
      return;
    }
    if (level === 'full-map') {
      handleFullMapPress(event);
      return;
    }
    if (level === 'animation') {
      handleAnimationPress(event);
      return;
    }
    pointer = toNative(event);
    // While the meeting window is up its buttons answer it, the icons do
    // nothing and a click on a Force or a Place replaces it
    // (finding:ui-message-box-presses-off-the-buttons).
    if (meetingHoldsTime(meetingUi)) {
      if (!pressMeeting(pointer) && !iconAt(placements, pointer)) {
        startDrag(event, pointer);
      }
      return;
    }
    if (speedWindow) {
      pressSpeedWindow(pointer);
      return;
    }
    const icon = iconAt(placements, pointer);
    if (icon?.icon.name === 'map') {
      goUp();
      return;
    }
    if (icon?.icon.name === 'magnifying-glass') {
      lookingDown = !lookingDown;
      canvas.style.cursor = lookingDown ? 'zoom-in' : 'grab';
      return;
    }
    // The magnifying glass watches the first Good Leader near the spot,
    // or else shows the spot with nobody watched
    // (finding:ui-magnifying-glass-watches-the-first-good-leader-near-the-spot).
    if (lookingDown && !icon) {
      const spot = mapPoint(pointer);
      if (spot) {
        const index = glassWatches(sim.roster, spot);
        chosenCharacter = index;
        if (index === null || !goDownToAnimation(index)) {
          goDownToSpot(spot);
        }
      }
      return;
    }
    // The arrow starts or cancels an Order (#10).
    if (icon?.icon.name === 'arrow') {
      infoWindow = null;
      setOrder(toggleOrder(order));
      return;
    }
    // While an Order is being given, presses pick the Force, a
    // member or the destination instead of panning the map; edge
    // scrolling still reaches a distant destination.
    if (order.kind !== 'idle' && !icon) {
      handleOrderClick(pointer);
      return;
    }
    if (icon?.icon.name === 'hourglass') {
      toggleSpeedWindow();
      return;
    }
    // Drags starting on an icon are for the icon, not the map.
    if (!icon) {
      startDrag(event, pointer);
    }
  });
  canvas.addEventListener('pointermove', event => {
    if (gameMenu) {
      gameMenu = hoverGameMenu(gameMenu, toNative(event));
      return;
    }
    if (titleMenu) {
      titleMenu = hoverTitleMenu(titleMenu, toNative(event));
      return;
    }
    if (boot || level === 'animation') {
      return;
    }
    if (level === 'full-map') {
      hiresPointer = toHires(event);
      return;
    }
    pointer = toNative(event);
    if (drag) {
      camera = dragCamera(drag.camera, drag.pointer, pointer, assets.tilemap);
    }
  });
  const endDrag = (event: PointerEvent): void => {
    if (drag && !onTitle()) {
      const released = toNative(event);
      const moved = Math.max(
        Math.abs(released.x - drag.pointer.x),
        Math.abs(released.y - drag.pointer.y)
      );
      // A press that did not pan is a click: it opens the window at
      // the top left naming what was clicked (manual, pdf-p16).
      // It closes the open box, pressing its default, and replaces it;
      // a click on an empty spot does nothing
      // (finding:ui-message-box-presses-off-the-buttons).
      if (moved <= CLICK_TOLERANCE_PX) {
        camera = drag.camera;
        const target = targetAt(released, forcesOnMap(sim.roster));
        const now = viewNow();
        if (target) {
          closeBox(now);
        }
        // "Ignore it" leaves the fight's own boxes up instead.
        if (target && !box) {
          infoWindow = layoutInfoWindow(
            assets.window.font.metrics,
            target.kind === 'force'
              ? forceWindowLines(target.force)
              : [target.name]
          );
          showBox('info', now);
        }
      }
    }
    drag = null;
    canvas.style.cursor = order.kind === 'idle' ? 'grab' : 'crosshair';
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => {
    hiresPointer = null;
    if (!drag) {
      pointer = null;
    }
  });
  window.addEventListener('resize', () => {
    fit = screen.resize();
  });
  window.addEventListener('keydown', event => {
    // The original's keys: U goes up a Level, M picks up the
    // magnifying glass, T opens the Game Speed window and P pauses
    // (finding:ui-key-bindings). The Campaign Level's magnifying
    // glass waits for the Animation Level.
    if (gameMenu) {
      if (event.key.toLowerCase() === 'q' && gameMenu.kind !== 'name') {
        audio?.toggle();
      }
      chooseInGame(pressGameMenuKey(gameMenu, event.key, titleSaves()));
      return;
    }
    // Escape opens the in-game menu when there is nothing else for it
    // to close.
    if (event.key === 'Escape' && !otherWindowOpen() && openInGameMenu()) {
      return;
    }
    if (onTitle() || councilWindow) {
      return;
    }
    const key = event.key.toLowerCase();
    if (answerBoxKey(key)) {
      return;
    }
    if (combatHoldsTime(combat)) {
      return;
    }
    if (level === 'animation') {
      // U, like the icons, does nothing under a box with buttons
      // (finding:ui-message-box-closed-on-leaving-a-level).
      if (key === 'u' && !box?.buttons) {
        goUpFromAnimation();
      } else if (key === 's') {
        openEye(viewNow());
      } else if (key === 'p') {
        driver.paused = !driver.paused;
      } else if (key === ' ' || key === 'enter') {
        advanceTalk(viewNow());
      }
      return;
    }
    if (level === 'full-map') {
      if (archive) {
        archive = null;
        return;
      }
      if (key === 'a') {
        openArchive();
        return;
      }
      if (key === 's') {
        speedWindow = null;
        zooming = false;
        canvas.style.cursor = 'default';
        toggleMirror();
        return;
      }
      if (mirror) {
        mirror = null;
        if (key !== 'escape') {
          return;
        }
      }
      if (key === 'm') {
        speedWindow = null;
        startZoom();
      } else if (key === 't') {
        zooming = false;
        canvas.style.cursor = 'default';
        toggleSpeedWindow();
      } else if (key === 'escape') {
        zooming = false;
        speedWindow = null;
        canvas.style.cursor = 'default';
      }
      return;
    }
    if (ending) {
      ending = turnEndingPage(ending, viewNow());
      return;
    }
    // Nothing else is open to the player while a fight or meeting holds
    // the game.
    if (combatHoldsTime(combat) || meetingHoldsTime(meetingUi) || sim.meeting) {
      return;
    }
    if (key === 'u') {
      goUp();
    } else if (key === 'm') {
      lookingDown = !lookingDown;
      canvas.style.cursor = lookingDown ? 'zoom-in' : 'grab';
    } else if (event.key === 't' || event.key === 'T') {
      toggleSpeedWindow();
    } else if (event.key === 'q' || event.key === 'Q') {
      // Q switches sound off and on (finding:sound-q-toggles-sound).
      audio?.toggle();
    } else if (event.key === 'p' || event.key === 'P') {
      driver.paused = !driver.paused;
    } else if (event.key === 'Escape') {
      speedWindow = null;
      infoWindow = null;
      setOrder(IDLE_ORDER);
    }
  });

  // The top of the date line's strip (finding:ui-date-line).
  const DATE_LINE_Y = 192;
  const drawOverlay = (forces: Force[]): void => {
    const ctx = screen.buffer;
    // The date line: colour 3 on a parchment strip, colour 15, across
    // the 8 rows below the 192px map view (finding:ui-date-line). The
    // strip cuts off the bottom of the lettering, as in the original.
    const { fill, line } = assets.window.colours;
    ctx.fillStyle = fill;
    ctx.fillRect(0, DATE_LINE_Y, NATIVE_WIDTH, NATIVE_HEIGHT - DATE_LINE_Y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, DATE_LINE_Y, NATIVE_WIDTH, NATIVE_HEIGHT - DATE_LINE_Y);
    ctx.clip();
    drawText(
      ctx,
      assets.window.font,
      formatClock(sim.clock),
      10,
      DATE_LINE_Y,
      line
    );
    ctx.restore();
    if (driver.paused && order.kind === 'idle') {
      const box = drawWindowFrame(ctx, assets.window, {
        height: 24,
        width: 128,
        x: 8,
        y: 8
      });
      windowText(
        ctx,
        assets.window,
        'The Game is Paused.',
        box.x + 10,
        box.y + 8
      );
    }
    if (order.kind === 'pick-force') {
      drawInfoWindow(
        ctx,
        assets.window,
        layoutInfoWindow(assets.window.font.metrics, ['Select a Force'])
      );
    }
    if (order.kind === 'pick-destination') {
      const window = orderWindowFor();
      if (window) {
        drawOrderWindow(ctx, assets.window, window, order.selected);
      } else {
        setOrder(IDLE_ORDER);
      }
      if (pointer) {
        drawOrderPointerTag(ctx, assets.window, pointer);
      }
    }
    // Hovering names the Place, Character or Unit under the pointer
    // in the same top-left window a click would open.
    if (
      !combat &&
      !infoWindow &&
      !speedWindow &&
      !drag &&
      order.kind === 'idle'
    ) {
      const overIcons = pointer !== null && isOverIcons(pointer, placements);
      const target = overIcons ? null : targetAt(pointer, forces);
      if (target) {
        drawInfoWindow(
          ctx,
          assets.window,
          layoutInfoWindow(assets.window.font.metrics, [target.name])
        );
      }
    }
    if (infoWindow) {
      drawInfoWindow(ctx, assets.window, infoWindow);
    }
    if (speedWindow) {
      drawSpeedWindow(
        ctx,
        assets.window,
        speedWindow,
        driver.speed,
        driver.paused
      );
    }
    if (combat) {
      drawCombatUi(ctx, assets.window, combat, sim);
    } else if (meetingUi) {
      drawMeetingUi(ctx, assets.window, meetingUi);
    } else if (councilWindow) {
      drawCouncilMessage(ctx, assets.window, councilWindow);
    } else if (passingMessage) {
      drawEncounterNotice(ctx, assets.window, passingMessage.text);
    } else if (warMessage) {
      drawWarEventMessage(ctx, assets.window, warMessage);
    }
  };

  // The autosave slot, written on each game hour, on each change of
  // Level and when the page is hidden, but never in a fight, a talk or
  // the ending, which a restore would lose (docs/spec/saving.md). A
  // failed autosave is dropped: play goes on.
  const autosaveView = (): AutosaveView => ({
    clock: sim.clock,
    level,
    settled: !sim.fight && !combat && !battle && !talk && !ending
  });
  let autosavedAt = autosavePoint(autosaveView());
  const autosaveNow = (view: AutosaveView): void => {
    saveSlots.autosave(sim);
    autosavedAt = autosavePoint(view);
  };
  const autosaveOnHide = (): void => {
    const view = autosaveView();
    // Until a game starts there is nothing to save, and any save is
    // left as it was.
    if (!onTitle() && view.settled) {
      autosaveNow(view);
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      autosaveOnHide();
    }
  });
  window.addEventListener('pagehide', autosaveOnHide);
  // A new game opens on the Animation Level with the Ring-bearer
  // (finding:ui-game-starts-on-animation-level) and Gandalf's letter. A
  // loaded one returns to the Level it was saved on: the Animation Level
  // watching whom it watched, or else the Campaign Level over the
  // Ring-bearer's Force (docs/spec/game-menu.md). Title stops. Nothing
  // is saved until autosave next runs.
  const startGame = (isNew: boolean): void => {
    titleMenu = null;
    audio?.stop();
    level = 'campaign';
    camera = openingCamera();
    const watch = isNew ? sim.ringBearer : sim.watching;
    sim = watchEntry(sim, null);
    if (watch !== null) {
      const down = goDownToAnimation(watch);
      letter = isNew && down ? { kind: 'pending' } : null;
    }
    autosavedAt = autosavePoint(autosaveView());
  };
  // Carry out what the title menu chose.
  const chooseOnTitle = (step: TitleStep): void => {
    titleMenu = step.menu;
    const choice = step.choice;
    if (!choice) {
      return;
    }
    if (choice.kind === 'new-game') {
      startGame(true);
      return;
    }
    const result =
      choice.id === AUTOSAVE_ID
        ? saveSlots.loadAutosave(assets.tilemap)
        : saveSlots.load(choice.id, assets.tilemap);
    if (!result.ok) {
      titleMenu = { kind: 'message', lines: loadFailed(result.reason) };
      return;
    }
    sim = result.value;
    startGame(false);
  };
  // The in-game menu (docs/spec/game-menu.md). While it is open the game
  // stands still: the frame loop shows the scene as it was when it
  // opened, dimmed, and nothing ticks.
  let gameMenu: GameMenu | null = null;
  const backdrop = document.createElement('canvas');
  backdrop.width = NATIVE_WIDTH;
  backdrop.height = NATIVE_HEIGHT;
  const backdropCtx = backdrop.getContext('2d')!;
  backdropCtx.imageSmoothingEnabled = false;
  const menuButton = document.querySelector<HTMLButtonElement>('#menu');
  // Windows that Escape closes before it opens the menu.
  const otherWindowOpen = (): boolean =>
    Boolean(
      speedWindow ||
      infoWindow ||
      mirror ||
      archive ||
      zooming ||
      lookingDown ||
      order.kind !== 'idle'
    );
  // The menu waits while a fight, a talk, a meeting, the Council or
  // the ending holds the game, as the autosave does.
  const openInGameMenu = (): boolean => {
    if (
      onTitle() ||
      !autosaveView().settled ||
      sim.meeting ||
      sim.council ||
      sim.ending ||
      meetingHoldsTime(meetingUi) ||
      councilWindow
    ) {
      return false;
    }
    // What is on screen, the Full Map Level's hi-res frame squeezed to
    // the same 320 by 200 as it is shown.
    backdropCtx.drawImage(
      level === 'full-map' ? screen.hires.canvas : screen.buffer.canvas,
      0,
      0,
      NATIVE_WIDTH,
      NATIVE_HEIGHT
    );
    drag = null;
    gameMenu = openGameMenu();
    menuOpenedAt = performance.now();
    return true;
  };
  menuButton?.addEventListener('click', () => {
    if (!gameMenu) {
      openInGameMenu();
    }
  });
  // Every window and notice of the game in play, closed for a game
  // loaded over it or a return to the title.
  const clearWindows = (): void => {
    mirror = null;
    archive = null;
    speedWindow = null;
    infoWindow = null;
    setOrder(IDLE_ORDER);
    zooming = false;
    lookingDown = false;
    canvas.style.cursor = 'default';
    drag = null;
    warMessage = null;
    meetingUi = null;
    councilWindow = null;
    passingMessage = null;
    talk = null;
    provisions = null;
    putDownMessage = null;
    landedMessage = null;
    box = null;
    boxWaiting = false;
    combat = null;
    battle = null;
    ending = null;
    letter = null;
    statusBox = null;
    chosenCharacter = null;
    driver.paused = false;
  };
  // Closing the menu takes its time out of the view's clock.
  const leaveGameMenu = (): void => {
    gameMenu = null;
    menuMs += performance.now() - menuOpenedAt;
    lastTime = viewNow();
  };
  // Back to the title menu, the game autosaved first; if it cannot be,
  // the game stays in play.
  const returnToTitle = (): void => {
    if (!saveSlots.autosave(sim).ok) {
      gameMenu = gameMenuMessage(AUTOSAVE_FAILED);
      return;
    }
    leaveGameMenu();
    clearWindows();
    sim = newSim();
    camera = openingCamera();
    level = 'animation';
    audio?.play(PIECE.title);
    titleMenu = openTitleMenu(titleSaves());
  };
  // Carry out what the in-game menu chose.
  const chooseInGame = (step: GameMenuStep): void => {
    gameMenu = step.menu;
    const choice = step.choice;
    switch (choice?.kind) {
      case undefined: {
        return;
      }
      case 'close': {
        leaveGameMenu();
        return;
      }
      case 'title': {
        returnToTitle();
        return;
      }
      case 'save-new':
      case 'save-over': {
        const result =
          choice.kind === 'save-new'
            ? saveSlots.save(choice.name, sim)
            : saveSlots.saveOver(choice.id, sim);
        gameMenu = gameMenuMessage(
          result.ok ? SAVED(result.value.name) : saveFailed(result.reason)
        );
        return;
      }
      case 'load': {
        const result =
          choice.id === AUTOSAVE_ID
            ? saveSlots.loadAutosave(assets.tilemap)
            : saveSlots.load(choice.id, assets.tilemap);
        if (!result.ok) {
          gameMenu = gameMenuMessage(loadFailed(result.reason));
          return;
        }
        leaveGameMenu();
        clearWindows();
        sim = result.value;
        startGame(false);
      }
    }
  };
  const frame = (realNow: number): void => {
    const now = realNow - menuMs;
    const elapsedMs = Math.min(1000, now - lastTime);
    lastTime = now;
    if (menuButton) {
      menuButton.hidden = onTitle() || gameMenu !== null;
    }
    if (gameMenu) {
      screen.buffer.drawImage(backdrop, 0, 0);
      drawGameMenu(screen.buffer, title.window, title.menuColours, gameMenu);
      screen.present();
      requestAnimationFrame(frame);
      return;
    }
    if (boot) {
      boot = stepBoot(boot, now, audio?.playing ?? false);
      if (!boot.done) {
        drawBoot(screen.buffer, bootView(boot, now));
        screen.present();
        requestAnimationFrame(frame);
        return;
      }
      boot = null;
      titleMenu = openTitleMenu(titleSaves());
    }
    if (titleMenu) {
      drawBoot(screen.buffer, titleScreen);
      drawTitleMenu(screen.buffer, title.window, title.menuColours, titleMenu);
      screen.present();
      requestAnimationFrame(frame);
      return;
    }
    const view = autosaveView();
    if (autosaveDue(autosavedAt, view)) {
      autosaveNow(view);
    }
    updateSound();
    // The message box: the open box times out and the boxes raised open
    // in turn, the game held while one waits (message-box.ts). Figures
    // held by a wait take up their scripts from now.
    const wasWaiting = boxWaiting;
    stepBoxes(now);
    if (wasWaiting && !boxWaiting && level === 'animation') {
      stage = resumeStage(stage, now);
    }
    // Game time does not pass on the Full Map Level
    // (finding:time-stops-on-full-map-level).
    if (level === 'full-map') {
      drawFullMapLevel(
        screen.hires,
        fullMap,
        fullMapDots(sim.roster),
        Math.floor(now / BLINK_PHASE_MS) % 2 === 0
      );
      // The pointer becomes the magnifying glass, centred on the spot.
      if (zooming && magnifier && hiresPointer) {
        screen.hires.drawImage(
          magnifier.image,
          hiresPointer.x - Math.floor(magnifier.image.width / 2),
          hiresPointer.y - Math.floor(magnifier.image.height / 2)
        );
      }
      if (mirror) {
        drawMirrorWindow(screen.hires, fullMap.window, mirror);
      }
      if (archive) {
        drawArchiveWindow(screen.hires, fullMap.window, archive);
      }
      if (speedWindow) {
        // Drawn at lo-res size: each of its pixels is two hi-res wide.
        screen.hires.save();
        screen.hires.setTransform(2, 0, 0, 1, 0, 0);
        drawSpeedWindow(
          screen.hires,
          fullMap.window,
          speedWindow,
          driver.speed,
          driver.paused
        );
        screen.hires.restore();
      }
      screen.present('hires');
      requestAnimationFrame(frame);
      return;
    }
    let animationTicked = false;
    if (level === 'animation') {
      // Talks hold the view's clock. Meetings of the watched Character
      // with an advisor start here without the Campaign Level's choice.
      // Time runs at the Animation Level's own pace, held while the
      // watched Character's figures walk (animation-pace.ts).
      const watchedEntry = sim.roster[watched];
      const paced = advanceAnimationPace(
        animationPaceState,
        driver.paused || boxWaiting ? 0 : elapsedMs,
        watchedEntry?.destination !== null &&
          watchedEntry?.destination !== undefined &&
          watchedEntry.state === 1,
        isHeld(sim)
      );
      animationPaceState = paced.pace;
      const ticks = paced.ticks;
      for (
        let i = 0;
        i < ticks &&
        !talk &&
        !holdsClock(provisions) &&
        !boxWaiting &&
        !sim.fight &&
        !sim.meeting;
        i++
      ) {
        sim = tickSim(sim);
        stepBoxes(now);
      }
      // Returning to the Campaign Level below must not tick again in
      // the same frame, especially on Very Hasty.
      animationTicked = true;
      if (sim.meeting?.kind === 'talk' && sim.meeting.a === watched) {
        const meeting = sim.meeting;
        sim = answerMeeting(sim, 'go-there').world;
        beginTalk(meeting, now);
      }
      if (sim.fight && !battle) {
        const watchingFight = sim.fight.rows.some(
          row => row.side === 'good' && row.entries.includes(watched)
        );
        if (watchingFight && fightOnAnimationLevel(sim)) {
          startAnimationFight(now, true);
        } else {
          goUpFromAnimation();
        }
      }
      if (talk) {
        talk = stepEncounterTalk(talk, figureWorld, now);
        if (!talk) {
          stage = resumeStage(stage, now);
        }
      } else if (battle && sim.fight && combat) {
        const previousPhase = battle.phase;
        battle = stepBattle(battle, sim.fight, vblankAt(now));
        if (battle.phase === 'fighting') {
          if (previousPhase === 'approach' && combat.kind === 'window') {
            combat = { ...combat, until: now + ORDERS_MS };
          }
          const fight = sim.fight;
          const result = stepCombatUi(
            combat,
            sim,
            now,
            choose,
            ANIMATION_ROUND_MS,
            driver.speed
          );
          sim = result.sim;
          combat = result.ui;
          if (sim.fight) {
            battle = markFallen(battle, sim.fight);
          } else {
            stage = walkAfterBattle(battle, fight, vblankAt(now));
            battle = null;
          }
        }
      } else if (!sim.fight && !holdsClock(provisions) && !boxWaiting) {
        stage = stepStage(stage, figureWorld, vblankAt(now));
        const landed = takeLanded(stage);
        stage = landed.stage;
        if (landed.due && putDownMessage) {
          landedMessage = putDownMessage;
          putDownMessage = null;
        }
      }
      if (level === 'animation') {
        if (
          sim.meeting ||
          sim.council ||
          sim.ending ||
          (!battle &&
            !talk &&
            watched !== NOBODY &&
            (stage.figures.length === 0 ||
              sim.roster[watched]!.strength === 0 ||
              (walkedOff(stage) && !sim.roster[watched]!.destination)))
        ) {
          goUpFromAnimation();
        } else if (!battle && !talk && watched !== NOBODY && walkedOff(stage)) {
          // The figures have walked off on the way somewhere: the
          // watched Character takes its held step and the next scene is
          // built where it now stands
          // (finding:movement-watched-character-advances-as-its-figures-walk-off).
          sim = releaseWatched(sim);
          goDownToAnimation(watched, true);
          requestAnimationFrame(frame);
          return;
        } else {
          screen.buffer.drawImage(scene, 0, 0);
          if (battle) {
            drawBattle(screen.buffer, animation, battle);
          } else if (talk) {
            drawEncounterTalk(screen.buffer, animation, talk);
          } else {
            drawFigures(screen.buffer, animation, stage);
            if (letter?.kind === 'open') {
              drawGandalfsLetter(screen.buffer, animation.window, assets.texts);
            }
            if (statusBox) {
              drawStatusBox(screen.buffer, animation.window, statusBox);
            }
            if (passingMessage) {
              drawEncounterNotice(
                screen.buffer,
                animation.window,
                passingMessage.text
              );
            }
            if (warMessage) {
              drawWarEventMessage(screen.buffer, animation.window, warMessage);
            }
          }
          drawAnimationIcons(screen.buffer, animation.icons);
          if (provisions) {
            drawProvisionsWindow(screen.buffer, animation.window, provisions);
          }
          if (combat) {
            drawCombatUi(
              screen.buffer,
              assets.window,
              combat,
              sim,
              battle?.phase === 'approach'
            );
          }
          screen.present();
          requestAnimationFrame(frame);
          return;
        }
      }
    }
    // A fight's announcement and a meeting's window open as raised boxes
    // (stepBoxes), a fight met while watching another Character after
    // returning to the Campaign Level.
    if (combat) {
      const result = stepCombatUi(combat, sim, now, choose, 0, driver.speed);
      sim = result.sim;
      combat = result.ui;
    }
    if (meetingUi) {
      ({ sim, ui: meetingUi } = stepMeetingUi(meetingUi, sim, now));
    }
    syncBox(now);
    // The Council of Elrond's message holds the game until its time is
    // up, and sets the Game Speed back to Normal.
    // It waits on its own loop, not the message box's
    // (finding:ui-council-of-elrond-message), so the open box closes.
    if (sim.council && !councilWindow) {
      closeBox(now);
      driver.speed = 'normal';
      speedWindow = null;
      infoWindow = null;
      drag = null;
      setOrder(IDLE_ORDER);
    }
    ({ sim, window: councilWindow } = stepCouncilMessage(
      councilWindow,
      sim,
      assets.texts,
      now
    ));
    // Once a fight has ended the game and its windows have closed, the
    // ending takes the screen for good.
    if (!ending && !combatHoldsTime(combat) && sim.ending) {
      closeBox(now);
      combat = null;
      startEnding(now);
    }
    if (ending) {
      ending = stepEndingScreen(ending, now);
      drawEndingScreen(screen.buffer, animation.window, scene, ending);
      screen.present();
      requestAnimationFrame(frame);
      return;
    }
    // Game time stands still while a fight or a meeting holds the game
    // (finding:time-stops-during-a-fight, finding:ui-meeting-window), or
    // while a raised box waits for the open one's deadline
    // (finding:ui-message-box-opening-waits-for-the-open-box); the ticks
    // due are dropped. Each tick's boxes open, or wait, before the next.
    const ticks = animationTicked ? 0 : driver.advance(elapsedMs);
    for (
      let i = 0;
      i < ticks &&
      !boxWaiting &&
      !combatHoldsTime(combat) &&
      !sim.fight &&
      !sim.meeting &&
      !sim.council;
      i++
    ) {
      sim = tickSim(sim);
      stepBoxes(now);
    }
    // Hovering the icon column does not scroll the map under it, and
    // dragging pans instead of edge scrolling.
    const direction =
      drag || (pointer && isOverIcons(pointer, placements))
        ? { x: 0, y: 0 }
        : edgeScrollDirection(pointer, assets.tilemap);
    camera = stepCamera(camera, direction, elapsedMs / 1000, assets.tilemap);
    const forces = forcesOnMap(sim.roster);
    const flashOn = Math.floor(now / FLASH_INTERVAL_MS) % 2 === 0;
    drawCampaignLevel(screen.buffer, assets, camera, forces, flashOn);
    drawOverlay(forces);
    screen.present();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

drawMessage(['Loading Campaign Level...']);

try {
  const [campaign, fullMap, animation, title, audio] = await Promise.all([
    loadCampaignAssets(),
    loadFullMapAssets(),
    loadAnimationAssets(),
    loadTitleAssets(),
    // The game plays without sound if its sound cannot load.
    loadGameAudio(choose).catch(() => null)
  ]);
  run(
    campaign,
    {
      ...fullMap,
      window: {
        ...windowStyle(
          blackToTransparent(fullMap.windowFrame),
          fullMap.palette.hex,
          fullMap.font
        ),
        hiresFont: fullMap.hiresFont
      },
      // Their black backgrounds are masked out like the Campaign Level's
      // icon sheet; how the original masked them is provisional.
      icons: fullMap.icons.map(icon => ({
        ...icon,
        image: blackToTransparent(icon.image)
      }))
    },
    animation,
    title,
    audio
  );
  drawMessage([]);
} catch (error) {
  drawMessage([
    'Campaign Level assets are missing.',
    'Run: bun run export:web',
    '',
    error instanceof Error ? error.message : String(error)
  ]);
}
