package expo.modules.paymentinbox

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.service.notification.NotificationListenerService
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors
import org.json.JSONObject
import java.lang.ref.WeakReference

object PaymentInboxEvents {
  @Volatile var connected = false
  @Volatile var service: WeakReference<PaymentNotificationListener>? = null
  private val listeners = CopyOnWriteArraySet<() -> Unit>()
  fun add(listener: () -> Unit) { listeners.add(listener) }
  fun remove(listener: () -> Unit) { listeners.remove(listener) }
  fun notifyChanged() { listeners.forEach { try { it() } catch (_: Exception) { /* Refresh is a hint; the encrypted queue is authoritative. */ } } }
}
class PaymentInboxModule : Module() {
  companion object {
    fun hasAccess(context: Context): Boolean {
      val component = ComponentName(context, PaymentNotificationListener::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) return context.getSystemService(NotificationManager::class.java).isNotificationListenerAccessGranted(component)
      return Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")?.split(':')?.any { ComponentName.unflattenFromString(it) == component } == true
    }
  }
  private val context: Context get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()
  private val lifecycleWorker = Executors.newSingleThreadExecutor()
  private val changed: () -> Unit = { sendEvent("onInboxChanged", emptyMap<String, Any>()) }
  override fun definition() = ModuleDefinition {
    Name("HamsterPaymentInbox")
    Events("onInboxChanged")
    OnStartObserving { PaymentInboxEvents.add(changed) }
    OnStopObserving { PaymentInboxEvents.remove(changed) }
    OnActivityEntersForeground {
      val application = appContext.reactContext?.applicationContext
      if (application != null && !lifecycleWorker.isShutdown) lifecycleWorker.execute {
        val store = InboxStore.get(application)
        try {
          if (store.config().optBoolean("enabled") && hasAccess(application) && !PaymentInboxEvents.connected) NotificationListenerService.requestRebind(ComponentName(application, PaymentNotificationListener::class.java))
        } catch (_: Exception) { store.errorState("capture_failed") }
      }
    }
    OnDestroy { PaymentInboxEvents.remove(changed); lifecycleWorker.shutdown() }
    AsyncFunction("getStatus") {
      val status = InboxStore.get(context).status()
      val granted = hasAccess(context)
      if (granted && status["enabled"] == true && !PaymentInboxEvents.connected) NotificationListenerService.requestRebind(ComponentName(context, PaymentNotificationListener::class.java))
      status + mapOf("permissionGranted" to granted, "connected" to PaymentInboxEvents.connected, "available" to true)
    }
    AsyncFunction("configure") { payload: String ->
      val config = JSONObject(payload)
      val enabled = config.getBoolean("enabled")
      val selected = config.getJSONArray("sources")
      val sources = (0 until selected.length()).map { selected.getString(it) }
      InboxStore.get(context).configure(InboxCaptureConfig(enabled, sources, config.getString("bookId")))
      if (!enabled) PaymentInboxEvents.service?.get()?.pause()
      if (enabled && hasAccess(context)) NotificationListenerService.requestRebind(ComponentName(context, PaymentNotificationListener::class.java))
      PaymentInboxEvents.notifyChanged()
    }
    AsyncFunction("listPending") { InboxStore.get(context).pending() }
    AsyncFunction("handle") { payload: String ->
      val request = JSONObject(payload)
      InboxStore.get(context).handled(HandledInboxReceipt(request.getString("id"), request.getString("state"), if (request.isNull("recordId")) null else request.getString("recordId")))
      PaymentInboxEvents.notifyChanged()
    }
    AsyncFunction("clear") {
      InboxStore.get(context).clear()
      PaymentInboxEvents.notifyChanged()
    }
    AsyncFunction("openSettings") {
      appContext.throwingActivity.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }.runOnQueue(Queues.MAIN)
  }
}
