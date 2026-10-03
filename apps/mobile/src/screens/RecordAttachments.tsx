import { useMemo, useState } from "react";
import { Image } from "react-native";
import { Button, Text } from "react-native-paper";
import {
  remoteAttachments,
  useRecordAttachments,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { nativeAttachments } from "../platform/attachments";
import { pickImages } from "../platform/images";
import { useNativeAccount } from "../auth/NativeAccount";
import { FormSheet } from "../ui/FormSheet";
import { ErrorMessage } from "../ui/Screen";
export function RecordAttachments({
  controller,
  recordId,
}: {
  controller: LedgerController;
  recordId: string;
}): React.JSX.Element {
  const client = useNativeAccount().client,
    remote = useMemo(() => remoteAttachments(client), [client]),
    bookId = controller.books.find((book) => book.id === controller.mode)?.cloud
      ?.id;
  const form = useRecordAttachments({
      controller,
      recordId,
      store: bookId ? remote : nativeAttachments,
      storageId: bookId ?? controller.mode,
    }),
    [error, setError] = useState("");
  async function select(camera: boolean): Promise<void> {
    try {
      setError("");
      await form.add(await pickImages(camera));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "图片读取失败。");
    }
  }
  return (
    <>
      <Text variant="titleMedium">附件凭证</Text>
      <Button
        icon="image-outline"
        disabled={form.isBusy}
        onPress={() => void select(false)}
      >
        添加凭证图片
      </Button>
      <Button
        icon="camera-outline"
        disabled={form.isBusy}
        onPress={() => void select(true)}
      >
        拍摄凭证
      </Button>
      {form.ids.map((id, index) => (
        <Button
          key={id}
          mode="outlined"
          disabled={form.isBusy}
          onPress={() => void form.view(id)}
        >
          查看凭证 {index + 1}
        </Button>
      ))}
      <ErrorMessage message={error || form.error} />
      {form.viewing ? (
        <FormSheet title={form.viewing.name} onClose={form.close}>
          <Image
            source={{
              uri: `data:${form.viewing.mime};base64,${form.viewing.base64}`,
            }}
            accessibilityLabel={form.viewing.name}
            style={{ width: "100%", height: 500 }}
            resizeMode="contain"
          />
          <Button
            disabled={form.isBusy}
            onPress={() => {
              if (form.viewing)
                void form.unlink(form.viewing.id).then(form.close);
            }}
          >
            解除这张凭证的关联
          </Button>
        </FormSheet>
      ) : null}
    </>
  );
}
