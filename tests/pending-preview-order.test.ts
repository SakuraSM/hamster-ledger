import { expect, it } from "vitest";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { pendingPreviewRecord } from "@hamster-ledger/core";

it("previews the first review group even when records have a different order", () => {
  const ledger = createDemoLedger();
  const reviews = ledger.reviews
    .filter((review) => review.state === "pending")
    .slice(0, 2);
  expect(reviews).toHaveLength(2);
  const first = reviews[0]!;
  const ids = new Set(
    reviews.flatMap((review) => [review.leftId, review.rightId]),
  );
  const records = ledger.records
    .filter((record) => ids.has(record.id))
    .reverse();
  const expected = [first.leftId, first.rightId]
    .map((id) => records.find((record) => record.id === id))
    .find((record) => record?.status === "pending");
  expect(expected).toBeDefined();
  expect(pendingPreviewRecord({ ...ledger, reviews, records })?.id).toBe(
    expected?.id,
  );
});
