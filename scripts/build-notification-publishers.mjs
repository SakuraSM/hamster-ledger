import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "..");
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
const java = process.env.JAVA_HOME;
if (!sdk || !java) throw new Error("请设置 ANDROID_HOME 与 JAVA_HOME。");
const buildTools = readdirSync(resolve(sdk, "build-tools"))
  .filter((name) => /^\d+\.\d+\.\d+$/.test(name))
  .sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true }),
  )
  .at(-1);
if (!buildTools) throw new Error("缺少 Android build tools。");
const tools = resolve(sdk, "build-tools", buildTools),
  androidJar = resolve(sdk, "platforms/android-36/android.jar");
const directory = mkdtempSync(join(tmpdir(), "hamster-payment-publishers-"));
const run = ({ program, args, options = {} }) =>
  execFileSync(program, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
const adb = (...args) =>
  run({
    program: resolve(sdk, "platform-tools/adb"),
    args: ["-s", process.env.ANDROID_SERIAL ?? "", ...args],
  }).trim();
const install = process.argv.includes("--install");
if (
  install &&
  (!/^emulator-\d+$/.test(process.env.ANDROID_SERIAL ?? "") ||
    adb("shell", "getprop", "ro.kernel.qemu") !== "1")
)
  throw new Error("合成发布器禁止安装到真实手机。");
for (const [name, packageName] of [
  ["wechat", "com.tencent.mm"],
  ["alipay", "com.eg.android.AlipayGphone"],
]) {
  const work = resolve(directory, name);
  mkdirSync(work);
  mkdirSync(resolve(work, "classes"));
  mkdirSync(resolve(work, "dex"));
  const manifest = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="${packageName}" android:versionCode="1" android:versionName="hamster-qa-notification-publisher"><uses-sdk android:minSdkVersion="26" android:targetSdkVersion="36"/><uses-permission android:name="android.permission.POST_NOTIFICATIONS"/><application android:label="支付通知测试发布器" android:theme="@android:style/Theme.Material.Light.NoActionBar"><activity android:name="qa.NotificationPublisherActivity" android:exported="true"/></application></manifest>`;
  writeFileSync(resolve(work, "AndroidManifest.xml"), manifest);
  run({
    program: resolve(java, "bin/javac"),
    args: [
      "-source",
      "8",
      "-target",
      "8",
      "-classpath",
      androidJar,
      "-d",
      resolve(work, "classes"),
      resolve(
        root,
        "tests/android/notification-publisher/NotificationPublisherActivity.java",
      ),
    ],
  });
  run({
    program: resolve(tools, "d8"),
    args: [
      "--min-api",
      "26",
      "--lib",
      androidJar,
      "--output",
      resolve(work, "dex"),
      resolve(work, "classes/qa/NotificationPublisherActivity.class"),
    ],
  });
  const unsigned = resolve(work, "unsigned.apk"),
    aligned = resolve(work, "aligned.apk"),
    apk = resolve(work, name + ".apk");
  run({
    program: resolve(tools, "aapt2"),
    args: [
      "link",
      "-I",
      androidJar,
      "--manifest",
      resolve(work, "AndroidManifest.xml"),
      "-o",
      unsigned,
    ],
  });
  run({
    program: "zip",
    args: ["-q", unsigned, "classes.dex"],
    options: { cwd: resolve(work, "dex") },
  });
  run({
    program: resolve(tools, "zipalign"),
    args: ["-f", "4", unsigned, aligned],
  });
  const key = resolve(root, "apps/mobile/android/app/debug.keystore");
  if (!existsSync(key))
    throw new Error("请先执行 Android prebuild 生成开发签名。");
  run({
    program: resolve(tools, "apksigner"),
    args: [
      "sign",
      "--ks",
      key,
      "--ks-pass",
      "pass:android",
      "--key-pass",
      "pass:android",
      "--out",
      apk,
      aligned,
    ],
  });
  if (install) {
    let installed = "";
    try {
      installed = adb("shell", "pm", "path", packageName);
    } catch {}
    if (installed) {
      const details = adb("shell", "dumpsys", "package", packageName);
      if (!details.includes("versionName=hamster-qa-notification-publisher"))
        throw new Error("目标已有真实支付 App，拒绝覆盖；请使用独立模拟器。");
      adb("uninstall", packageName);
    }
    adb("install", apk);
    adb(
      "shell",
      "pm",
      "grant",
      packageName,
      "android.permission.POST_NOTIFICATIONS",
    );
  }
  console.log(JSON.stringify({ name, packageName, apk, installed: install }));
}
