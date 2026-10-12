package expo.modules.paymentinbox
import org.junit.Assert.*
import org.junit.Test
class PaymentFilterTest {
  @Test fun acceptsOnlySelectedPaymentPackages() {
    assertEquals(PaymentSource.WECHAT, PaymentFilter.source("com.tencent.mm"))
    assertEquals(PaymentSource.ALIPAY, PaymentFilter.source("com.eg.android.AlipayGphone"))
    assertNull(PaymentFilter.source("top.nings.hamsterledger"))
  }
  @Test fun rejectsChatsPromotionsOtpsAndSummaries() {
    assertFalse(PaymentFilter.accepts(PaymentNotificationText(PaymentSource.WECHAT, "朋友", "支付成功 12.34元", false)))
    assertFalse(PaymentFilter.accepts(PaymentNotificationText(PaymentSource.WECHAT, "微信支付", "领红包，支付成功后返现", false)))
    assertFalse(PaymentFilter.accepts(PaymentNotificationText(PaymentSource.ALIPAY, "支付宝", "支付验证码 123456", false)))
    assertFalse(PaymentFilter.accepts(PaymentNotificationText(PaymentSource.WECHAT, "微信支付", "支付成功12.34元", true)))
  }
  @Test fun acceptsPaymentAndRefundMessages() {
    assertTrue(PaymentFilter.accepts(PaymentNotificationText(PaymentSource.WECHAT, "微信支付", "支付成功，实付12.34元", false)))
    assertTrue(PaymentFilter.accepts(PaymentNotificationText(PaymentSource.ALIPAY, "支付宝交易通知", "退款到账2.34元", false)))
  }
}
