package expo.modules.paymentinbox

enum class PaymentSource(val packageName: String, val label: String) {
  ALIPAY("com.eg.android.AlipayGphone", "支付宝"),
  WECHAT("com.tencent.mm", "微信支付");
}
data class PaymentNotificationText(val source: PaymentSource, val title: String, val text: String, val isSummary: Boolean)
object PaymentFilter {
  private val paymentWords = Regex("支付成功|付款成功|收款成功|收款到账|收款通知|退款成功|退款到账|转账成功|交易成功|扣款成功|到账提醒")
  private val excludedWords = Regex("验证码|动态口令|登录验证|待支付|支付失败|付款失败|领红包|营销活动")
  private val wechatSender = Regex("微信支付|微信收款助手|微信收款商业版|收付款通知")
  private val alipaySender = Regex("支付宝|交易通知|支付通知|收款通知|消息助手|收款到账")
  fun source(packageName: String): PaymentSource? = PaymentSource.entries.find { it.packageName == packageName }
  fun accepts(input: PaymentNotificationText): Boolean {
    val (source, title, text, isSummary) = input
    if (isSummary || excludedWords.containsMatchIn(title + text)) return false
    val sender = if (source == PaymentSource.WECHAT) wechatSender else alipaySender
    return sender.containsMatchIn(title) && paymentWords.containsMatchIn(title + text)
  }
}
