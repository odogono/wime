import { talk } from '@northtalk/ts';

// The daily War Event check of the shipped game, as a Scenario Script: a
// port of dailyWarEvents (war-events.ts). The War Events are a set of
// event numbers and their days; the host converts the mask (#194). Event
// 7 comes last, so the events it brings follow at the next check
// (finding:ai-war-events-set-once).
export const WAR_EVENTS = talk`
  constant SARUMAN_MARCHES_DAY = 149
  constant DARK_LORD_MARCHES_DAY = 169
  constant GANDALF = 1
  constant THEODEN = 26
  constant DENETHOR = 32

  -- The two messages, by their place in the Reference Build
  -- (finding:ai-war-events).
  constant SARUMAN_MARCHES = "code+0x0e2c1"
  constant DARK_LORD_MARCHES = "code+0x0e2e1"

  function mobilised e
    return e is not nothing and the allegiance of e > 1
  end mobilised

  -- Returns {announcements, warEvents}; each announcement names its text.
  on dailyWarEvents w
    put [] into announcements
    put the day of the clock of w into day
    put entryAt(w, GANDALF) into gandalf
    if gandalf is not nothing then
      if the state of gandalf = 0 and the triggerByte of gandalf = 0 and not hasWarEvent(w, 1) then
        -- Bits 1 and 2, with no day recorded.
        put setWarEventOnly(w, 1) into w
        put setWarEventOnly(w, 2) into w
      end if
    end if
    put hasWarEvent(w, 7) into darkLord
    if (day = SARUMAN_MARCHES_DAY or darkLord) and not hasWarEvent(w, 4) then
      put setWarEvent(w, 4, day) into w
      put {day: day, event: 4, text: SARUMAN_MARCHES} after announcements
    end if
    if mobilised(entryAt(w, THEODEN)) then put setWarEvent(w, 5, day) into w
    if mobilised(entryAt(w, DENETHOR)) or darkLord then put setWarEvent(w, 3, day) into w
    if darkLord then put setWarEvent(w, 6, day) into w
    if day = DARK_LORD_MARCHES_DAY and not hasWarEvent(w, 7) then
      put setWarEvent(w, 7, day) into w
      put {day: day, event: 7, text: DARK_LORD_MARCHES} after announcements
    end if
    return {announcements: announcements, warEvents: the warEvents of w}
  end dailyWarEvents

  -- The text an announcement names, through the text Engine Primitive.
  on textOf id
    ask engine to text id into message
    return message
  end textOf

  function setWarEventOnly w, bit
    if not hasWarEvent(w, bit) then put bit after the events of the warEvents of w
    return w
  end setWarEventOnly
`;
