# Geography patches

Hand corrections to the traced vector geography (ADR-0006). `bun tools/build-geography.ts` traces the map from the exported tiles, applies every `*.geojson` here in name order, then validates and compiles the result.

Each file is a GeoJSON FeatureCollection in map pixels, with y pointing down. Every feature names the traced feature it changes in `properties.id` and says what to do in `properties.op`:

- `replace` (the default): swap in this feature's geometry; properties given here override the traced ones
- `add`: a new feature, with an id not already traced
- `delete`: drop the traced feature

Patches never edit individual points, so they survive changes to the tracer as long as feature ids stay stable. A patch that leaves Terrain Regions overlapping or with gaps fails the build.
