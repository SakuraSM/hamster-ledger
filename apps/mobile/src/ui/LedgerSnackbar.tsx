import { Snackbar } from "react-native-paper";
import type { LedgerController } from "@hamster-ledger/ledger-react";
export function LedgerSnackbar({
  controller,
  bottom,
}: {
  controller: LedgerController;
  bottom: number;
}): React.JSX.Element {
  return (
    <Snackbar
      wrapperStyle={{ bottom, paddingBottom: 0 }}
      visible={Boolean(controller.notice)}
      onDismiss={controller.dismissNotice}
      action={
        controller.canUndo
          ? { label: "撤销", onPress: controller.undo }
          : undefined
      }
    >
      {controller.notice}
    </Snackbar>
  );
}
