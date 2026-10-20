// The scenery of particular Places, from the switch on the tile byte at
// code+0x00d3c (finding:graphics-animation-level-place-scenery). Each
// case first draws random(3), then adds its strips; the order of the
// random draws is the original's. Fields a case never writes keep the
// slot's old value in the original: a replaced strip keeps its mirror
// flag, and a fresh slot is taken as unmirrored.
import type { SpecialScenery } from './animation-scene';

// Far hills, middle distance and ground strips the cases reuse.
const HILLS = -7536;
const GROUND = { grass: -3059, rock: -3058, scrub: -3057 };

export const placeScenery: SpecialScenery = (tile, random, strips) => {
  const r3 = random(3);
  const add = (id: number, x: number, y: number, mirrored = false): void => {
    strips.push({ id, mirrored, x, y });
  };
  // Replace the last strip so far, keeping its mirror flag.
  const replace = (id: number, x: number, y: number): void => {
    const last = strips.pop();
    strips.push({ id, mirrored: last?.mirrored ?? false, x, y });
  };
  const coin = (): boolean => random(2) !== 0;

  // A town or village (code+0x01206): houses and the ground, or at
  // Hobbiton a third house, or elsewhere two cottages.
  const town = (hobbiton: boolean): void => {
    if (r3 === 2 && !hobbiton) {
      // The two cottages replace the last strip.
      strips.pop();
      const x = random(112);
      add(201, x, 29);
      add(201, x - 30, random(18) + 29, true);
    } else {
      replace(HILLS, 0, hobbiton && r3 === 2 ? 45 : 54);
      const house = r3 === 0 ? 205 : r3 === 1 ? 204 : 216;
      const [x, y] = r3 === 2 ? [93, 46] : [135, 43];
      add(house, x, y, coin());
    }
    add(GROUND.grass, 0, 104);
  };

  switch (tile) {
    case 10: {
      // Weathertop and Deadman's Dike: ruins.
      add(HILLS, 0, 54);
      add(207, 102, 33, coin());
      add(GROUND.scrub, 0, 94);
      return { extra: true };
    }
    case 11: {
      // The White Towers.
      replace(HILLS, 0, 45);
      add(218, 123, 9, true);
      add(218, 147, 9, true);
      add(218, 141, 17, true);
      add(GROUND.grass, 0, 104);
      return { extra: true };
    }
    case 12: {
      // Isengard.
      replace(-15_359, -60, 8);
      add(GROUND.grass, -60, 104);
      add(202, 2, -9);
      return { extra: false, ground: 0x91 };
    }
    case 13:
    case 45: {
      // Erech and the Grey Havens.
      add(HILLS, 0, 54);
      const mirrored = coin();
      if (random(2) === 0) {
        add(216, 93, 46, mirrored);
      } else {
        add(208, tile === 13 ? 112 : 92, 21, mirrored);
      }
      add(GROUND.grass, 0, 94);
      return { extra: true };
    }
    case 14:
    case 46:
    case 60:
    case 78:
    case 79:
    case 94:
    case 174: {
      town(false);
      return { extra: true };
    }
    case 125: {
      town(false);
      return { extra: false, ground: 0 };
    }
    case 62: {
      town(true);
      return { extra: true };
    }
    case 26: {
      // Orc holds in the mountains.
      replace(HILLS, 0, 54);
      add(206, 86, 8, coin());
      add(GROUND.rock, 0, 104);
      return { extra: true, ground: 0 };
    }
    case 28:
    case 59: {
      // A castle on a hill: Edoras, the Hornburg, Dol Amroth.
      replace(HILLS, 0, 69);
      add(211, 60, -13, coin());
      add(GROUND.rock, 0, 104);
      return { extra: true };
    }
    case 29: {
      // Ruined cities.
      add(220, random(100), 68);
      return { extra: false };
    }
    case 30: {
      replace(HILLS, 0, 45);
      add(216, 93, 46, coin());
      add(GROUND.grass, 0, 104);
      return { extra: true };
    }
    case 43:
    case 44:
    case 77: {
      // Barad-dûr, Minas Morgul, Cirith Ungol and Carach Angren.
      replace(HILLS, 0, 69);
      add(203, 60, -13, coin());
      add(GROUND.scrub, 0, 104);
      return tile === 43 ? { extra: false, ground: 0 } : { extra: true };
    }
    case 61: {
      // The Morannon.
      add(210, 0, 29);
      return { extra: false, ground: 0x91 };
    }
    case 93: {
      // Mount Doom stands alone.
      strips.length = 0;
      add(-16_336, 0, 0);
      add(GROUND.scrub, 0, 104);
      return { extra: false };
    }
    case 109: {
      // Dol Guldur.
      add(200, 20, 0);
      return { extra: false };
    }
    case 141: {
      return { extra: false };
    }
    case 157: {
      // Dimrill Dale, under the gate of Moria.
      add(GROUND.rock, 0, 89);
      add(215, 0, 0, coin());
      return { extra: false };
    }
    case 188: {
      // Rivendell stands alone.
      strips.length = 0;
      add(-14_956, 0, 6);
      add(GROUND.scrub, 0, 104);
      const x = random(112);
      add(201, x, 0);
      add(201, x - 48, 0, true);
      return { extra: false, ground: 0 };
    }
    case 203: {
      // Lórien.
      const mirrored = coin();
      add(214, random(112), 2, mirrored);
      return { extra: false, ground: 0 };
    }
    case 252: {
      // Minas Tirith and the Rammas forts.
      add(-15_359, -60, 8);
      add(212, 2, 35);
      return { extra: false, ground: 0 };
    }
    case 253: {
      // Tom Bombadil's house.
      replace(HILLS, 0, 69);
      add(213, 112, 29);
      add(GROUND.rock, 0, 104);
      return { extra: false, ground: 0 };
    }
    default: {
      return { extra: tile !== 0 };
    }
  }
};
