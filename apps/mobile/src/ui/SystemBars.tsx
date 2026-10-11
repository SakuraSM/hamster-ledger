import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationBar } from "expo-navigation-bar";
interface SystemBarsProps {
  isDark: boolean;
}
export function SystemBars({ isDark }: SystemBarsProps): React.JSX.Element {
  const style = isDark ? "light" : "dark";
  return (
    <>
      <StatusBar style={style} />
      {Platform.OS === "android" ? <NavigationBar style={style} /> : null}
    </>
  );
}
