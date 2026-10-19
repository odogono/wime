# Behavioural fidelity, with a headless deterministic simulation

"Faithful" means the same rules, numbers, speeds and AI decisions. It does not mean bit-exact: we don't reproduce the original RNG or update order, because that would require transliterating the main loop (see ADR-0001). If a subsystem later turns out to feel wrong, that subsystem alone can be made exact.

The game logic is a pure simulation with no DOM. It advances by a fixed tick, uses a seeded RNG and keeps all of its state serialisable. The three Levels and the Game Speed setting live entirely in the view layer on top of it. This lets reference scenarios observed in the original run as headless tests. It also keeps any later remake changes confined to the view layer.
