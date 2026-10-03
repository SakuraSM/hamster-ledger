import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const mobile = resolve(root, "apps/mobile");
const isWindows = process.platform === "win32";
const architectures = process.env.HAMSTER_ANDROID_ARCHITECTURES ?? "arm64-v8a";
if (
  !architectures
    .split(",")
    .every((value) =>
      ["arm64-v8a", "armeabi-v7a", "x86", "x86_64"].includes(value),
    )
)
  throw new Error("HAMSTER_ANDROID_ARCHITECTURES 包含未知架构。");
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    shell: isWindows,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(
  isWindows ? "npm.cmd" : "npm",
  ["exec", "--", "expo", "prebuild", "--platform", "android", "--no-install"],
  mobile,
);
run(
  isWindows ? "gradlew.bat" : "./gradlew",
  [
    ":app:assembleRelease",
    "-PreactNativeArchitectures=" + architectures,
    "--console=plain",
  ],
  resolve(mobile, "android"),
);
console.log(
  "已生成可独立运行的 APK：apps/mobile/android/app/build/outputs/apk/release/app-release.apk",
);
console.log("默认使用开发签名，仅供安装验证；商店发布前需配置自己的签名。");
