import { talk } from '@northtalk/ts';

// The view's Queries of a Force's Way, as a Scenario Script: a port of
// wayOf and orderedWay (movement.ts), which share the Crossing choice
// with the sweep (#194). Read-only: they return a Way and change nothing.
export const QUERIES = talk`
  -- The Crossing a leg heads for first, as waypointFor does.
  function waypointFor w, leaderIndex, origin, destination
    if the movementRule of w is not "crossing" or waterways is nothing then return nothing
    put the (leaderIndex as text) of the crossingLegs of w into leg
    if leg is not nothing then
      if samePoint(the destination of leg, destination) then return the waypoint of leg
    end if
    return the waypoint of chooseCrossing(origin, destination, [])
  end waypointFor

  on wayOf w, index
    put entryAt(w, index) into e
    if e is nothing then return nothing
    put topLeader(w, e) into leader
    put the destination of leader into destination
    put the position of leader into position
    if destination is nothing or position is nothing then return nothing
    if the x of destination = 0 or samePoint(position, destination) then return nothing
    return {destination: destination, from: position, waypoint: waypointFor(w, the index of leader, position, destination)}
  end wayOf

  on orderedWay w, memberIndex, click
    put entryAt(w, memberIndex) into e
    if e is nothing then return nothing
    put the position of topLeader(w, e) into position
    put {x: floor(the x of click / TILE) * TILE, y: floor(the y of click / TILE) * TILE} into destination
    if position is nothing then return nothing
    if samePoint(position, destination) then return nothing
    return {destination: destination, from: position, waypoint: waypointFor(w, memberIndex, position, destination)}
  end orderedWay
`;
