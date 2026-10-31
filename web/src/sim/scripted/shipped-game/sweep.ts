import { talk } from '@northtalk/ts';

// The movement sweep of the shipped game, as a Scenario Script (#194):
// sweepMovement and the callbacks tickSim gives it, the wake test before
// each step and, after it, the tripwires, the Ring at Barad-dûr and the
// combat search with the fights and meetings it starts. A port of
// movement.ts, wake.ts, war-events.ts (tripwires), combat.ts (findMatch),
// encounters.ts and meetings.ts, kept line for line where it can be so a
// differential test can hold the two to the same results.
//
// Roster indexes are the TypeScript sim's, counted from 0, so entry i is
// item i + 1 of the roster. The world is a map holding the core state the
// sweep reads and writes; the host converts it each tick. Unchanging
// Scenario data (Places, speeds, waterways) is loaded once, by `load`.
export const SWEEP = talk`
  -- Unchanging Scenario data, loaded once by the host.
  script variable placeAt = {}
  script variable speeds = nothing
  script variable waterways = nothing
  -- Each river's bounding box, so the geometry skips the rivers a line
  -- can't reach.
  script variable riverBoxes = []

  constant TILE = 16
  constant STEP_DX = [0, 1, 1, 1, 0, -1, -1, -1]
  constant STEP_DY = [-1, -1, 0, 1, 1, 1, 0, -1]
  constant STEERING_WEIGHTS = [100, 69, 39, 19, 9, 19, 39, 69]
  constant BY_SIGN = [7, 0, 1, 0, 6, 0, 2, 0, 5, 4, 3]

  constant FIRST_NAZGUL = 79
  constant LAST_NAZGUL = 87
  constant FORD_OF_BRUINEN = 22
  constant RING_BEARER_TRIGGER = 1

  constant LAST_GOOD_ENTRY = 78
  constant LAST_EVIL_ENTRY = 151
  constant FIRST_ENCOUNTER = 152
  constant LAST_ENCOUNTER = 195
  constant MEETING_DISTANCE = 7
  constant ROW_DISTANCE = 9
  constant MAX_ROWS_PER_SIDE = 19
  constant BALROG_FIGURE = 12
  constant SHELOB = 151
  constant FIRST_BALROG = 183
  constant LAST_BALROG = 187
  constant ELVEN_CLOAK = 8
  constant NO_EVASION_AT = [{x: 1200, y: 400}, {x: 1744, y: 1008}]

  constant LAST_FELLOWSHIP_ENTRY = 12
  constant SMALL_STRENGTH = 99
  constant SCOUTS_FIGURE = 13
  constant MET_ONCE_CHANCE = 100
  constant RETURNS_CHANCE = 1
  constant MOBILISED_ABOVE = 3
  constant ADVISOR = 3

  constant RING = 0
  constant BARAD_DUR = {x: 1856, y: 1120}
  constant ISEN_FORD = {x: 1104, y: 928}
  constant MORDOR_APPROACHES = {x: 1664, y: 1008}

  constant RING_BEARER_REACH = 9
  constant GANDALF_REACH = 4
  constant GANDALFS = [1, 2]
  constant DAILY_CHECK_HOUR = 8
  constant QUARTER_HOURS_PER_HOUR = 4

  constant CROSSING_DETOUR_RATIO = 1.5
  constant CROSSING_NEAR_LINE = 64

  on load data
    put the placeAt of data into placeAt
    put the speeds of data into speeds
    put the waterways of data into waterways
    put [] into riverBoxes
    if waterways is not nothing then
      repeat for each river in the rivers of waterways
        put boxOf(river) after riverBoxes
      end repeat
    end if
    return true
  end load

  -- The sweep from entry from, held before entry holdAt if it would move.
  on sweep w, fromEntry, holdAt
    repeat for each i in fromEntry..(the length of the roster of w - 1)
      put wakeEntry(w, i) into w
      put item (i + 1) of the roster of w into entry
      ask engine to mark into rng
      put the crossingLegs of w into legs
      put item (the route of entry + 1) of the routes of w into route
      put tickEntry(w, i) into w
      put item (i + 1) of the roster of w into stepped
      put the position of stepped is not nothing and the position of entry is not nothing and the position of stepped <> the position of entry into moved
      if moved and i = holdAt then
        ask engine to reset rng
        put legs into the crossingLegs of w
        if route is not nothing then
          put route into item (the route of entry + 1) of the routes of w
        end if
        put entry into item (i + 1) of the roster of w
        return {heldAt: i, stoppedAt: nothing, world: w}
      end if
      if moved then
        put afterStep(w, i) into outcome
        if the stopped of outcome then
          return {stoppedAt: i, world: the world of outcome}
        end if
        put the world of outcome into w
      end if
    end repeat
    return {stoppedAt: nothing, world: w}
  end sweep

  -- Arithmetic helpers.
  function sign n
    if n > 0 then return 1
    if n < 0 then return -1
    return 0
  end sign

  function byteOf n
    return ((n mod 256) + 256) mod 256
  end byteOf

  function bitSet byte, bit
    return (byte div (2 ^ bit)) mod 2 = 1
  end bitSet

  function tileAligned p
    return the x of p mod TILE = 0 and the y of p mod TILE = 0
  end tileAligned

  function samePoint a, b
    return the x of a = the x of b and the y of a = the y of b
  end samePoint

  function near a, b, distance
    return abs(the x of a - the x of b) <= distance and abs(the y of a - the y of b) <= distance
  end near

  function entryAt w, i
    return item (i + 1) of the roster of w
  end entryAt

  function terrainAt p
    ask engine to terrain the x of p, the y of p into t
    return t
  end terrainAt

  function draw n
    ask engine to draw n into r
    return r
  end draw

  function topLeader w, e
    put [] into seen
    put e into current
    repeat while the leader of current is not nothing
      if the index of current is in seen then
        throw {code: "leader loop", entry: the index of e}
      end if
      put the index of current after seen
      put entryAt(w, the leader of current) into current
    end repeat
    return current
  end topLeader

  function isEncounter i
    return i >= FIRST_ENCOUNTER and i <= LAST_ENCOUNTER
  end isEncounter

  -- War Events, as a set of event numbers and their days.
  function hasWarEvent w, bit
    return bit is in the events of the warEvents of w
  end hasWarEvent

  function setWarEvent w, bit, day
    if hasWarEvent(w, bit) then return w
    put bit after the events of the warEvents of w
    put byteOf(day) into item (bit + 1) of the days of the warEvents of w
    return w
  end setWarEvent

  -- Movement (movement.ts).
  function desiredFacing origin, target
    put abs(the x of origin - the x of target) into dx
    put abs(the y of origin - the y of target) into dy
    put 0 into signX
    if 2 * dx > dy then
      put sign(the x of target - the x of origin) into signX
      if signX = 0 then put 1 into signX
    end if
    put 0 into signY
    if 2 * dy >= dx then
      put sign(the y of target - the y of origin) into signY
      if signY = 0 then put 1 into signY
    end if
    return item ((signY + 1) * 4 + signX + 2) of BY_SIGN
  end desiredFacing

  function steer e, roll100, target, straightStep
    put the position of e into position
    put desiredFacing(position, target) into desired
    put {x: the x of position + TILE * item (desired + 1) of STEP_DX, y: the y of position + TILE * item (desired + 1) of STEP_DY} into ahead
    if straightStep and roll100 >= 90 then
      if terrainAt(ahead) >= 10 then return desired
    end if
    put 0 into best
    put the facing of e into bestFacing
    repeat for each i in 0..7
      put (desired + i) mod 8 into candidate
      put {x: the x of position + TILE * item (candidate + 1) of STEP_DX, y: the y of position + TILE * item (candidate + 1) of STEP_DY} into tile
      put item (i + 1) of STEERING_WEIGHTS * terrainAt(tile) into score
      if the facing of e + 4 = candidate then put score div 8 into score
      if score > best then
        put score into best
        put candidate into bestFacing
      end if
    end repeat
    return bestFacing
  end steer

  function atFord e
    put the (FORD_OF_BRUINEN as text) of placeAt into ford
    return ford is not nothing and the position of e is not nothing and samePoint(the position of e, ford)
  end atFord

  -- Arrival: returns the world with the entry written back.
  function arrive w, e
    put item (the route of e + 1) of the routes of w otherwise [] into route
    put item 1 of route into nextStop
    if nextStop is not nothing then
      put items 2..-1 of route into item (the route of e + 1) of the routes of w
    end if
    if nextStop is nothing and the index of e >= FIRST_NAZGUL and the index of e <= LAST_NAZGUL and atFord(e) then
      put nothing into the destination of e
      put 0 into the state of e
      put {event_bit: 0, kind: "near-ring-bearer"} into the trigger of e
      put RING_BEARER_TRIGGER into the triggerByte of e
    else
      put nothing into the destination of e
      if nextStop is not nothing then
        put the (nextStop as text) of placeAt into the destination of e
      end if
      put 3 into the state of e
    end if
    put e into item (the index of e + 1) of the roster of w
    return w
  end arrive

  function crossingLeg w, e
    if the movementRule of w is not "crossing" or waterways is nothing then return w
    put the destination of e into destination
    put the index of e as text into key
    put the (key) of the crossingLegs of w into leg
    if leg is not nothing then
      if samePoint(the destination of leg, destination) then return w
    end if
    put chooseCrossing(the position of e, destination, []) into the (key) of the crossingLegs of w
    return w
  end crossingLeg

  function tickEntry w, i
    put entryAt(w, i) into e
    if the ticked of e is not true or the state of e = 0 or the state of e = 2 or the leader of e is not nothing then return w
    if the destination of e is nothing or the position of e is nothing or the strength of e = 0 then return w
    if the x of the destination of e = 0 then return w
    if the state of e = 3 then
      if the stamina of e < the maxStamina of e then
        put min(255, the stamina of e + 2) into the stamina of e
        put e into item (i + 1) of the roster of w
        return w
      end if
      put the quarterHour of the clock of w into quarterHour
      if quarterHour > 20 and quarterHour < 52 then
        if draw(10) = 0 then
          put 1 into the state of e
          put e into item (i + 1) of the roster of w
        end if
      end if
      return w
    end if
    if the stamina of e = 0 then
      put 3 into the state of e
      put e into item (i + 1) of the roster of w
      return w
    end if
    put crossingLeg(w, e) into w
    put the (i as text) of the crossingLegs of w into leg
    put nothing into waypoint
    if leg is not nothing then put the waypoint of leg into waypoint
    put the facing of e into facing
    if tileAligned(the position of e) then
      put draw(100) into roll
      put the destination of e into target
      if waypoint is not nothing then put waypoint into target
      put steer(e, roll, target, waypoint is nothing) into facing
    end if
    if facing mod 2 = 1 then
      put the diagonal of speeds into row
    else
      put the straight of speeds into row
    end if
    put {x: the x of the position of e + 8, y: the y of the position of e + 8} into centre
    put ((item (the speed of e + 1) of row otherwise 0) * terrainAt(centre)) div 100 into increment
    put increment + the fraction of e into total
    put the stamina of e into stamina
    if the maxStamina of e < 255 then put max(0, the stamina of e - 1) into stamina
    put facing into the facing of e
    put total mod 256 into the fraction of e
    put stamina into the stamina of e
    if total < 256 then
      put e into item (i + 1) of the roster of w
      return w
    end if
    put total div 256 into pixels
    put the position of e into origin
    put {x: the x of origin + item (facing + 1) of STEP_DX, y: the y of origin + item (facing + 1) of STEP_DY} into position
    if pixels > 1 and not tileAligned(position) then
      put {x: the x of position + item (facing + 1) of STEP_DX, y: the y of position + item (facing + 1) of STEP_DY} into position
    end if
    put position into the position of e
    if tileAligned(position) and samePoint(position, the destination of e) then
      if leg is not nothing then delete the (i as text) of the crossingLegs of w
      return arrive(w, e)
    end if
    put e into item (i + 1) of the roster of w
    if leg is not nothing and waypoint is not nothing and tileAligned(position) then
      if samePoint(position, waypoint) then
        put chooseCrossing(position, the destination of e, [...the riversCrossed of leg, ...the rivers of leg]) into the (i as text) of the crossingLegs of w
      end if
    end if
    return w
  end tickEntry

  -- Waking (wake.ts).
  function standsAt e
    return the position of e otherwise {x: 0, y: 0}
  end standsAt

  function liveTrigger w, byte
    put 0 into firstBit
    if byte > 15 then put 4 into firstBit
    repeat for each bit in firstBit..(firstBit + 3)
      if bitSet(byte, bit) and hasWarEvent(w, bit) then return true
    end repeat
    return false
  end liveTrigger

  function highestBit byte
    put -1 into bit
    repeat for each b in 0..7
      if bitSet(byte, b) then put b into bit
    end repeat
    return bit
  end highestBit

  function triggerMet w, e
    put the triggerByte of e into byte
    if byte = 0 then return false
    if not liveTrigger(w, byte) then return false
    put highestBit(byte) into bit
    if bit = 0 then
      if the ringBearer of w is nothing then return false
      put entryAt(w, the ringBearer of w) into bearer
      if bearer is nothing then return false
      return near(standsAt(e), standsAt(topLeader(w, bearer)), RING_BEARER_REACH)
    end if
    if bit = 2 then
      repeat for each index in GANDALFS
        put entryAt(w, index) into gandalf
        if gandalf is not nothing then
          if the state of gandalf <> 0 and near(standsAt(e), standsAt(gandalf), GANDALF_REACH) then return true
        end if
      end repeat
      return false
    end if
    if bit < 4 then return true
    put byte mod 16 into delay
    put byteOf(the day of the clock of w - (item (bit + 1) of the days of the warEvents of w otherwise 0)) into elapsed
    return elapsed >= delay and the quarterHour of the clock of w div QUARTER_HOURS_PER_HOUR = DAILY_CHECK_HOUR
  end triggerMet

  function trigger w, e
    if the strength of e <= 0 or the health of e <= 0 then return w
    put item (the route of e + 1) of the routes of w otherwise [] into route
    put item 1 of route into firstStop
    if firstStop is not nothing then
      put items 2..-1 of route into item (the route of e + 1) of the routes of w
      put the (firstStop as text) of placeAt into the destination of e
    end if
    if the allegiance of e = 1 then put 99 into the allegiance of e
    if the state of e = 0 then put 1 into the state of e
    put {kind: "none"} into the trigger of e
    put 0 into the triggerByte of e
    put e into item (the index of e + 1) of the roster of w
    return w
  end trigger

  function wakeEntry w, i
    put entryAt(w, i) into e
    if e is nothing then return w
    if the ticked of e is true and triggerMet(w, e) then return trigger(w, e)
    return w
  end wakeEntry

  -- After a step: the tripwires, the Ring at Barad-dûr and the combat search.
  function tripwires w, leader
    put the position of leader into p
    if p is nothing then return w
    if not tileAligned(p) then return w
    put the day of the clock of w into day
    if the allegiance of leader = 0 then
      if samePoint(p, ISEN_FORD) then
        put setWarEvent(w, 3, day) into w
        put setWarEvent(w, 5, day) into w
      end if
      return w
    end if
    if the x of p >= the x of MORDOR_APPROACHES and the y of p >= the y of MORDOR_APPROACHES then
      put setWarEvent(w, 7, day) into w
    end if
    return w
  end tripwires

  function ringAtBaradDur leader
    if the allegiance of leader = 0 and RING is in the objects of leader and the position of leader is not nothing then
      if samePoint(the position of leader, BARAD_DUR) then return true
    end if
    return false
  end ringAtBaradDur

  function afterStep w, i
    put tripwires(w, entryAt(w, i)) into w
    if ringAtBaradDur(entryAt(w, i)) then
      put "lost-barad-dur" into the ending of w
      return {stopped: true, world: w}
    end if
    put findMatch(w, i) into found
    put the world of found into w
    put the match of found into met
    if met is nothing then return {stopped: false, world: w}
    if the passing of met is not nothing then
      put the passing of met after the passings of w
      return {stopped: false, world: w}
    end if
    if the fight of met is not nothing then
      return {stopped: true, world: startFight(w, the fight of met)}
    end if
    return {stopped: true, world: startMeeting(w, the meeting of met)}
  end afterStep

  -- Encounters (encounters.ts).
  function meetsEncounter w, mover, figure
    put the encounter of figure into encounter
    put the position of mover into position
    if encounter is nothing or position is nothing then return false
    if (the strength of figure <= SMALL_STRENGTH) <> (the index of mover <= LAST_FELLOWSHIP_ENTRY) then return false
    put the area of encounter into area
    if the x of position < the left of area or the x of position > the right of area then return false
    if the y of position < the top of area or the y of position > the bottom of area then return false
    if the day of the clock of w < the earliestDay of encounter then return false
    put 100 into chance
    if the watching of w is nothing then put 50 into chance
    if draw(chance) > the chance of encounter then return false
    if the fighting of figure > 1 then return true
    put terrainAt(position) into terrain
    if terrain = 100 then return true
    if terrain >= 80 then return draw(2) <> 0
    return false
  end meetsEncounter

  function passesUnseen w, moverIndex, figure
    if the allegiance of figure > 1 then return false
    if the figure of figure = SCOUTS_FIGURE and the strength of figure > 1 then return false
    return the watching of w <> moverIndex
  end passesUnseen

  function spendAdvisor w, index
    put entryAt(w, index) into advisor
    put the encounter of advisor into encounter
    if encounter is nothing then return w
    if the chance of encounter = MET_ONCE_CHANCE then put 0 into the chance of encounter
    if the chance of encounter = RETURNS_CHANCE then
      put byteOf(the day of the clock of w + draw(6) + 10) into the earliestDay of encounter
    end if
    put encounter into the encounter of advisor
    put advisor into item (index + 1) of the roster of w
    return w
  end spendAdvisor

  -- Meetings (meetings.ts).
  function meetingBetween mover, other
    put mover into a
    put other into b
    if the allegiance of other > MOBILISED_ABOVE then
      if the allegiance of mover <= MOBILISED_ABOVE or the index of other > the index of mover then
        put other into a
        put mover into b
      end if
    end if
    if the allegiance of a <= MOBILISED_ABOVE then return nothing
    put "plain" into kind
    if the allegiance of b > MOBILISED_ABOVE then
      put "follow" into kind
    else if the allegiance of b = ADVISOR then
      put "talk" into kind
    end if
    return {a: the index of a, b: the index of b, kind: kind}
  end meetingBetween

  function setStates w, meeting, state
    repeat for each index in [the a of meeting, the b of meeting]
      if not isEncounter(index) then
        put state into the state of item (index + 1) of the roster of w
      end if
    end repeat
    return w
  end setStates

  function startMeeting w, meeting
    put meeting into the meeting of w
    if the kind of meeting = "follow" or isEncounter(the b of meeting) then
      return setStates(w, meeting, 2)
    end if
    return w
  end startMeeting

  -- Combat (combat.ts): the search and the rows of the fights it starts.
  function evasionChance w, leader
    put 0 into total
    put 0 into count
    put false into hasUnit
    repeat for each e in the roster of w
      if the index of e < 1 or the index of e > LAST_GOOD_ENTRY or the state of e = 0 then next repeat
      if the index of topLeader(w, e) <> leader then next repeat
      add 1 to count
      add (the b29 of the unknown of e otherwise 0) to total
      if ELVEN_CLOAK is in the objects of e then add 20 to total
      if the startingStrength of e > 99 then
        put 99 into count
        put true into hasUnit
      end if
    end repeat
    return {chance: total div max(count, 1), hasUnit: hasUnit}
  end evasionChance

  function evades w, good, evil, spot, chance
    if draw(100) >= chance then return false
    if the startingStrength of good <> 1 then return false
    repeat for each point in NO_EVASION_AT
      if samePoint(point, spot) then return false
    end repeat
    if the index of evil = SHELOB then return false
    return not (the index of evil >= FIRST_BALROG and the index of evil <= LAST_BALROG)
  end evades

  -- Adds an entry to the rows: {rows, started}.
  function addEntry w, rows, e, rowSide, follower
    if follower or rowSide = "evil" then
      repeat for each n in 1..(the length of rows)
        put item n of rows into row
        if the side of row = rowSide and the name of entryAt(w, item 1 of the entries of row) = the name of e then
          put the index of e after the entries of row
          add the strength of e to the strength of row
          add the strength of e to the startStrength of row
          put row into item n of rows
          return {rows: rows, started: false}
        end if
      end repeat
    end if
    put {entries: [the index of e], follower: follower, option: "engage", side: rowSide, startStrength: the strength of e, strength: the strength of e} after rows
    return {rows: rows, started: true}
  end addEntry

  function addFollowers w, rows, leader, dropLoneCharacters
    repeat for each i in 1..min(LAST_GOOD_ENTRY, the length of the roster of w - 1)
      put entryAt(w, i) into e
      if the leader of e = leader and the state of e <> 0 and the strength of e > 0 then
        put addEntry(w, rows, e, "good", true) into added
        put the rows of added into rows
        put the length of rows into count
        put addFollowers(w, rows, i, dropLoneCharacters) into rows
        if dropLoneCharacters and the started of added and the length of rows = count and the startingStrength of e = 1 then
          delete item -1 of rows
        end if
      end if
    end repeat
    return rows
  end addFollowers

  function listGood w, position, dropLoneCharacters
    put [] into rows
    repeat for each i in 1..min(LAST_GOOD_ENTRY, the length of the roster of w - 1)
      put entryAt(w, i) into e
      if the state of e <> 0 and the leader of e is nothing and the strength of e > 0 and the position of e is not nothing then
        if near(the position of e, position, ROW_DISTANCE) then
          put the rows of addEntry(w, rows, e, "good", false) into rows
          put addFollowers(w, rows, i, dropLoneCharacters) into rows
        end if
      end if
    end repeat
    return rows
  end listGood

  function capRows rows, cap
    if the length of rows > cap then return items 1..cap of rows
    return rows
  end capRows

  -- The rows of a fight on the Campaign Level against enemy.
  function combatRows w, position, enemy
    put MAX_ROWS_PER_SIDE into cap
    if the figure of entryAt(w, enemy) = BALROG_FIGURE then put 7 into cap
    put listGood(w, position, false) into rows
    if the length of rows > cap and cap = MAX_ROWS_PER_SIDE then
      put listGood(w, position, true) into rows
    end if
    put capRows(rows, cap) into rows
    put 0 into evilRows
    repeat for each i in (LAST_GOOD_ENTRY + 1)..LAST_EVIL_ENTRY
      if evilRows > cap then exit repeat
      put entryAt(w, i) into e
      if e is nothing then next repeat
      if enemy = SHELOB and i <> SHELOB then next repeat
      if the state of e = 0 or the leader of e is not nothing or the strength of e <= 0 or the position of e is nothing then next repeat
      if not near(the position of e, position, ROW_DISTANCE) then next repeat
      put addEntry(w, rows, e, "evil", false) into added
      put the rows of added into rows
      if the started of added then add 1 to evilRows
    end repeat
    return rows
  end combatRows

  function fightBetween w, good, evil
    put combatRows(w, the position of good, the index of evil) into rows
    if isEncounter(the index of evil) then
      put every item of rows whose side is "good" into rows
      put the rows of addEntry(w, rows, evil, "evil", false) into rows
    end if
    return {events: [], evil: the index of evil, good: the index of good, position: the position of good, round: 0, rows: rows, winner: nothing}
  end fightBetween

  function startFight w, fight
    put fight into the fight of w
    repeat for each index in [the good of fight, the evil of fight]
      if not isEncounter(index) then
        put 2 into the state of item (index + 1) of the roster of w
      end if
    end repeat
    return w
  end startFight

  -- What a step meets: {world, match}.
  function findMatch w, moverIndex
    put entryAt(w, moverIndex) into mover
    if mover is nothing then return {world: w, match: nothing}
    if the position of mover is nothing then return {world: w, match: nothing}
    put tileAligned(the position of mover) into aligned
    if not aligned and the watching of w is nothing then return {world: w, match: nothing}
    put FIRST_ENCOUNTER into firstEntry
    if aligned then put 1 into firstEntry
    put LAST_ENCOUNTER into lastEntry
    if the allegiance of mover = 0 then put LAST_GOOD_ENTRY into lastEntry
    repeat for each i in firstEntry..min(lastEntry, the length of the roster of w - 1)
      if i = moverIndex then next repeat
      put entryAt(w, i) into other
      if isEncounter(i) then
        if not meetsEncounter(w, mover, other) then next repeat
      else
        if the state of other <> 1 and the state of other <> 3 then next repeat
        if the leader of other is not nothing or the position of other is nothing then next repeat
        if not near(the position of other, the position of mover, MEETING_DISTANCE) then next repeat
      end if
      if (the allegiance of mover = 0) = (the allegiance of other = 0) then
        if not isEncounter(i) then
          put meetingBetween(mover, other) into meeting
          if meeting is not nothing then return {world: w, match: {meeting: meeting}}
          next repeat
        end if
        if the allegiance of mover <= MOBILISED_ABOVE then next repeat
        if passesUnseen(w, moverIndex, other) then next repeat
        if the allegiance of other <> ADVISOR then
          if the watching of w is not nothing and the watching of w <> moverIndex then
            return {world: w, match: nothing}
          end if
          return {world: w, match: {passing: {a: moverIndex, b: i}}}
        end if
        put spendAdvisor(w, i) into w
        return {world: w, match: {meeting: {a: moverIndex, b: i, kind: "talk"}}}
      end if
      if the allegiance of mover = 0 then
        put other into good
        put mover into evil
      else
        put mover into good
        put other into evil
      end if
      put evasionChance(w, the index of good) into evasion
      if isEncounter(the index of evil) and the hasUnit of evasion and the startingStrength of evil < 99 then next repeat
      if evades(w, good, evil, the position of mover, the chance of evasion) then
        return {world: w, match: nothing}
      end if
      return {world: w, match: {fight: fightBetween(w, good, evil)}}
    end repeat
    return {world: w, match: nothing}
  end findMatch
`;
