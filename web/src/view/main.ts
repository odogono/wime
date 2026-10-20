import {
  answerMeeting,
  createSim,
  forcesOnMap,
  formatClock,
  fullMapDots,
  giveOrder,
  mirrorListing,
  restoreSave,
  serialiseSave,
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
  scriptWorld,
  spawnParty,
  stepStage,
  walkedOff,
  type Stage
} from './animation-level';
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
  type AnimationAssets,
  type CampaignAssets
} from './assets';
import { loadGameAudio, type GameAudio } from './audio';
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
  drawMeetingUi,
  meetingHoldsTime,
  openMeetingUi,
  pressMeetingUi,
  stepMeetingUi,
  type MeetingUi
} from './meeting-window';
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
import { stepPassingMessage, type PassingMessage } from './passing-message';
import {
  chooseObject,
  drawProvisionsWindow,
  holdsClock,
  openObjectList,
  openProvisions,
  provisionsButtonAt,
  expired as provisionsExpired,
  type ProvisionsWindow
} from './provisions-window';
import { NATIVE_HEIGHT, NATIVE_WIDTH, createScreen, type Fit } from './screen';
import { QUIET, soundCues, type SoundView } from './sound-cues';
import { placeScenery } from './special-scenery';
import {
  drawSpeedWindow,
  layoutSpeedWindow,
  speedWindowOptionAt,
  type SpeedWindow
} from './speed-window';
import { createTickDriver } from './tick-driver';
import {
  drawWarEventMessage,
  stepWarEventMessage,
  type WarEventMessage
} from './war-event-message';
import { drawWindowFrame, windowStyle, windowText } from './window-frame';

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
// A press that moves no further than this is a click, not a drag.
const CLICK_TOLERANCE_PX = 3;

// The Level on show; the game opens on the Animation Level
// (finding:ui-game-starts-on-animation-level).
type Level = 'animation' | 'campaign' | 'full-map';

