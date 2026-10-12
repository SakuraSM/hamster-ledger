import { createHash } from "node:crypto";
const canonical = (value) =>
  Buffer.isBuffer(value) || value instanceof Uint8Array
    ? { bytes: Buffer.from(value).toString("base64") }
    : Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])]),
          )
        : value;
export function checksum({ rows, jsonColumns, timestampColumns = new Set() }) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        rows.map((row) =>
          canonical(
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [
                key,
                jsonColumns.has(key) && typeof value === "string"
                  ? JSON.parse(value)
                  : timestampColumns.has(key) && value != null
                    ? new Date(value).toISOString()
                    : value,
              ]),
            ),
          ),
        ),
      ),
    )
    .digest("hex");
}
