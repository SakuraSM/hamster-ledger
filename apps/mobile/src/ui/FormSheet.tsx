import { MIN_TOUCH_TARGET } from "../constants";
import type { ReactNode } from "react";
import { Modal, View, Keyboard, Alert } from "react-native";
import { Appbar, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { SystemBars } from "./SystemBars";
import { Screen } from "./Screen";
import { useSystemFontScale } from "../hooks/useSystemFontScale";
interface FormSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  hasUnsavedChanges?: boolean;
}
export function FormSheet({
  title,
  onClose,
  children,
  hasUnsavedChanges = false,
}: FormSheetProps): React.JSX.Element {
  const theme = useTheme();
  const fontScale = useSystemFontScale();
  function requestClose(): void {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }
    Alert.alert("放弃未保存的修改？", "当前草稿还没有写入账本。", [
      { text: "继续编辑", style: "cancel" },
      { text: "放弃修改", style: "destructive", onPress: onClose },
    ]);
  }
  return (
    <Modal
      visible
      animationType={theme.animation.scale === 0 ? "none" : "slide"}
      onRequestClose={requestClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SystemBars isDark={theme.dark} />
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <Appbar.Header
          key={fontScale}
          mode="small"
          statusBarHeight={0}
          style={{ backgroundColor: theme.colors.background }}
        >
          <Appbar.Action
            style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
            icon="arrow-left"
            onPress={requestClose}
            accessibilityLabel="返回"
          />
          <Appbar.Content title={title} />
        </Appbar.Header>
        <View style={{ flex: 1 }}>
          <Screen>{children}</Screen>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
