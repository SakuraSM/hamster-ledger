package expo.modules.paymentinbox

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import java.io.File
import java.security.KeyStore
import javax.crypto.AEADBadTagException
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runners.MethodSorters

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class InboxStoreInstrumentedTest {
  private lateinit var context: Context
  private lateinit var store: InboxStore
  @Before fun prepare() {
    context = ApplicationProvider.getApplicationContext()
    check(context.packageName != "top.nings.hamsterledger") { "Instrumentation must never modify the production app UID." }
    store = InboxStore.get(context)
    store.configure(InboxCaptureConfig(false, emptyList(), ""))
    store.clear()
  }
  private fun enable(bookId: String = "personal") {
    store.configure(InboxCaptureConfig(true, listOf("微信支付"), bookId))
    Thread.sleep(2)
  }
  private fun receipt(id: Int = 1, postedAt: Long = System.currentTimeMillis() + 1): JSONObject = JSONObject()
    .put("id", "%064x".format(id)).put("source", "微信支付").put("title", "微信支付")
    .put("text", "支付成功，商户：LOCAL-QA-ENCRYPTED-ONLY，实付12.34元")
    .put("postedAt", postedAt).put("capturedAt", System.currentTimeMillis()).put("isTruncated", false)
  private fun database(): SQLiteDatabase = SQLiteDatabase.openDatabase(File(context.noBackupFilesDir,"payment-inbox.db").path,null,SQLiteDatabase.OPEN_READWRITE)
  @Test fun aDisabledCaptureCannotCreatePendingMoney() {
    assertFalse(store.capture(receipt()))
    assertTrue(store.pending().isEmpty())
  }
  @Test fun bStableIdentifiersAndEncryptedPayloadsSurviveNewCipherInstances() {
    enable()
    assertTrue(store.capture(receipt()))
    val first = InboxCipher().eventId("LOCAL-QA-STABLE-EVENT")
    assertEquals(first, InboxCipher().eventId("LOCAL-QA-STABLE-EVENT"))
    assertTrue(first.matches(Regex("[a-f0-9]{64}")))
    assertEquals("LOCAL-QA-ENCRYPTED-ONLY", store.pending()[0]["text"].toString().substringAfter("商户：").substringBefore("，"))
    val bytes = File(context.noBackupFilesDir,"payment-inbox.db").readBytes().toString(Charsets.ISO_8859_1)
    assertFalse(bytes.contains("LOCAL-QA-ENCRYPTED-ONLY"))
  }
  @Test fun cDuplicateReplayAndConfigChangesKeepReceiptOwnership() {
    enable()
    val first = receipt()
    assertTrue(store.capture(first))
    assertFalse(store.capture(first))
    enable("book:second")
    assertTrue(store.capture(receipt(2)))
    val items=store.pending().associateBy { it["id"] }
    assertEquals("personal", items["%064x".format(1)]?.get("bookId"))
    assertEquals("book:second", items["%064x".format(2)]?.get("bookId"))
    Thread.sleep(2)
    store.clear()
    assertFalse(store.capture(first))
    assertTrue(store.pending().isEmpty())
  }
  @Test fun dCapacityNeverOverwritesPendingReceiptsAndHandledBodiesAreRemoved() {
    enable()
    val time=System.currentTimeMillis()+1
    for(index in 1..InboxStore.MAX_PENDING) assertTrue(store.capture(receipt(index,time)))
    assertFalse(store.capture(receipt(InboxStore.MAX_PENDING+1,time)))
    assertEquals(InboxStore.MAX_PENDING, store.pending().size)
    assertEquals("storage_full", store.status()["error"])
    store.handled(HandledInboxReceipt("%064x".format(1),"confirmed","notification:qa"))
    assertEquals(InboxStore.MAX_PENDING-1,store.pending().size)
    assertTrue(store.capture(receipt(InboxStore.MAX_PENDING+1,time)))
    database().use { db -> db.rawQuery("SELECT iv,payload FROM inbox_receipts WHERE id=?",arrayOf("%064x".format(1))).use { cursor ->
      assertTrue(cursor.moveToFirst())
      val body=InboxCipher().open("%064x".format(1),SealedInboxValue(cursor.getBlob(0),cursor.getBlob(1)))
      assertFalse(body.has("text"))
    } }
  }
  @Test fun eExpiredRowsAreRemovedAndTamperedCiphertextFailsClosed() {
    enable()
    assertTrue(store.capture(receipt()))
    database().use { db -> db.update("inbox_receipts",ContentValues().apply { put("posted_at",System.currentTimeMillis()-InboxStore.RETENTION_MS-1) },null,null) }
    assertTrue(store.pending().isEmpty())
    assertTrue(store.capture(receipt(2)))
    database().use { db ->
      val payload=db.rawQuery("SELECT payload FROM inbox_receipts",null).use { cursor -> cursor.moveToFirst();cursor.getBlob(0) }
      payload[payload.lastIndex]=(payload.last().toInt() xor 1).toByte()
      db.update("inbox_receipts",ContentValues().apply { put("payload",payload) },null,null)
    }
    assertThrows(AEADBadTagException::class.java) { store.pending() }
    database().use { db -> db.rawQuery("SELECT count(*) FROM inbox_receipts",null).use { cursor -> cursor.moveToFirst();assertEquals(1,cursor.getInt(0)) } }
  }
  @Test fun zMissingKeyNeverCreatesAnEmptyReplacementQueue() {
    enable()
    assertTrue(store.capture(receipt()))
    KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry("hamster.payment-inbox.key.v1") }
    assertThrows(IllegalStateException::class.java) { store.pending() }
    database().use { db -> db.rawQuery("SELECT count(*) FROM inbox_receipts",null).use { cursor -> cursor.moveToFirst();assertEquals(1,cursor.getInt(0)) } }
  }
}
