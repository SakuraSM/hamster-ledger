package expo.modules.paymentinbox

import android.app.Notification
import android.os.Process
import android.os.Handler
import android.os.Looper
import java.lang.ref.WeakReference
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.util.concurrent.Executors
import org.json.JSONObject

class PaymentNotificationListener : NotificationListenerService() {
  private val executor = Executors.newSingleThreadExecutor()
  override fun onListenerConnected() {
    PaymentInboxEvents.service = WeakReference(this)
    PaymentInboxEvents.connected = true
    try { activeNotifications?.forEach { onNotificationPosted(it) } } catch (_: SecurityException) { PaymentInboxEvents.connected = false }
    PaymentInboxEvents.notifyChanged()
  }
  override fun onListenerDisconnected() {
    if (PaymentInboxEvents.service?.get() === this) PaymentInboxEvents.connected = false
    PaymentInboxEvents.notifyChanged()
  }
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null || sbn.user != Process.myUserHandle()) return
    val source = PaymentFilter.source(sbn.packageName) ?: return
    if (executor.isShutdown) return
    executor.execute {
      val store = InboxStore.get(this)
      try {
        val config = store.config()
        if (!PaymentInboxModule.hasAccess(this) || !config.optBoolean("enabled")) { if (!config.optBoolean("enabled")) pause(); return@execute }
        val selected = config.getJSONArray("sources")
        if (!(0 until selected.length()).any { selected.getString(it) == source.label }) return@execute
        val notification = sbn.notification
        val extras = notification.extras
        val title = listOf(extras.getCharSequence(Notification.EXTRA_TITLE), extras.getCharSequence(Notification.EXTRA_SUB_TEXT), extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)).filterNotNull().joinToString(" · ")
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT) ?: extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString("\n") ?: "").toString()
        if (!PaymentFilter.accepts(PaymentNotificationText(source, title, text, notification.flags and Notification.FLAG_GROUP_SUMMARY != 0))) return@execute
        val content = listOf(sbn.packageName, sbn.key, sbn.postTime.toString(), title, text).joinToString("\u0000")
        val receipt = JSONObject().put("id", store.eventId(content)).put("source", source.label).put("title", title.take(300)).put("text", text.take(InboxStore.MAX_TEXT)).put("isTruncated", text.length > InboxStore.MAX_TEXT).put("postedAt", sbn.postTime).put("capturedAt", System.currentTimeMillis())
        store.capture(receipt)
        PaymentInboxEvents.notifyChanged()
      } catch (_: Exception) { store.errorState("capture_failed"); PaymentInboxEvents.notifyChanged() }
    }
  }

  fun pause() { Handler(Looper.getMainLooper()).post { requestUnbind() } }
  override fun onDestroy() {
    if (PaymentInboxEvents.service?.get() === this) { PaymentInboxEvents.service = null; PaymentInboxEvents.connected = false }
    executor.shutdown()
    super.onDestroy()
  }
}
