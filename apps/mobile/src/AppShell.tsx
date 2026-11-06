import { useBookMonth } from "./hooks/useBookMonth";
import { LedgerSnackbar } from "./ui/LedgerSnackbar";
import { LedgerViewBoundary } from "./ui/LedgerViewBoundary";
import { useNativeSync } from "./hooks/useNativeSync";
import { usePlanningNotifications } from "./hooks/usePlanningNotifications";
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
import { entryState } from "./ui/entry-state";
import { navigationIdentity as identifyNavigation } from "./ui/navigation-identity";
import { useToolHistory } from "./ui/tool-history";
import { RetainedToolPages } from "./ui/RetainedToolPages";
import { AppScenes } from "./ui/AppScenes";
import { AppEditors, type MobileEditorState } from "./ui/AppEditors";
import {
  AppNavigation,
  APP_ROUTES,
  NAVIGATION_BAR_HEIGHT,
} from "./ui/AppNavigation";
import { SystemBars } from "./ui/SystemBars";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { useKeyboardVisibility } from "./hooks/useKeyboardVisibility";
import type { BillRecord } from "@hamster-ledger/core";
import { useLedger } from "./hooks/useLedger";
import { useNetworkController } from "./hooks/useNetworkController";
import { useAppTheme } from "./hooks/useAppTheme";
import { LedgerProvider } from "./ui/LedgerProvider";
import { AuxiliaryPages, auxiliaryPageTitle } from "./ui/AuxiliaryPages";
import { useNativeAccount } from "./auth/NativeAccount";
import { AccountScreen } from "./screens/AccountScreen";
const ASSET_INDEX = APP_ROUTES.findIndex(({ key }) => key === "assets");
const RECORDS_INDEX = APP_ROUTES.findIndex(({ key }) => key === "records");
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
  const toolHistory = useToolHistory();
  const {
    current: tool,
    open: openTool,
    back: closeTool,
    clear: clearTools,
  } = toolHistory;
  const [month, setMonth] = useBookMonth(controller.mode);
  const [editor, setEditor] = useState<MobileEditorState | null>(null);
  const [detail, setDetail] = useState<BillRecord | null>(null);
  const [metadata, setMetadata] = useState<BillRecord | null>(null);
  const hasReducedMotion = useReducedMotion();
  const cloudBook = controller.books.find(
    (book) => book.id === controller.mode,
  )?.cloud;
  const navigationIdentity = identifyNavigation({
    mode: controller.mode,
    server: account.server,
    userId: account.credentials?.user.id,
    cloud: cloudBook,
  });
  const [visibleIdentity, setVisibleIdentity] = useState(navigationIdentity);
  const mustChangePassword = Boolean(
    account.credentials?.user.mustChangePassword,
  );
  const currentEntryState = entryState({
    isLedgerLoading: controller.isLoading,
    isAccountLoading: account.isLoading,
    isIdentityCurrent: visibleIdentity === navigationIdentity,
    needsEntry: account.needsEntry,
    mustChangePassword,
  });
  const canUseApp = currentEntryState === "ledger";
  usePlanningNotifications(controller, canUseApp);
  const themeName = controller.ledger.preferences?.theme;
  const isDark = themeName === "night";
  const theme = useAppTheme({ themeName, hasReducedMotion });
  const openReview = useCallback(() => openTool("review"), [openTool]);
  useEffect(() => {
    clearTools();
    setIndex(0);
    setEditor(null);
    setDetail(null);
    setMetadata(null);
    setVisibleIdentity(navigationIdentity);
  }, [navigationIdentity, clearTools]);
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (tool) {
        closeTool();
        return true;
      }
      if (index !== 0) {
        setIndex(0);
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [tool, index, closeTool]);
  function edit(record: BillRecord): void {
    setDetail(null);
    if (
      record.status !== "confirmed" ||
      controller.ledger.records.some((item) => item.duplicateOf === record.id)
    )
      setMetadata(record);
    else setEditor({ record });
  }
  function openAssets(): void {
    clearTools();
    setIndex(ASSET_INDEX);
  }
  const hasNavigation = canUseApp && !tool;
  const isReportPage = tool === "reports-home";
  function openEntry(): void {
    setEditor({});
  }
  const navigationHeight =
    insets.bottom + (hasNavigation ? NAVIGATION_BAR_HEIGHT : 0);
  const pageTitle = tool ? auxiliaryPageTitle(tool) : APP_ROUTES[index].header;
  return (
    <LedgerProvider theme={theme}>
      <SystemBars isDark={isDark} />
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader
          key={fontScale}
          title={!canUseApp ? "仓鼠记账" : pageTitle}
          bookName={
            canUseApp
              ? controller.books.find((book) => book.id === controller.mode)
                  ?.name
              : undefined
          }
          canUndo={hasNavigation && controller.canUndo}
          onUndo={controller.undo}
          onBooks={hasNavigation ? () => openTool("books") : undefined}
          onTools={hasNavigation ? () => openTool("tools-home") : undefined}
          onBack={tool && canUseApp ? closeTool : undefined}
          onAdd={isReportPage && canUseApp ? openEntry : undefined}
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
          {controller.network?.isIdentityBlocked && !account.isLoading ? (
            <AccountScreen />
          ) : currentEntryState === "loading" ? (
            <LedgerLoading error={controller.error} />
          ) : currentEntryState === "account" ? (
            <AccountScreen
              onLocal={mustChangePassword ? undefined : () => undefined}
            />
          ) : (
            <LedgerViewBoundary
              resetKey={`${controller.mode}:${tool ?? index}`}
              onRecovery={() => openTool("backup")}
            >
              <NavigationLayer
                hasReducedMotion={hasReducedMotion}
                transitionKey={tool ? `${controller.mode}:${tool}` : undefined}
                tool={
                  tool ? (
                    <RetainedToolPages
                      entries={toolHistory.entries}
                      identity={navigationIdentity}
                      renderPage={(page) => (
                        <AuxiliaryPages
                          tool={page}
                          controller={controller}
                          sync={sync}
                          month={month}
                          onMonth={setMonth}
                          onRecord={setDetail}
                          onReimburse={(record) =>
                            setEditor({
                              initialDraft: {
                                type: "reimburse",
                                relatedId: record.id,
                                accountId: "",
                                amount: "",
                              },
                            })
                          }
                          onReview={openReview}
                          onAssets={openAssets}
                          onAdd={(date) => setEditor({ date })}
                          onOpen={openTool}
                        />
                      )}
                    />
                  ) : null
                }
              >
                <AppNavigation
                  index={index}
                  onIndexChange={setIndex}
                  renderScene={({ route }) => (
                    <AppScenes
                      route={route}
                      controller={controller}
                      onRecord={setDetail}
                      onReview={openReview}
                      onOpen={openTool}
                    />
                  )}
                  hasReducedMotion={hasReducedMotion}
                  bottomInset={insets.bottom}
                />
              </NavigationLayer>
            </LedgerViewBoundary>
          )}
        </SafeAreaView>
        {hasNavigation && index === RECORDS_INDEX && !isKeyboardVisible ? (
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
        {canUseApp ? (
          <LedgerSnackbar
            controller={controller}
            bottom={navigationHeight}
            onHeight={setNoticeHeight}
          />
        ) : null}
        {canUseApp ? (
          <AppEditors
            controller={controller}
            detail={detail}
            editor={editor}
            metadata={metadata}
            onCloseDetail={() => setDetail(null)}
            onEdit={edit}
            onCloseEditor={() => setEditor(null)}
            onCloseMetadata={() => setMetadata(null)}
            onMonth={setMonth}
          />
        ) : null}
      </View>
    </LedgerProvider>
  );
}
