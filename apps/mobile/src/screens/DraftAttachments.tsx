import { Image } from "react-native";
import { Button } from "react-native-paper";
import type { AttachmentStore } from "@hamster-ledger/core";
import { useAttachmentPreview } from "@hamster-ledger/ledger-react";
import { FormSheet } from "../ui/FormSheet";
import { ErrorMessage } from "../ui/Screen";
export function DraftAttachments({
  store,
  bookId,
  ids,
}: {
  store: AttachmentStore;
  bookId: string;
  ids: string[];
}): React.JSX.Element {
  const preview = useAttachmentPreview(store, bookId);
  return (
    <>
      {ids.map((id, index) => (
        <Button
          key={id}
          mode="outlined"
          disabled={preview.isBusy}
          onPress={() => void preview.open(id)}
        >
          查看原始凭证 {index + 1}
        </Button>
      ))}
      <ErrorMessage message={preview.error} />
      {preview.image ? (
        <FormSheet title={preview.image.name} onClose={preview.close}>
          <Image
            source={{
              uri: `data:${preview.image.mime};base64,${preview.image.base64}`,
            }}
            accessibilityLabel={preview.image.name}
            style={{ width: "100%", height: 500 }}
            resizeMode="contain"
          />
        </FormSheet>
      ) : null}
    </>
  );
}
