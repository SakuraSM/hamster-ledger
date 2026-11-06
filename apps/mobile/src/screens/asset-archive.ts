import { archiveAssetAccount, type AssetAccount } from "@hamster-ledger/core";
import type { AlertButton } from "react-native";
import type { LedgerController } from "@hamster-ledger/ledger-react";

export interface AssetArchiveRequest {
  accountId: string;
  isArchived: boolean;
  bookKey: string;
}
export function assetBookKey(controller: LedgerController): string {
  const cloud = controller.books.find(
    (book) => book.id === controller.mode,
  )?.cloud;
  return JSON.stringify([
    controller.mode,
    cloud?.server ?? null,
    cloud?.id ?? null,
    cloud?.userId ?? null,
  ]);
}
export function promptAssetArchive(input: {
  controller: LedgerController;
  account: AssetAccount;
  show: (title: string, message: string, buttons: AlertButton[]) => void;
  onConfirm: (request: AssetArchiveRequest) => void;
}): void {
  const { controller, account, show, onConfirm } = input;
  const request = {
    accountId: account.id,
    isArchived: account.isArchived,
    bookKey: assetBookKey(controller),
  };
  show(
    account.isArchived ? "恢复账户" : "归档账户",
    "历史流水与账户关联会保留。",
    [
      { text: "取消", style: "cancel" },
      { text: "确认", onPress: () => onConfirm(request) },
    ],
  );
}
export interface AssetCommitOptions {
  mode: LedgerController["mode"];
  expectedRevision: number;
  expectedCloud: { id: string; userId: string; server: string };
}
export function assetCommitOptions(
  controller: LedgerController,
): AssetCommitOptions | undefined {
  const revision = controller.network?.revision;
  if (revision === undefined) return undefined;
  const cloud = controller.books.find(
    (book) => book.id === controller.mode,
  )?.cloud;
  if (!cloud) throw new Error("联网账本身份不可用，请重新打开后重试。");
  return {
    mode: controller.mode,
    expectedRevision: revision,
    expectedCloud: { id: cloud.id, userId: cloud.userId, server: cloud.server },
  };
}
export async function commitAssetArchive(input: {
  controller: LedgerController;
  request: AssetArchiveRequest;
  isMounted: boolean;
  at: string;
}): Promise<void> {
  const { controller, request, isMounted, at } = input;
  if (!isMounted || assetBookKey(controller) !== request.bookKey)
    throw new Error("账本已切换，请重新打开账户后确认。");
  const account = controller.ledger.accounts.find(
    (item) => item.id === request.accountId,
  );
  if (!account) throw new Error("账户已不存在，请重新打开资产管理。");
  if (account.isArchived !== request.isArchived)
    throw new Error("账户状态已变化，请重新核对后确认。");
  const options = assetCommitOptions(controller);
  const next = archiveAssetAccount({
    ledger: controller.ledger,
    accountId: account.id,
    isArchived: !account.isArchived,
    at,
  });
  if (options) await controller.commit(next, options);
  else await controller.commit(next);
}
