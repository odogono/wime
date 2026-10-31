import { talk } from '@northtalk/ts';

// Crossing movement's choice of a Crossing (ADR-0008), as a Scenario
// Script: a port of crossing-movement.ts and the parts of waterways.ts it
// reads. The geometry runs on NorthTalk's exact decimals, not doubles, so
// near-ties may fall the other way; the differential test measures how
// often (#194). Reads the script variable waterways that sweep.ts loads.
export const CROSSING = talk`
  function boxOf points
    put item 1 of points into p
    put {left: the x of p, right: the x of p, top: the y of p, bottom: the y of p} into box
    repeat for each p in points
      put min(the left of box, the x of p) into the left of box
      put max(the right of box, the x of p) into the right of box
      put min(the top of box, the y of p) into the top of box
      put max(the bottom of box, the y of p) into the bottom of box
    end repeat
    return box
  end boxOf

  -- Whether two boxes overlap or touch: a line can only meet or come
  -- within reach of a river inside its box.
  function boxesMeet a, b
    return the left of a <= the right of b and the left of b <= the right of a and the top of a <= the bottom of b and the top of b <= the bottom of a
  end boxesMeet

  function squareBox p, reach
    return {left: the x of p - reach, right: the x of p + reach, top: the y of p - reach, bottom: the y of p + reach}
  end squareBox

  function hypot dx, dy
    return sqrt(dx * dx + dy * dy)
  end hypot

  function turnSide p, q, r
    return sign((the x of q - the x of p) * (the y of r - the y of p) - (the y of q - the y of p) * (the x of r - the x of p))
  end turnSide

  function within p, q, r
    return min(the x of p, the x of q) <= the x of r and the x of r <= max(the x of p, the x of q) and min(the y of p, the y of q) <= the y of r and the y of r <= max(the y of p, the y of q)
  end within

  function segmentsMeet a, b, c, d
    put turnSide(c, d, a) into d1
    put turnSide(c, d, b) into d2
    put turnSide(a, b, c) into d3
    put turnSide(a, b, d) into d4
    if d1 * d2 < 0 and d3 * d4 < 0 then return true
    if d1 = 0 and within(c, d, a) then return true
    if d2 = 0 and within(c, d, b) then return true
    if d3 = 0 and within(a, b, c) then return true
    return d4 = 0 and within(a, b, d)
  end segmentsMeet

  function along p, a, rx, ry, length2
    return min(1, max(0, ((the x of p - the x of a) * rx + (the y of p - the y of a) * ry) / length2))
  end along

  function meetsAt a, b, c, d
    if not segmentsMeet(a, b, c, d) then return nothing
    put the x of b - the x of a into rx
    put the y of b - the y of a into ry
    put the x of d - the x of c into sx
    put the y of d - the y of c into sy
    put rx * sy - ry * sx into cross
    put rx * rx + ry * ry into length2
    if cross <> 0 then
      return ((the x of c - the x of a) * sy - (the y of c - the y of a) * sx) / cross
    end if
    if length2 = 0 then return 0
    return min(along(c, a, rx, ry, length2), along(d, a, rx, ry, length2))
  end meetsAt

  function firstRiverMet a, b, skip
    put nothing into firstRiver
    put nothing into firstAt
    put boxOf([a, b]) into wayBox
    put the rivers of waterways into rivers
    repeat for each index in 0..(the length of rivers - 1)
      if index is in skip then next repeat
      if not boxesMeet(wayBox, item (index + 1) of riverBoxes) then next repeat
      put item (index + 1) of rivers into river
      repeat for each i in 2..(the length of river)
        put meetsAt(a, b, item (i - 1) of river, item i of river) into at
        if at is not nothing then
          if firstAt is nothing or at < firstAt then
            put index into firstRiver
            put at into firstAt
          end if
        end if
      end repeat
    end repeat
    return firstRiver
  end firstRiverMet

  function distanceToSegment p, a, b
    put the x of b - the x of a into rx
    put the y of b - the y of a into ry
    put rx * rx + ry * ry into length2
    put 0 into t
    if length2 <> 0 then put along(p, a, rx, ry, length2) into t
    return hypot(the x of p - (the x of a + t * rx), the y of p - (the y of a + t * ry))
  end distanceToSegment

  -- Liang-Barsky: clips segment ab to the square of side 2 * reach round p.
  function clipsSquare a, b, p, reach
    put 0 into t0
    put 1 into t1
    put the x of b - the x of a into dx
    put the y of b - the y of a into dy
    repeat for each pair in [[0 - dx, the x of a - (the x of p - reach)], [dx, the x of p + reach - the x of a], [0 - dy, the y of a - (the y of p - reach)], [dy, the y of p + reach - the y of a]]
      let [step, room] be pair
      if step = 0 then
        if room < 0 then return false
      else
        put room / step into t
        if step < 0 then
          put max(t0, t) into t0
        else
          put min(t1, t) into t1
        end if
        if t0 > t1 then return false
      end if
    end repeat
    return true
  end clipsSquare

  function riverWithinSquare river, p, reach
    repeat for each i in 2..(the length of river)
      if clipsSquare(item (i - 1) of river, item i of river, p, reach) then return true
    end repeat
    return false
  end riverWithinSquare

  function chooseCrossing origin, destination, riversCrossed
    put {destination: destination, rivers: [], riversCrossed: riversCrossed, waypoint: nothing} into leg
    put firstRiverMet(origin, destination, riversCrossed) into river
    if river is nothing then return leg
    put item (river + 1) of the rivers of waterways into riverLine
    put hypot(the x of destination - the x of origin, the y of destination - the y of origin) into direct
    put nothing into best
    put nothing into bestWay
    repeat for each crossing in the crossings of waterways
      if not boxesMeet(squareBox(crossing, TILE), item (river + 1) of riverBoxes) then next repeat
      if not riverWithinSquare(riverLine, crossing, TILE) then next repeat
      put hypot(the x of crossing - the x of origin, the y of crossing - the y of origin) + hypot(the x of destination - the x of crossing, the y of destination - the y of crossing) into way
      put way <= CROSSING_DETOUR_RATIO * direct into inReach
      if not inReach then put distanceToSegment(crossing, origin, destination) <= CROSSING_NEAR_LINE into inReach
      if inReach and (bestWay is nothing or way < bestWay) then
        put crossing into best
        put way into bestWay
      end if
    end repeat
    if best is nothing then return leg
    put [] into rivers
    put the rivers of waterways into all
    repeat for each index in 0..(the length of all - 1)
      if not boxesMeet(squareBox(best, TILE), item (index + 1) of riverBoxes) then next repeat
      if riverWithinSquare(item (index + 1) of all, best, TILE) then put index after rivers
    end repeat
    put rivers into the rivers of leg
    put {x: floor(the x of best / TILE) * TILE, y: floor(the y of best / TILE) * TILE} into the waypoint of leg
    return leg
  end chooseCrossing
`;
