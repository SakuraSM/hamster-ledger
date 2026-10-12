package expo.modules.paymentinbox

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

data class SealedInboxValue(val iv: ByteArray, val bytes: ByteArray)
class InboxCipher {
  companion object {
    private const val KEY_ALIAS = "hamster.payment-inbox.key.v1"
    private const val KEY_STORE = "AndroidKeyStore"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val TAG_BITS = 128
    private const val EVENT_ALIAS = "hamster.payment-inbox.event.v1"
  }
  private fun key(canCreate: Boolean): SecretKey {
    val store = KeyStore.getInstance(KEY_STORE).apply { load(null) }
    if (store.containsAlias(KEY_ALIAS)) return store.getKey(KEY_ALIAS, null) as SecretKey
    check(canCreate) { "支付消息密钥不可用，原数据已保留。" }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEY_STORE)
    generator.init(KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    return generator.generateKey()
  }
  fun eventId(value: String): String {
    val store = KeyStore.getInstance(KEY_STORE).apply { load(null) }
    val key = if (store.containsAlias(EVENT_ALIAS)) store.getKey(EVENT_ALIAS, null) as SecretKey else {
      val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, KEY_STORE)
      generator.init(KeyGenParameterSpec.Builder(EVENT_ALIAS, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY).setDigests(KeyProperties.DIGEST_SHA256).build())
      generator.generateKey()
    }
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(key)
    return mac.doFinal(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
  }
  fun seal(name: String, value: JSONObject): SealedInboxValue {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, key(true))
    cipher.updateAAD((KEY_ALIAS + ":" + name).toByteArray(Charsets.UTF_8))
    return SealedInboxValue(cipher.iv, cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8)))
  }
  fun open(name: String, value: SealedInboxValue): JSONObject {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, key(false), GCMParameterSpec(TAG_BITS, value.iv))
    cipher.updateAAD((KEY_ALIAS + ":" + name).toByteArray(Charsets.UTF_8))
    return JSONObject(String(cipher.doFinal(value.bytes), Charsets.UTF_8))
  }
}
