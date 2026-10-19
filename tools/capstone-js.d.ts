// The package ships no types; this covers the subset tools/disasm.ts uses.
declare module '@alexaltea/capstone-js' {
  export type Instruction = {
    address: bigint | number;
    bytes: number[];
    mnemonic: string;
    op_str: string;
    size: number;
  };
  export class Capstone {
    constructor(arch: number, mode: number);
    close(): void;
    disasm(buffer: number[], offset: number): Instruction[];
  }
  type Module = {
    ARCH_M68K: number;
    Capstone: typeof Capstone;
    MODE_BIG_ENDIAN: number;
    MODE_M68K_000: number;
  };
  const MCapstone: () => Promise<Module>;
  export default MCapstone;
}
