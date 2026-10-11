import { Image, StyleSheet, View } from "react-native";
import { Appbar, Text, useTheme } from "react-native-paper";
import { MIN_TOUCH_TARGET } from "../constants";
import hamsterLogo from "../../assets/hamster-logo.png";
interface AppHeaderProps {
  title: string;
  bookName?: string;
  canUndo: boolean;
  onUndo: () => void;
  onBooks: () => void;
  onBack?: () => void;
}
export function AppHeader({
  title,
  bookName,
  canUndo,
  onUndo,
  onBooks,
  onBack,
}: AppHeaderProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <Appbar.Header
      mode="small"
      style={{ backgroundColor: theme.colors.surface }}
    >
      {onBack ? (
        <Appbar.BackAction
          style={styles.action}
          onPress={onBack}
          accessibilityLabel="返回更多功能"
        />
      ) : (
        <Image source={hamsterLogo} style={styles.logo} accessible={false} />
      )}
      <Appbar.Content
        title={
          <View style={styles.title}>
            <Text
              variant="titleLarge"
              numberOfLines={1}
              accessibilityRole="header"
            >
              {title}
            </Text>
            <Text
              variant="labelMedium"
              numberOfLines={1}
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {bookName}
            </Text>
          </View>
        }
      />
      {canUndo ? (
        <Appbar.Action
          style={styles.action}
          icon="undo"
          accessibilityLabel="撤销上一次修改"
          onPress={onUndo}
        />
      ) : null}
      <Appbar.Action
        style={styles.action}
        icon="book-open-variant"
        accessibilityLabel="切换账本"
        onPress={onBooks}
      />
    </Appbar.Header>
  );
}
const LOGO_SIZE = 32;
const HEADER_GUTTER = 16;
const BRAND_GAP = 12;
const TITLE_GAP = 2;
const styles = StyleSheet.create({
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    marginLeft: HEADER_GUTTER,
    marginRight: BRAND_GAP,
  },
  title: { gap: TITLE_GAP },
  action: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET },
});
