import * as Notifications from "expo-notifications";
import type { LedgerPreferences } from "@hamster-ledger/core";
const REMINDER_ID = "hamster-ledger-daily-reminder";
const CHANNEL_ID = "ledger-reminders";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
export async function configureReminder(
  preferences: LedgerPreferences,
): Promise<void> {
  if (!preferences.reminderEnabled) {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
    return;
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "每日记账提醒",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error("系统未授予通知权限。请在系统设置中开启后重试。");
  const [hour, minute] = preferences.reminderTime.split(":").map(Number);
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: "仓鼠记账",
      body: "今天的收支，花一分钟记下来。",
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
}
