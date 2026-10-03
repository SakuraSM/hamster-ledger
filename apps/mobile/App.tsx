import { SafeAreaProvider } from "react-native-safe-area-context";
import { NativeAccountProvider } from "./src/auth/NativeAccount";
import { AppShell } from "./src/AppShell";
export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NativeAccountProvider>
        <AppShell />
      </NativeAccountProvider>
    </SafeAreaProvider>
  );
}
