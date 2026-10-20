// The game clock: a day count and a quarter-hour count, as the original
// keeps them (docs/spec/time.md). One sim tick advances the clock by one
// quarter-hour; the view layer decides how often ticks happen in real
// time (Game Speed, ADR-0002), which the sim knows nothing about.

export interface Clock {
  day: number;
  quarterHour: number;
}

export const QUARTER_HOURS_PER_DAY = 96;
export const QUARTER_HOURS_PER_HOUR = 4;

// Day 0 at quarter-hour 64: the start of hour 16, displayed as 5 p.m.
export const INITIAL_CLOCK: Clock = { day: 0, quarterHour: 64 };

export const tickClock = (clock: Clock): Clock =>
  clock.quarterHour + 1 >= QUARTER_HOURS_PER_DAY
    ? { day: clock.day + 1, quarterHour: 0 }
    : { day: clock.day, quarterHour: clock.quarterHour + 1 };

export const advanceClock = (clock: Clock, ticks: number): Clock => {
  let next = clock;
  for (let i = 0; i < ticks; i++) {
    next = tickClock(next);
  }
  return next;
};

export interface CalendarDate {
  dayOfMonth: number;
  month: string;
  year: number;
}

// The eight months the calendar knows, September to April, and the day
// count each starts on. September starts before day 0, so day 0 falls on
// 23 September. Every month has 30 days except December with 32.
const MONTHS: { name: string; startsOnDay: number }[] = [
  { name: 'September', startsOnDay: -22 },
  { name: 'October', startsOnDay: 8 },
  { name: 'November', startsOnDay: 38 },
  { name: 'December', startsOnDay: 68 },
  { name: 'January', startsOnDay: 100 },
  { name: 'February', startsOnDay: 130 },
  { name: 'March', startsOnDay: 160 },
  { name: 'April', startsOnDay: 190 }
];

// 1 January, the day the year turns from 1418 to 1419 s.r.
const NEW_YEAR_DAY = 100;

export const calendarDate = (day: number): CalendarDate => {
  let current = MONTHS[0]!;
  for (const month of MONTHS) {
    if (month.startsOnDay <= day) {
      current = month;
    }
  }
  return {
    dayOfMonth: day - current.startsOnDay + 1,
    month: current.name,
    year: day >= NEW_YEAR_DAY ? 1419 : 1418
  };
};

export interface DisplayTime {
  hour: number;
  meridiem: 'a.m.' | 'p.m.';
}

// The original names the hour after the one under way: hours 0-10 show
// as 1-11 a.m., 11 as 12 p.m., 12-22 as 1-11 p.m., 23 as 12 a.m.
export const displayTime = (quarterHour: number): DisplayTime => {
  const hour = Math.floor(quarterHour / QUARTER_HOURS_PER_HOUR);
  if (hour <= 10) {
    return { hour: hour + 1, meridiem: 'a.m.' };
  }
  if (hour === 11) {
    return { hour: 12, meridiem: 'p.m.' };
  }
  if (hour <= 22) {
    return { hour: hour - 11, meridiem: 'p.m.' };
  }
  return { hour: 12, meridiem: 'a.m.' };
};

export const formatClock = (clock: Clock): string => {
  const date = calendarDate(clock.day);
  const time = displayTime(clock.quarterHour);
  return `${time.hour} ${time.meridiem}  ${date.month} ${date.dayOfMonth},  ${date.year} s.r.`;
};
