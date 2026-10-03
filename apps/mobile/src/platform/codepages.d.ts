declare module "xlsx/dist/cpexcel.full.mjs" {
  export const utils: {
    decode: (codepage: number, bytes: Uint8Array) => string;
  };
}
