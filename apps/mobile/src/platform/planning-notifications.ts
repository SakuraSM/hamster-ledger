import * as Notifications from "expo-notifications";
import type { LedgerNotification } from "@hamster-ledger/core";
import { nativeStore } from "./storage";
const CHANNEL_ID = "ledger-planning";
/** Called after a local planning pass or network refresh; never requests permission in the background. */
async function deliver(
  bookId: string,
  notices: LedgerNotification[],
): Promise<void> {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "账本计划提醒",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  const key = `hamster.native.notices.${bookId}`;
  const saved = await nativeStore.getItem(key);
  const delivered = new Set<string>(saved ? JSON.parse(saved) : []);
  for (const notice of notices) {
    if (notice.isRead || delivered.has(notice.id)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${bookId}:${notice.id}`,
      content: {
        title: notice.title,
        body: notice.body,
        sound: false,
        data: { bookId, noticeId: notice.id },
      },
      trigger: { channelId: CHANNEL_ID },
    });
    delivered.add(notice.id);
    await nativeStore.setItem(key, JSON.stringify([...delivered]));
  }
}

let deliveryQueue: Promise<void> = Promise.resolve();
export function deliverPlanningNotifications(
  bookId: string,
  notices: LedgerNotification[],
): Promise<void> {
  const delivery = deliveryQueue.then(() => deliver(bookId, notices));
  deliveryQueue = delivery.catch(() => undefined);
  return delivery;
}
