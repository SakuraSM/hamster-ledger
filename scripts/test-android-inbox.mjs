import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const android = resolve(root, "apps/mobile/android");
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
const serial = process.env.ANDROID_SERIAL;
if (!sdk || !serial || !/^emulator-\d+$/.test(serial))
  throw new Error(
    "原生收件箱测试仅允许显式指定 Android 模拟器；请设置 ANDROID_HOME 和 ANDROID_SERIAL。",
  );
const adb = (...args) =>
  execFileSync(resolve(sdk, "platform-tools/adb"), ["-s", serial, ...args], {
    encoding: "utf8",
  }).trim();
if (adb("shell", "getprop", "ro.kernel.qemu") !== "1")
  throw new Error("禁止在真实手机运行会清理测试密钥的 instrumentation。");
if (!existsSync(resolve(android, "gradlew")))
  execFileSync(
    "npm",
    ["exec", "--", "expo", "prebuild", "--platform", "android", "--no-install"],
    { cwd: resolve(root, "apps/mobile"), stdio: "inherit" },
  );
execFileSync(
  resolve(android, "gradlew"),
  [
    ":hamster-payment-inbox:testDebugUnitTest",
    ":hamster-payment-inbox:assembleDebugAndroidTest",
    "-PreactNativeArchitectures=arm64-v8a",
    "--console=plain",
  ],
  { cwd: android, stdio: "inherit" },
);
const output = resolve(
  root,
  "apps/mobile/modules/payment-inbox/android/build/outputs/apk/androidTest/debug",
);
const metadata = JSON.parse(
  readFileSync(resolve(output, "output-metadata.json"), "utf8"),
);
const packageName = metadata.applicationId;
if (packageName !== "expo.modules.paymentinbox.test")
  throw new Error("测试 APK namespace 不符合隔离要求。");
try {
  let installed = "";
  try {
    installed = adb("shell", "pm", "path", packageName);
  } catch {
    /* pm path exits 1 for an absent test app. */
  }
  if (installed) adb("uninstall", packageName);
  console.log(
    adb("install", "-t", resolve(output, metadata.elements[0].outputFile)),
  );
  const result = adb(
    "shell",
    "am",
    "instrument",
    "-w",
    packageName + "/androidx.test.runner.AndroidJUnitRunner",
  );
  console.log(result);
  if (!/OK\s*\(\d+ tests?\)/.test(result))
    throw new Error("Android instrumentation 未通过。");
} finally {
  try {
    adb("uninstall", packageName);
  } catch {
    /* Only this task's isolated test namespace is removed. */
  }
}
