---
kind: fact
topic: map
confidence: provisional
sources:
  - tool:tools/render_campaign_map.py#render_campaign_outputs
  - manual:pdf-p9
---
**The Campaign Level probably shows 20 by 12 tiles (320 by 192 pixels) at a time, so one tile covers about 12.5 miles.**
The map tool assumes a 320 by 192 pixel view, which gives scroll limits of 2,240 and 1,392 pixels on the 2,560 by 1,584 pixel map. The manual says the view covers about 250 by 150 miles, and 250 ÷ 20 and 150 ÷ 12 both come to 12.5 miles per tile. That agreement supports the assumption, but the view size has not been read from the executable. On that scale the whole grid would be about 2,000 by 1,240 miles.
