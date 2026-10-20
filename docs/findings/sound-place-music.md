---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x01f0e
  - disasm:code+0x011d2
  - disasm:code+0x0b13e
issue: 131
---

**Entering the Animation Level on a Place with scenery of its own plays that Place's piece: Hob.Riven at Hobbiton, Tuckborough and Rivendell, Gandalf's theme at Bree, Michel Delving and the Grey Havens, Dwarfs at the dwarf and orc holds of the mountains and at Moria, Rohanians at Edoras and the Hornburg, MinasTirith at Minas Tirith, and the evil pieces in Mordor.**
The scenery builder's switch on the Place's tile byte (code+0x01f0e; finding:graphics-animation-level-place-scenery) also asks for a piece (finding:sound-score-and-effect-table). When the Animation Level starts (code+0x0b13e) it frees a piece that has finished and loads and plays the one asked for. All from Disk 2:

| Places                                                                                                        | Piece           |
| ------------------------------------------------------------------------------------------------------------- | --------------- |
| Hobbiton, Tuckborough, Rivendell, the tile of tile byte 30                                                    | Hob.Riven       |
| Michel Delving, Waymeet, Anfalas, Bree, the Grey Havens                                                       | Gandalf         |
| Buckland, Thranduil's Palace, Derndingle                                                                      | Aragorn         |
| Dale, Forlond, Ethring, Calembel, Linhir, Pelargir                                                            | Boromir         |
| Mount Gram, Mt. Gundabad, Goblin Town, Durthang, Annuminas, Belegost, Ost-in-Edhil, Hollin Gate, Dimrill Dale | Dwarfs          |
| Edoras, the Hornburg                                                                                          | Rohanians       |
| Dol Amroth                                                                                                    | Fortress        |
| Minas Tirith, the Rammas forts                                                                                | MinasTirith.B   |
| Lórien                                                                                                        | MagicMeditate   |
| Tom Bombadil's house                                                                                          | Frodo           |
| Weathertop, Deadman's Dike, Minas Morgul, Cirith Ungol, Carach Angren                                         | Beware          |
| Isengard                                                                                                      | Threatening     |
| Barad-dûr, Mount Doom, the Morannon, Dol Guldur                                                               | LongMajorEvil.B |

The White Towers and Erech have scenery but no piece. Every other place on the Animation Level is silent.
