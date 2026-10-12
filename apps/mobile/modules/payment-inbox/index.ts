import { requireOptionalNativeModule } from "expo-modules-core";
interface PaymentInboxNative {
  getStatus(): Promise<unknown>;
  configure(payload: string): Promise<void>;
  listPending(): Promise<unknown>;
  handle(payload: string): Promise<void>;
  clear(): Promise<void>;
  openSettings(): Promise<void>;
  addListener(
    event: "onInboxChanged",
    listener: () => void,
  ): { remove(): void };
}
export default requireOptionalNativeModule<PaymentInboxNative>(
  "HamsterPaymentInbox",
);
