import {
  applyPlanning,
  dueExchangeRequests,
  ledgerPatch,
  migrateLedger,
} from "@hamster-ledger/core";
import { fetchExchangeRate } from "./exchange-api.mjs";
import { applyOperation } from "./network-service.mjs";
export function schedulerDate(timestamp, timeZone = "Asia/Shanghai") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}
export async function runScheduledBook({
  database,
  bookId,
  now = Date.now,
  timeZone = "Asia/Shanghai",
  fetcher = fetch,
  isStopped = () => false,
}) {
  const book = database
    .prepare(
      "SELECT b.*,m.user_id AS owner FROM books b JOIN book_members m ON b.id=m.book_id AND m.role='owner' WHERE b.id=? AND b.authority='server'",
    )
    .get(bookId);
  if (!book) return { changed: false };
  const today = schedulerDate(now(), timeZone),
    ledger = migrateLedger(JSON.parse(book.ledger)),
    requests = dueExchangeRequests(ledger, today),
    rates = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, requests.length) }, async () => {
      while (cursor < requests.length && !isStopped()) {
        const request = requests[cursor++];
        try {
          const quote = await fetchExchangeRate({
            database,
            ...request,
            fetcher,
          });
          if (!quote.needsConfirmation)
            rates.push({ ...quote, requestedDate: request.date });
        } catch {
          /* Leave the occurrence pending and create an actionable notice. */
        }
      }
    }),
  );
  if (isStopped()) return { changed: false };
  const next = applyPlanning({ ledger, today, rates }),
    patch = ledgerPatch(ledger, next);
  if (
    !patch.changes.length &&
    !patch.rules &&
    !patch.preferences &&
    !patch.files
  )
    return { changed: false };
  try {
    const result = applyOperation({
      database,
      bookId,
      userId: book.owner,
      source: "scheduler",
      now,
      body: {
        key: `scheduler:${bookId}:${book.revision}:${today}`,
        revision: book.revision,
        patch,
      },
    });
    return { changed: true, revision: result.revision };
  } catch (error) {
    if (error.status === 409) return { changed: false, conflict: true };
    throw error;
  }
}
export function startScheduler({
  database,
  now = Date.now,
  timeZone = "Asia/Shanghai",
  intervalMs = 60000,
  fetcher = fetch,
}) {
  schedulerDate(now(), timeZone);
  let stopped = false,
    running = false;
  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const books = database
        .prepare("SELECT id FROM books WHERE authority='server'")
        .all();
      for (const book of books) {
        if (stopped) break;
        try {
          await runScheduledBook({
            database,
            bookId: book.id,
            now,
            timeZone,
            fetcher,
            isStopped: () => stopped,
          });
        } catch (error) {
          console.error(
            "Scheduled ledger update failed",
            book.id,
            error instanceof Error ? error.message : "unknown error",
          );
        }
      }
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
