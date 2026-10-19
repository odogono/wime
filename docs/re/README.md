# Reverse engineering notes

Working notes on the Reference Build's executable, `WarInMiddleEarth` on Disk 1 of `artifacts/amiga/WarInMiddleEarth_v1.0_0968.lha`. These notes record layouts and addresses for the next person at the disassembler. What they show about how the game worked is recorded as Findings in [`docs/findings/`](../findings/README.md). Specs cite the Findings, not these notes.

- [`starting-state-tables.md`](starting-state-tables.md): the data hunk tables that hold the starting state, field by field.
- [`labels.md`](labels.md): named addresses in the code and data hunks.

## Addresses

The executable is an AmigaDOS load file with three hunks (finding:executable-small-data-model):

| Hunk | Type | Size in memory | Initialised | File offset of contents |
| ---- | ---- | -------------- | ----------- | ----------------------- |
| 0    | code | 0x1c014        | all         | 0x00028                 |
| 1    | data | 0x5a04         | 0x4f24      | 0x1c144                 |
| 2    | BSS  | 0x4            | none        | none                    |

An address is an offset into one hunk, written `code+0x0e420` or `data+0x1de8`, and a Finding cites it as `disasm:code+0x0e420`. Code offsets have five hex digits and data offsets four. To find a code address in a disassembler that loads the file at some base, add that base plus 0x28 for the file offset, or load the hunk's contents on their own at 0.

The code uses the Aztec C small-data model: register A4 holds the data hunk's address plus 0x7ffe for the whole run. An operand `d(a4)` therefore means `data+(0x7ffe + d)`. For example, `lea -$6216(a4),a0` is `data+0x1de8`, and `jsr -$7dac(a4)` calls through the jump table entry at `data+0x0252`. String literals live in the code hunk, and the data hunk's tables point to them through relocated longwords.

## Reproducing

[`tools/extract-starting-state.ts`](../../tools/extract-starting-state.ts) parses the hunks (`parseHunkFile`) and reads every table below. For disassembly, any 68000 disassembler will do. The analysis for issue #5 used Capstone over the code hunk's contents, rewriting each `d(a4)` operand to its data offset so that table accesses could be searched for by address. Keep any such output in a gitignored directory. Never commit anything extracted from `artifacts/`.