// `run` holds the whole view's state and handlers, in this order; search for
// the name to jump to a part:
// - state: `level` through `lastTime`, one `let` per open window or Level
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
  audio: GameAudio | null
): void => {
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
  // The single save slot (finding:ui-single-save-slot). Game Speed and
  // the camera are not saved, and a restore stays on this Level.
  const ARCHIVE_KEY = 'wime.archive';
  const saveGame = (): ArchiveWindow => {
    try {
      localStorage.setItem(ARCHIVE_KEY, serialiseSave(sim));
      return archiveMessage(ARCHIVE_MESSAGES.saved);
    } catch {
      return archiveMessage(ARCHIVE_MESSAGES.saveFailed);
    }
  };
  const restoreGame = (): ArchiveWindow => {
    const data = localStorage.getItem(ARCHIVE_KEY);
    const result = data === null ? null : restoreSave(data, assets.tilemap);
    if (!result || (!result.ok && result.reason === 'invalid')) {
      return archiveMessage(ARCHIVE_MESSAGES.noArchive);
    }
    if (!result.ok) {
      return archiveMessage(ARCHIVE_MESSAGES.otherVersion);
    }
    // The restored game stays on this Level, watching whom it watches.
    sim = watchEntry(result.state, level === 'animation' ? watched : null);
    // A message already on screen was shown; the restored game's own
    // waiting announcements follow.
    warMessage = null;
    // A restored meeting or Council gets a fresh window.
    meetingUi = null;
    councilWindow = null;
    passingMessage = null;
    talk = null;
    provisions = null;
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
  let sim: SimState = createSim(0x14_18, assets.startingState, assets.tilemap);
  // Open on the Ring-bearer's Force at Hobbiton, the one Force the
  // player commands at the start (docs/spec/starting-state.md). The
  // game itself opens on the Animation Level; this view starts on
  // the Campaign Level.
  const opening = forcesOnMap(sim.roster).find(
    force => force.leader.index === sim.ringBearer
  );
  let camera: Camera = opening
    ? clampCamera(
        {
          x: opening.position.x + 8 - viewWidthPx(assets.tilemap) / 2,
          y: opening.position.y + 8 - viewHeightPx(assets.tilemap) / 2
        },
        assets.tilemap
      )
    : { x: 0, y: 0 };
  let fit: Fit = screen.resize();
  if (sim.ringBearer !== null) {
    // Open on the Animation Level with the Ring-bearer
    // (finding:ui-game-starts-on-animation-level).
    queueMicrotask(() => goDownToAnimation(sim.ringBearer!));
  } else {
    level = 'campaign';
  }
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
  let chosenCharacter: number | null = null;
  let passingMessage: PassingMessage | null = null;
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
  // The title music plays first, until it ends or the player presses a
  // key or the mouse (finding:sound-fight-and-ending-music).
  let titleMusic = audio !== null;
  let pressed = false;
  audio?.play(PIECE.title);
  window.addEventListener('pointerdown', () => (pressed = true));
  window.addEventListener('keydown', () => (pressed = true));
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
    if (titleMusic) {
      if (audio.playing && !pressed) {
        lastSound = { ...next, levelEntries: next.levelEntries };
        return;
      }
      // The title gives way to the Level's own music.
      titleMusic = false;
      lastSound = { ...lastSound, levelEntries: -1 };
    }
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
  };
  let lastTime = performance.now();

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

  // Down to the Animation Level, watching a roster entry: its scene is
  // built once, from where it stands (docs/spec/animation-level.md).
  const goDownToAnimation = (index: number): void => {
    const entry = sim.roster[index];
    if (!entry?.position) {
      return;
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
      { facing: entry.facing, position: entry.position },
      sim.clock.quarterHour,
      choose,
      (tile, random, strips) => {
        placeTile = tile;
        return placeScenery(tile, random, strips);
      }
    );
    levelEntries += 1;
    const force = forcesOnMap(sim.roster).find(
      candidate => candidate.leader.index === index
    );
    const members = force?.members ?? [entry];
    party = members.map(member => member.index);
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
    const start = vblankAt(performance.now());
    stage = {
      ...stage,
      figures: stage.figures.map(figure => ({ ...figure, next: start }))
    };
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
    battle = spawnBattle(sim, figureWorld, choose, vblankAt(now));
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
    const now = performance.now();
    // provisional: the eye opens nothing yet.
    if (icon?.name === 'map') {
      goUpFromAnimation();
    } else if (provisions && provisions.kind !== 'message') {
      // A press off the buttons closes the window, as its default does
      // (finding:ui-provisions-window).
      const pressed = provisionsButtonAt(provisions, point);
      const position = sim.roster[watched]?.position;
      if (!pressed || !position) {
        provisions = null;
      } else if (typeof pressed.value === 'number') {
        if (provisions.kind !== 'menu') {
          ({ sim, window: provisions } = chooseObject(
            assets.window.font.metrics,
            sim,
            provisions.chosen,
            provisions.kind,
            pressed.value,
            position,
            assets.texts,
            givenTips,
            choose,
            now
          ));
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
    } else if (icon?.name === 'sack' && !battle && !talk && !sim.fight) {
      // The sack is ignored during a fight (finding:ui-provisions-window).
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
    } else if (talk) {
      advanceTalk(performance.now());
    }
  };

  // Up to the Full Map Level (manual, pdf-p3). Any half-given Order or
  // open window is dropped, as when a decision window opens
  // (finding:ui-pointer-and-icon-column).
  const goUp = (): void => {
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

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', event => {
    if (ending) {
      ending = turnEndingPage(ending, performance.now());
      return;
    }
    // The Council's message cannot be dismissed, and nothing else
    // answers while it is up.
    if (councilWindow) {
      return;
    }
    // Fight options and messages take presses on either Level.
    if (
      level !== 'full-map' &&
      combat &&
      (combatHoldsTime(combat) || combat.kind === 'boxes')
    ) {
      if (battle?.phase === 'approach') {
        return;
      }
      const before = combat;
      const result = pressCombatUi(
        combat,
        sim,
        toNative(event),
        performance.now(),
        driver.speed
      );
      sim = result.sim;
      combat = result.ui;
      if (
        before.kind === 'announcement' &&
        combat?.kind === 'window' &&
        sim.fight
      ) {
        if (fightOnAnimationLevel(sim)) {
          startAnimationFight(performance.now());
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
    // The meeting window takes every press while it is up.
    if (meetingHoldsTime(meetingUi)) {
      const result = pressMeetingUi(
        meetingUi!,
        sim,
        pointer,
        performance.now(),
        driver.speed
      );
      const meeting = sim.meeting;
      sim = result.sim;
      meetingUi = result.ui;
      if (result.choice === 'go-there' && meeting) {
        goDownToAnimation(meeting.a);
        if (meeting.kind === 'talk') {
          beginTalk(meeting, performance.now());
        }
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
    // provisional: the magnifying glass goes down to the Force under it;
    // how the original picks whom to watch is not traced.
    if (lookingDown && !icon) {
      const target = targetAt(pointer, forcesOnMap(sim.roster));
      if (target?.kind === 'force') {
        goDownToAnimation(target.force.leader.index);
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
    // A press anywhere clears an open window, as with the original's
    // status window (manual, pdf-p14).
    if (infoWindow) {
      infoWindow = null;
      return;
    }
    if (icon?.icon.name === 'hourglass') {
      toggleSpeedWindow();
      return;
    }
    // Drags starting on an icon are for the icon, not the map.
    if (!icon) {
      drag = { camera, pointer };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    }
  });
  canvas.addEventListener('pointermove', event => {
    if (level === 'animation') {
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
    if (drag) {
      const released = toNative(event);
      const moved = Math.max(
        Math.abs(released.x - drag.pointer.x),
        Math.abs(released.y - drag.pointer.y)
      );
      // A press that did not pan is a click: it opens the window at
      // the top left naming what was clicked (manual, pdf-p16).
      if (moved <= CLICK_TOLERANCE_PX) {
        camera = drag.camera;
        const target = targetAt(released, forcesOnMap(sim.roster));
        infoWindow =
          target?.kind === 'force'
            ? layoutInfoWindow(
                assets.window.font.metrics,
                forceWindowLines(target.force)
              )
            : target
              ? layoutInfoWindow(assets.window.font.metrics, [target.name])
              : null;
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
    if (councilWindow) {
      return;
    }
    const key = event.key.toLowerCase();
    if (combatHoldsTime(combat)) {
      return;
    }
    if (level === 'animation') {
      if (key === 'u') {
        goUpFromAnimation();
      } else if (key === 'p') {
        driver.paused = !driver.paused;
      } else if (key === ' ' || key === 'enter') {
        advanceTalk(performance.now());
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
      ending = turnEndingPage(ending, performance.now());
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

  const frame = (now: number): void => {
    const elapsedMs = Math.min(1000, now - lastTime);
    lastTime = now;
    updateSound();
    // Notices wait on the Full Map Level and behind decision windows.
    ({ message: passingMessage, sim } = stepPassingMessage(
      passingMessage,
      sim,
      now,
      level !== 'full-map' &&
        !combat &&
        !sim.fight &&
        !meetingUi &&
        !sim.meeting &&
        !councilWindow &&
        !sim.council &&
        !talk &&
        !ending &&
        !sim.ending,
      driver.speed
    ));
    // Game time does not pass on the Full Map Level
    // (finding:time-stops-on-full-map-level).
    if (level === 'full-map') {
      // An announcement waits, its time kept, until the Campaign Level.
      ({ message: warMessage, sim } = stepWarEventMessage(
        warMessage,
        sim,
        now,
        false,
        driver.speed
      ));
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
      const ticks = driver.advance(elapsedMs);
      if (provisions && provisionsExpired(provisions, now)) {
        provisions = null;
      }
      for (
        let i = 0;
        i < ticks &&
        !talk &&
        !holdsClock(provisions) &&
        !sim.fight &&
        !sim.meeting;
        i++
      ) {
        sim = tickSim(sim);
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
      } else if (!sim.fight && !holdsClock(provisions)) {
        stage = stepStage(stage, figureWorld, vblankAt(now));
      }
      if (level === 'animation') {
        if (
          sim.meeting ||
          sim.council ||
          sim.ending ||
          (!battle &&
            !talk &&
            (walkedOff(stage) ||
              stage.figures.length === 0 ||
              sim.roster[watched]!.strength === 0))
        ) {
          goUpFromAnimation();
        } else {
          screen.buffer.drawImage(scene, 0, 0);
          if (battle) {
            drawBattle(screen.buffer, animation, battle);
          } else if (talk) {
            drawEncounterTalk(screen.buffer, animation, talk);
          } else {
            drawFigures(screen.buffer, animation, stage);
            if (passingMessage) {
              drawEncounterNotice(
                screen.buffer,
                animation.window,
                passingMessage.text
              );
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
    // A fight met while watching another Character also needs its
    // announcement after returning to the Campaign Level.
    if (sim.fight && !combat) {
      combat = startCombatUi(sim, now);
    }
    if (combat) {
      const result = stepCombatUi(combat, sim, now, choose, 0, driver.speed);
      sim = result.sim;
      combat = result.ui;
    }
    // A meeting, new or restored, opens its window.
    if (sim.meeting && !meetingHoldsTime(meetingUi)) {
      meetingUi = openMeetingUi(assets.window.font.metrics, sim, now);
      speedWindow = null;
      infoWindow = null;
      drag = null;
      setOrder(IDLE_ORDER);
    }
    if (meetingUi) {
      ({ sim, ui: meetingUi } = stepMeetingUi(
        meetingUi,
        sim,
        now,
        driver.speed
      ));
    }
    // The Council of Elrond's message holds the game until its time is
    // up, and sets the Game Speed back to Normal.
    if (sim.council && !councilWindow) {
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
    if (!ending && !combat && sim.ending) {
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
    // (finding:time-stops-during-a-fight, finding:ui-meeting-window);
    // the ticks due are dropped.
    const ticks = animationTicked ? 0 : driver.advance(elapsedMs);
    for (
      let i = 0;
      i < ticks &&
      !combatHoldsTime(combat) &&
      !sim.fight &&
      !sim.meeting &&
      !sim.council;
      i++
    ) {
      sim = tickSim(sim);
      if (sim.fight) {
        combat = startCombatUi(sim, now);
        speedWindow = null;
        infoWindow = null;
        drag = null;
        setOrder(IDLE_ORDER);
      }
    }
    // War Event announcements share the message box with a fight's
    // windows and wait for them (docs/spec/war-events.md).
    ({ message: warMessage, sim } = stepWarEventMessage(
      warMessage,
      sim,
      now,
      !combat && !meetingUi && !councilWindow && !passingMessage,
      driver.speed
    ));
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
  const [campaign, fullMap, animation, audio] = await Promise.all([
    loadCampaignAssets(),
    loadFullMapAssets(),
    loadAnimationAssets(),
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
