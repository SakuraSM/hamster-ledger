import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import { attachmentSchema, type Attachment } from "@hamster-ledger/core";
export async function pickImages(camera = false): Promise<Attachment[]> {
  if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
    throw new Error("拍照需要相机权限，可在系统设置中允许，或改为选择图片。");
  const result = camera
    ? await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
        base64: true,
      })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 1,
        base64: true,
      });
  if (result.canceled) return [];
  const attachments: Attachment[] = [];
  try {
    for (const asset of result.assets) {
      const file = new File(asset.uri);
      if (file.size > 8 * 1024 * 1024) throw new Error("每张图片最大 8 MiB。");
      const base64 = asset.base64 ?? (await file.base64());
      const bytes = Uint8Array.from(atob(base64), (character) =>
        character.charCodeAt(0),
      );
      const digest = await Crypto.digest(
        Crypto.CryptoDigestAlgorithm.SHA256,
        bytes,
      );
      const mime =
        bytes[0] === 255 && bytes[1] === 216
          ? "image/jpeg"
          : bytes[0] === 137 && bytes[1] === 80
            ? "image/png"
            : String.fromCharCode(...bytes.subarray(0, 3)) === "GIF"
              ? "image/gif"
              : "image/webp";
      attachments.push(
        attachmentSchema.parse({
          id: Crypto.randomUUID(),
          name: asset.fileName ?? "拍摄凭证.jpg",
          mime,
          hash: Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join(""),
          base64,
          createdAt: Date.now(),
        }),
      );
    }
    return attachments;
  } finally {
    for (const asset of result.assets) {
      const file = new File(asset.uri);
      if (file.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
    }
  }
}
