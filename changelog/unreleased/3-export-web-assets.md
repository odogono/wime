---
type: feat
scope: tools
section: added
---

**The original game's graphics and text can now be exported for the web build.**
One command (`bun run export:web`) writes the Campaign Level tile atlas and
palette, the tile map, every decoded bitmap and the game's text as web-ready
PNG and JSON files, with a manifest listing each asset (#3).
