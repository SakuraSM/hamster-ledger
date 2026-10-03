import { deliverPlanningNotifications } from "./platform/planning-notifications";
import { MONTH_KEY_LENGTH } from "./constants";
const FAB_WITH_NOTICE_BOTTOM = 176;
const FAB_BOTTOM = 106;
const TOOL_NOTICE_BOTTOM = 12;
const NOTICE_BOTTOM = 88;
import hamsterLogo from "../assets/hamster-logo.png";
import { useEffect, useState } from "react";
import { BackHandler, View, Image, AccessibilityInfo } from "react-native";
import {
  Appbar,
  BottomNavigation,
  FAB,
  PaperProvider,
  Snackbar,
  ActivityIndicator,
  Text,
  Banner,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { saveEntry, type BillRecord } from "@hamster-ledger/core";
import { useLedger } from "./hooks/useLedger";
import { useNetworkController } from "./hooks/useNetworkController";
import { ledgerTheme } from "./ui/theme";
import { iconSettings } from "./ui/Icons";
import { OverviewScreen } from "./screens/OverviewScreen";
import { TransactionsScreen } from "./screens/TransactionsScreen";
import { AssetsScreen } from "./screens/AssetsScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import {
  ToolsScreen,
  TOOLS,
  type ToolPage as ToolPageName,
} from "./screens/ToolsScreen";
import { ToolPage } from "./screens/ToolPage";
import { EntryEditor } from "./screens/EntryEditor";
import { RecordDetail } from "./screens/RecordDetail";
import { RecordMetadataEditor } from "./screens/RecordMetadataEditor";
import { localNow } from "./platform/runtime";
import { useNativeAccount } from "./auth/NativeAccount";
import { AccountScreen } from "./screens/AccountScreen";
const ROUTES = [
  { key: "overview", title: "总览", focusedIcon: "home-outline" },
  { key: "records", title: "账单", focusedIcon: "format-list-bulleted" },
  { key: "assets", title: "资产", focusedIcon: "wallet-outline" },
  { key: "reports", title: "报表", focusedIcon: "chart-pie" },
  { key: "tools", title: "更多", focusedIcon: "dots-horizontal" },
];
export function AppShell(): React.JSX.Element {
  const local = useLedger();
  const controller = useNetworkController(local);
  const account = useNativeAccount();
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<ToolPageName | null>(null);
  const [month, setMonth] = useState("2026-09");
  const [editor, setEditor] = useState<{
    record?: BillRecord;
    date?: string;
  } | null>(null);
  const [detail, setDetail] = useState<BillRecord | null>(null);
  const [metadata, setMetadata] = useState<BillRecord | null>(null);
  const [hasReducedMotion, setHasReducedMotion] = useState(false);
  useEffect(() => {
    if (!controller.ledger.preferences?.reminderEnabled) return;
    void deliverPlanningNotifications(
      controller.mode,
      controller.ledger.notifications ?? [],
    ).catch(() => {
      /* Notices remain available in the notification center when the OS delivery fails. */
    });
  }, [
    controller.mode,
    controller.ledger.notifications,
    controller.ledger.preferences?.reminderEnabled,
  ]);
  const isDark = controller.ledger.preferences?.theme === "night";
  const theme = ledgerTheme(isDark);
  if (controller.ledger.preferences?.theme === "sage")
    theme.colors.primary = "#456445";
  theme.animation.scale = hasReducedMotion ? 0 : 1;
  useEffect(() => {
    let isActive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (isActive) setHasReducedMotion(value);
    });
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setHasReducedMotion,
    );
    return () => {
      isActive = false;
      listener.remove();
    };
  }, []);
  useEffect(() => {
    setMonth(
      controller.mode === "demo"
        ? "2026-09"
        : localNow().slice(0, MONTH_KEY_LENGTH),
    );
  }, [controller.mode]);
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (tool) {
        setTool(null);
        return true;
      }
      if (index !== 0) {
        setIndex(0);
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [tool, index]);
  function edit(record: BillRecord): void {
    setDetail(null);
    if (
      record.status !== "confirmed" ||
      controller.ledger.records.some((item) => item.duplicateOf === record.id)
    )
      setMetadata(record);
    else setEditor({ record });
  }
  function renderScene({
    route,
  }: {
    route: { key: string };
  }): React.JSX.Element {
    const pages: Record<string, React.JSX.Element> = {
      overview: (
        <OverviewScreen
          ledger={controller.ledger}
          month={month}
          onMonth={setMonth}
          isDemo={controller.mode === "demo"}
          onRecord={setDetail}
          onReview={() => setTool("review")}
        />
      ),
      records: (
        <TransactionsScreen
          key={controller.mode}
          controller={controller}
          onRecord={setDetail}
        />
      ),
      assets: <AssetsScreen controller={controller} onRecord={setDetail} />,
      reports: (
        <ReportsScreen
          key={controller.mode}
          ledger={controller.ledger}
          bookId={
            controller.books.find((book) => book.id === controller.mode)?.cloud
              ?.id
          }
        />
      ),
      tools: <ToolsScreen onSelect={setTool} />,
    };
    return pages[route.key];
  }
  return (
    <PaperProvider theme={theme} settings={iconSettings}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <Appbar.Header statusBarHeight={0}>
          {tool ? (
            <Appbar.Action
              icon="arrow-left"
              onPress={() => setTool(null)}
              accessibilityLabel="返回更多功能"
            />
          ) : (
            <Image
              source={hamsterLogo}
              style={{ width: 40, height: 40, marginLeft: 16 }}
              accessibilityLabel="仓鼠记账"
            />
          )}
          <Appbar.Content
            title={
              <View>
                <Text variant="titleLarge">
                  {tool
                    ? TOOLS.find((item) => item.key === tool)?.title
                    : "仓鼠记账"}
                </Text>
                <Text variant="labelSmall">
                  {
                    controller.books.find((book) => book.id === controller.mode)
                      ?.name
                  }
                </Text>
              </View>
            }
          />
          {controller.canUndo ? (
            <Appbar.Action
              icon="undo"
              accessibilityLabel="撤销上一次修改"
              onPress={controller.undo}
            />
          ) : null}
          <Appbar.Action
            icon="book-open-variant"
            accessibilityLabel="切换账本"
            onPress={() => setTool("books")}
          />
        </Appbar.Header>
        <Banner
          visible={Boolean(controller.error)}
          actions={[]}
          icon="shield-check-outline"
        >
          {controller.error}
        </Banner>
        {controller.isLoading ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              gap: 16,
            }}
          >
            <ActivityIndicator animating={!controller.error} />
            <Text>
              {controller.error
                ? "本机数据已保留，读取失败时禁止写入。"
                : "正在打开加密账本…"}
            </Text>
          </View>
        ) : account.needsEntry ? (
          <AccountScreen onLocal={() => undefined} />
        ) : tool ? (
          <ToolPage
            key={`${controller.mode}:${tool}`}
            page={tool}
            controller={controller}
            onRecord={setDetail}
            onAdd={(date) => setEditor({ date })}
            onReview={() => setTool("review")}
          />
        ) : (
          <BottomNavigation
            navigationState={{ index, routes: ROUTES }}
            onIndexChange={setIndex}
            renderScene={renderScene}
            sceneAnimationEnabled={!hasReducedMotion}
            labeled
            shifting={false}
            keyboardHidesNavigationBar
          />
        )}
        {!controller.isLoading && !account.needsEntry && !tool ? (
          <FAB
            icon="plus"
            label="记一笔"
            accessibilityLabel="记一笔"
            onPress={() => setEditor({})}
            style={{
              position: "absolute",
              right: 20,
              bottom: controller.notice ? FAB_WITH_NOTICE_BOTTOM : FAB_BOTTOM,
            }}
          />
        ) : null}
        <Snackbar
          wrapperStyle={{ bottom: tool ? TOOL_NOTICE_BOTTOM : NOTICE_BOTTOM }}
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
        {detail ? (
          <RecordDetail
            controller={controller}
            record={detail}
            onClose={() => setDetail(null)}
            onEdit={edit}
          />
        ) : null}
        {editor ? (
          <EntryEditor
            bookId={
              controller.books.find((book) => book.id === controller.mode)
                ?.cloud?.id
            }
            onCommit={async (next, date) => {
              await controller.commit(next);
              setMonth(date.slice(0, MONTH_KEY_LENGTH));
              controller.notify("账单已保存。");
            }}
            ledger={controller.ledger}
            record={editor.record}
            date={editor.date}
            onClose={() => setEditor(null)}
            onSave={async (input) => {
              await controller.commit(saveEntry(controller.ledger, input));
              setMonth(input.date.slice(0, MONTH_KEY_LENGTH));
              controller.notify("账单已保存");
            }}
          />
        ) : null}
        {metadata ? (
          <RecordMetadataEditor
            record={metadata}
            controller={controller}
            onClose={() => setMetadata(null)}
          />
        ) : null}
      </SafeAreaView>
    </PaperProvider>
  );
}
