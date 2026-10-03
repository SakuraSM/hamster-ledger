import type { BillRecord, Source } from "@hamster-ledger/core";
import type { Field, FieldMap } from "./fields.js";
export const MAX_FILE_ROWS = 15000;
export interface StatementFile {
  name: string;
  hash: string;
  rows: string[][];
  headerIndex: number;
  mapping: FieldMap;
  source: Source;
  account: string;
  reviewFields?: Field[];
  mappingConfirmed?: boolean;
}
export interface ParseResult {
  records: BillRecord[];
  errors: string[];
}
