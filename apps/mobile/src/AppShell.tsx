import { useBookMonth } from "./hooks/useBookMonth";
import { LedgerSnackbar } from "./ui/LedgerSnackbar";
import { LedgerViewBoundary } from "./ui/LedgerViewBoundary";
import { useNativeSync } from "./hooks/useNativeSync";
import { usePlanningNotifications } from "./hooks/usePlanningNotifications";
import { MONTH_KEY_LENGTH } from "./constants";
const FLOATING_GAP = 16;
const MIN_NOTICE_HEIGHT = 48;
import { useEffect, useState, useCallback } from "react";
import { BackHandler, View } from "react-native";
import { useSystemFontScale } from "./hooks/useSystemFontScale";
import { FAB, Banner } from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { AppHeader } from "./ui/AppHeader";
import { LedgerLoading } from "./ui/LedgerLoading";
import { NavigationLayer } from "./ui/NavigationLayer";
import {
  AppNavigation,
  APP_ROUTES,
  NAVIGATION_BAR_HEIGHT,
} from "./ui/AppNavigation";
import { SystemBars } from "./ui/SystemBars";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { useKeyboardVisibility } from "./hooks/useKeyboardVisibility";
import { saveEntry, type BillRecord } from "@hamster-ledger/core";
import { useLedger } from "./hooks/useLedger";
import { useNetworkController } from "./hooks/useNetworkController";
import { useAppTheme } from "./hooks/useAppTheme";
import { LedgerProvider } from "./ui/LedgerProvider";
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
import { useNativeAccount } from "./auth/NativeAccount";
import { AccountScreen } from "./screens/AccountScreen";
const ASSET_INDEX = APP_ROUTES.findIndex(({ key }) => key === "assets");
export function AppShell(): React.JSX.Element {
  const fontScale = useSystemFontScale();
  const local = useLedger();
  const controller = useNetworkController(local);
  const account = useNativeAccount();
  const sync = useNativeSync(controller);
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardVisibility();
  const [noticeHeight, setNoticeHeight] = useState(MIN_NOTICE_HEIGHT);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<ToolPageName | null>(null);
  const [month, setMonth] = useBookMonth(controller.mode);
  const [editor, setEditor] = useState<{
    record?: BillRecord;
    date?: string;
  } | null>(null);
  const [detail, setDetail] = useState<BillRecord | null>(null);
  const [metadata, setMetadata] = useState<BillRecord | null>(null);
  const hasReducedMotion = useReducedMotion();
  usePlanningNotifications(controller);
  const themeName = controller.ledger.preferences?.theme;
  const isDark = themeName === "night";
  const theme = useAppTheme({ themeName, hasReducedMotion });
  const openReview = useCallback(() => setTool("review"), []);
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
          onReview={openReview}
          onAssets={() => setIndex(ASSET_INDEX)}
        />
      ),
      records: (
        <TransactionsScreen
          key={controller.mode}
          controller={controller}
          onRecord={setDetail}
        />
      ),
      assets: (
        <AssetsScreen
          key={controller.mode}
          controller={controller}
          onRecord={setDetail}
        />
      ),
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
      tools: (
        <ToolsScreen
          onSelect={setTool}
          ledger={controller.ledger}
          onAssets={() => setIndex(ASSET_INDEX)}
          storageDescription={
            controller.network?.isConnected
              ? "家庭联网账本：修改保存在服务器；断网时仅可查看本机缓存。"
              : sync.link
                ? "个人同步账本：本机可离线编辑，应用在前台时尝试自动同步；冲突时保留双方版本。"
                : "本机账本：数据保存在此设备，可离线编辑；尚未连接云端同步。"
          }
        />
      ),
    };
    return pages[route.key];
  }
  const hasNavigation = !controller.isLoading && !account.needsEntry && !tool;
  const isReportPage = APP_ROUTES[index].key === "reports";
  function openEntry(): void {
    setEditor({});
  }
  const navigationHeight =
    insets.bottom + (hasNavigation ? NAVIGATION_BAR_HEIGHT : 0);
  const pageTitle = tool
    ? (TOOLS.find((item) => item.key === tool)?.title ?? "更多功能")
    : APP_ROUTES[index].header;
  return (
    <LedgerProvider theme={theme}>
      <SystemBars isDark={isDark} />
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader
          key={fontScale}
          title={
            controller.isLoading || account.needsEntry ? "仓鼠记账" : pageTitle
          }
          bookName={
            controller.books.find((book) => book.id === controller.mode)?.name
          }
          canUndo={controller.canUndo}
          onUndo={controller.undo}
          onBooks={() => setTool("books")}
          onBack={tool ? () => setTool(null) : undefined}
          onAdd={hasNavigation && isReportPage ? openEntry : undefined}
        />
        <SafeAreaView
          edges={
            hasNavigation ? ["left", "right"] : ["left", "right", "bottom"]
          }
          style={{ flex: 1 }}
        >
          <Banner
            visible={Boolean(controller.error)}
            actions={[]}
            icon="shield-check-outline"
          >
            {controller.error}
          </Banner>
          {controller.isLoading ? (
            <LedgerLoading error={controller.error} />
          ) : account.needsEntry ? (
            <AccountScreen onLocal={() => undefined} />
          ) : (
            <LedgerViewBoundary
              resetKey={`${controller.mode}:${tool ?? index}`}
              onRecovery={() => setTool("backup")}
            >
              <NavigationLayer
                hasReducedMotion={hasReducedMotion}
                transitionKey={tool ? `${controller.mode}:${tool}` : undefined}
                tool={
                  tool ? (
                    <ToolPage
                      key={`${controller.mode}:${tool}`}
                      page={tool}
                      sync={sync}
                      controller={controller}
                      onRecord={setDetail}
                      onAdd={(date) => setEditor({ date })}
                      onReview={openReview}
                    />
                  ) : null
                }
              >
                <AppNavigation
                  index={index}
                  onIndexChange={setIndex}
                  renderScene={renderScene}
                  hasReducedMotion={hasReducedMotion}
                  bottomInset={insets.bottom}
                />
              </NavigationLayer>
            </LedgerViewBoundary>
          )}
        </SafeAreaView>
        {hasNavigation &&
        !isReportPage &&
        index !== ASSET_INDEX &&
        !isKeyboardVisible ? (
          <FAB
            icon="plus"
            label="记一笔"
            accessibilityLabel="记一笔"
            onPress={openEntry}
            style={{
              position: "absolute",
              right: Math.max(FLOATING_GAP, insets.right + FLOATING_GAP),
              bottom:
                navigationHeight +
                FLOATING_GAP +
                (controller.notice ? noticeHeight + FLOATING_GAP : 0),
            }}
          />
        ) : null}
        <LedgerSnackbar
          controller={controller}
          bottom={navigationHeight}
          onHeight={setNoticeHeight}
        />
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
      </View>
    </LedgerProvider>
  );
}
