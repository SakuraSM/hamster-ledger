package expo.modules.paymentinbox

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

data class InboxCaptureConfig(val enabled: Boolean, val sources: List<String>, val bookId: String)
data class HandledInboxReceipt(val id: String, val state: String, val recordId: String?)

private class InboxDatabase(context: Context) : SQLiteOpenHelper(context, File(context.noBackupFilesDir, "payment-inbox.db").path, null, 1) {
  override fun onCreate(database: SQLiteDatabase) {
    database.execSQL("CREATE TABLE inbox_config(name TEXT PRIMARY KEY,iv BLOB NOT NULL,payload BLOB NOT NULL)")
    database.execSQL("CREATE TABLE inbox_receipts(id TEXT PRIMARY KEY,posted_at INTEGER NOT NULL,state TEXT NOT NULL,iv BLOB NOT NULL,payload BLOB NOT NULL)")
    database.execSQL("CREATE INDEX inbox_receipts_time ON inbox_receipts(posted_at)")
  }
  override fun onUpgrade(database: SQLiteDatabase, oldVersion: Int, newVersion: Int) { error("支付消息存储需要更新版本，原数据已保留。") }
}
class InboxStore private constructor(context: Context) {
  companion object {
    const val PENDING = "pending"
    const val MAX_PENDING = 500
    const val MAX_TEXT = 4000
    const val RETENTION_MS = 7L * 24 * 60 * 60 * 1000
    private const val CONFIG = "config"
    @Volatile private var instance: InboxStore? = null
    fun get(context: Context): InboxStore = instance ?: synchronized(this) {
      instance ?: InboxStore(context.applicationContext).also { instance = it }
    }
  }
  private val helper = InboxDatabase(context)
  private val cipher = InboxCipher()
  private val health = context.getSharedPreferences("hamster-payment-health", Context.MODE_PRIVATE)
  private fun readConfig(): JSONObject {
    helper.readableDatabase.rawQuery("SELECT iv,payload FROM inbox_config WHERE name=?", arrayOf(CONFIG)).use { cursor ->
      if (!cursor.moveToFirst()) return JSONObject().put("enabled", false).put("sources", JSONArray()).put("bookId", "").put("acceptAfter", 0L)
      return cipher.open(CONFIG, SealedInboxValue(cursor.getBlob(0), cursor.getBlob(1)))
    }
  }
  private fun writeConfig(config: JSONObject) {
    val sealed = cipher.seal(CONFIG, config)
    helper.writableDatabase.insertWithOnConflict("inbox_config", null, ContentValues().apply {
      put("name", CONFIG); put("iv", sealed.iv); put("payload", sealed.bytes)
    }, SQLiteDatabase.CONFLICT_REPLACE)
  }
  private fun prune() {
    helper.writableDatabase.delete("inbox_receipts", "posted_at<?", arrayOf((System.currentTimeMillis() - RETENTION_MS).toString()))
  }
  private fun pendingCount(): Int = helper.readableDatabase.rawQuery("SELECT count(*) FROM inbox_receipts WHERE state=?", arrayOf(PENDING)).use { cursor -> cursor.moveToFirst(); cursor.getInt(0) }
  @Synchronized fun eventId(content: String): String = cipher.eventId(content)
  @Synchronized fun config(): JSONObject = readConfig()
  @Synchronized fun configure(config: InboxCaptureConfig) {
    val (enabled, sources, bookId) = config
    check(sources.all { label -> PaymentSource.entries.any { it.label == label } }) { "支付来源无效。" }
    check(!enabled || (sources.isNotEmpty() && (bookId == "personal" || bookId.startsWith("book:")))) { "请选择本机账本和支付来源。" }
    val previous = readConfig()
    val sorted = sources.distinct().sorted()
    val changed = previous.optString("bookId") != bookId || previous.optJSONArray("sources").toString() != JSONArray(sorted).toString()
    val acceptAfter = if (enabled && (!previous.optBoolean("enabled") || changed)) System.currentTimeMillis() else previous.optLong("acceptAfter")
    writeConfig(JSONObject().put("enabled", enabled).put("sources", JSONArray(sorted)).put("bookId", bookId).put("acceptAfter", acceptAfter))
    health.edit().remove("error").apply()
  }
  @Synchronized fun capture(receipt: JSONObject): Boolean {
    val config = readConfig()
    if (!config.optBoolean("enabled") || !((0 until config.getJSONArray("sources").length()).map { config.getJSONArray("sources").getString(it) }).contains(receipt.getString("source"))) return false
    val cutoff = maxOf(config.optLong("acceptAfter"), System.currentTimeMillis() - RETENTION_MS)
    if (receipt.getLong("postedAt") <= cutoff) return false
    val database = helper.writableDatabase
    database.beginTransaction()
    try {
      prune()
      database.rawQuery("SELECT 1 FROM inbox_receipts WHERE id=?", arrayOf(receipt.getString("id"))).use { if (it.moveToFirst()) return false }
      if (pendingCount() >= MAX_PENDING) { errorState("storage_full"); return false }
      receipt.put("bookId", config.getString("bookId"))
      val sealed = cipher.seal(receipt.getString("id"), receipt)
      database.insertOrThrow("inbox_receipts", null, ContentValues().apply {
        put("id", receipt.getString("id")); put("posted_at", receipt.getLong("postedAt")); put("state", PENDING); put("iv", sealed.iv); put("payload", sealed.bytes)
      })
      database.setTransactionSuccessful()
      return true
    } finally { database.endTransaction() }
  }
  @Synchronized fun pending(): List<Map<String, Any>> {
    prune()
    val receipts = mutableListOf<Map<String, Any>>()
    helper.readableDatabase.rawQuery("SELECT id,iv,payload FROM inbox_receipts WHERE state=? ORDER BY posted_at DESC,id", arrayOf(PENDING)).use { cursor ->
      while (cursor.moveToNext()) {
        val item = cipher.open(cursor.getString(0), SealedInboxValue(cursor.getBlob(1), cursor.getBlob(2)))
        receipts.add(mapOf("id" to item.getString("id"), "source" to item.getString("source"), "bookId" to item.getString("bookId"), "title" to item.getString("title"), "text" to item.getString("text"), "postedAt" to item.getLong("postedAt"), "capturedAt" to item.getLong("capturedAt"), "isTruncated" to item.optBoolean("isTruncated")))
      }
    }
    return receipts
  }
  @Synchronized fun handled(change: HandledInboxReceipt) {
    val (id, state, recordId) = change
    check(state in setOf("confirmed", "linked", "discarded")) { "支付消息状态无效。" }
    helper.readableDatabase.rawQuery("SELECT iv,payload FROM inbox_receipts WHERE id=? AND state=?", arrayOf(id, PENDING)).use { cursor ->
      if (!cursor.moveToFirst()) return
      cipher.open(id, SealedInboxValue(cursor.getBlob(0), cursor.getBlob(1)))
    }
    val sealed = cipher.seal(id, JSONObject().put("id", id).put("recordId", recordId ?: JSONObject.NULL))
    helper.writableDatabase.update("inbox_receipts", ContentValues().apply { put("state", state); put("iv", sealed.iv); put("payload", sealed.bytes) }, "id=? AND state=?", arrayOf(id, PENDING))
    if (pendingCount() < MAX_PENDING) health.edit().remove("error").apply()
  }
  @Synchronized fun clear() {
    val config = readConfig().put("acceptAfter", System.currentTimeMillis())
    val database = helper.writableDatabase
    database.beginTransaction()
    try { writeConfig(config); database.delete("inbox_receipts", null, null); database.setTransactionSuccessful() }
    finally { database.endTransaction() }
    health.edit().remove("error").apply()
  }
  @Synchronized fun status(): Map<String, Any> {
    prune()
    val config = readConfig()
    return mapOf("enabled" to config.optBoolean("enabled"), "sources" to (0 until config.getJSONArray("sources").length()).map { config.getJSONArray("sources").getString(it) }, "bookId" to config.optString("bookId"), "pendingCount" to pendingCount(), "error" to (health.getString("error", "") ?: ""))
  }
  fun errorState(code: String) { health.edit().putString("error", code).apply() }
}
