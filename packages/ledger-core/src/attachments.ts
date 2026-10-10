import { z } from "zod";
import { ledgerSchema, type Ledger } from "./model.js";
import { migrateLedger } from "./migration.js";
export const attachmentSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().max(180),
  mime: z.enum(["image/png", "image/jpeg", "image/gif", "image/webp"]),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  base64: z
    .string()
    .max(11184812)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  createdAt: z.number().int().nonnegative(),
});
export type Attachment = z.infer<typeof attachmentSchema>;
export interface AttachmentStore {
  list(bookId: string): Promise<Array<Omit<Attachment, "base64">>>;
  get(bookId: string, id: string): Promise<Attachment>;
  put(bookId: string, attachment: Attachment): Promise<void>;
  remove(bookId: string, id: string): Promise<void>;
}
export function attachmentReferences(ledger: Ledger): string[] {
  return [
    ...new Set([
      ...ledger.records.flatMap((record) => record.detail?.attachmentIds ?? []),
      ...(ledger.aiDrafts ?? [])
        .filter((draft) => draft.state === "pending")
        .flatMap((draft) => draft.attachmentIds),
    ]),
  ];
}
const archiveSchema = z.object({
  format: z.literal("hamster-ledger-archive"),
  version: z.literal(1),
  ledger: ledgerSchema,
  attachments: z.array(attachmentSchema).max(1000),
});
export function createArchive(
  ledger: Ledger,
  attachments: Attachment[],
): string {
  const archive = archiveSchema.parse({
    format: "hamster-ledger-archive",
    version: 1,
    ledger,
    attachments,
  });
  const ids = new Set(archive.attachments.map((item) => item.id));
  if (
    ids.size !== attachments.length ||
    attachmentReferences(ledger).some((id) => !ids.has(id))
  )
    throw new Error("附件缺失或重复，无法生成完整备份。");
  const serialized = JSON.stringify(archive);
  if (serialized.length > 160 * 1024 * 1024)
    throw new Error("归档超过 160 MiB。");
  return serialized;
}
export function parseArchive(serialized: string): {
  ledger: Ledger;
  attachments: Attachment[];
} {
  if (serialized.length > 160 * 1024 * 1024)
    throw new Error("归档超过 160 MiB。");
  const raw: unknown = JSON.parse(serialized);
  if (
    raw &&
    typeof raw === "object" &&
    "format" in raw &&
    raw.format === "hamster-ledger-archive"
  ) {
    const archive = archiveSchema.parse(raw);
    createArchive(archive.ledger, archive.attachments);
    return {
      ledger: migrateLedger(archive.ledger),
      attachments: archive.attachments,
    };
  }
  return { ledger: migrateLedger(ledgerSchema.parse(raw)), attachments: [] };
}
