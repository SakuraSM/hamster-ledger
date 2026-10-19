export type SnapshotSyncAction = "idle" | "upload" | "download" | "conflict";

/** Compare against the last successfully persisted sync checkpoint. */
export function snapshotSyncAction(
  localFingerprint: string,
  remoteRevision: number,
  checkpoint: { fingerprint: string; revision: number },
): SnapshotSyncAction {
  const localChanged = localFingerprint !== checkpoint.fingerprint;
  const remoteChanged = remoteRevision !== checkpoint.revision;
  if (localChanged && remoteChanged) return "conflict";
  if (remoteChanged) return "download";
  return localChanged ? "upload" : "idle";
}
