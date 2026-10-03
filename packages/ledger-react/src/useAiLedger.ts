import { useEffect, useRef, useState } from "react";
import {
  addAiDrafts,
  confirmAiDraft,
  parseRuleText,
  type AiDraft,
  type Attachment,
  type AttachmentStore,
  type Ledger,
} from "@hamster-ledger/core";
import type { LedgerController } from "./ledger-controller.js";
import type { NetworkClient, NetworkSnapshot } from "./network-model.js";
import type { ModelProfile } from "./useModelSettings.js";
import { aiEditedEntry } from "./ai-form.js";
export interface AiLedgerController {
  text: string;
  setText: (value: string) => void;
  images: Attachment[];
  addImages: (images: Attachment[]) => void;
  removeImage: (id: string) => void;
  isBusy: boolean;
  error: string;
  isAutoPost: boolean;
  setAutoPost: (enabled: boolean) => Promise<void>;
  recognize: () => Promise<void>;
  discard: (id: string) => Promise<void>;
  confirm: (draft: AiDraft, ledger: Ledger) => Promise<void>;
  bookId?: string;
}
export function useAiLedger(input: {
  controller: LedgerController;
  client: NetworkClient;
  profile: ModelProfile;
  isAuthenticated: boolean;
  store: AttachmentStore;
  storageId: string;
  localNow: () => string;
  newId: () => string;
  hash: (value: string) => Promise<string>;
  onPosted?: (date: string) => void;
}): AiLedgerController {
  const { controller, client } = input;
  const bookId = controller.books.find((book) => book.id === controller.mode)
    ?.cloud?.id;
  const [text, setText] = useState(""),
    [images, setImages] = useState<Attachment[]>([]),
    [isBusy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [isAutoPost, setAutoPostState] = useState(false);
  const locked = useRef(false),
    latest = useRef(input);
  latest.current = input;
  const pendingKey = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    setAutoPostState(false);
    if (bookId)
      void client
        .request<{ autoPost: boolean }>(`/network/books/${bookId}/ai/options`)
        .then((result) => {
          if (active) setAutoPostState(result.autoPost);
        })
        .catch((cause: unknown) => {
          if (active)
            setError(
              cause instanceof Error ? cause.message : "自动入账设置读取失败。",
            );
        });
    return () => {
      active = false;
    };
  }, [client, bookId]);
  async function run(action: () => Promise<void>): Promise<void> {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "操作失败，输入已保留。",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function recognize(): Promise<void> {
    return run(async () => {
      if (!text.trim() && !images.length)
        throw new Error("请输入文本或选择图片。");
      if (bookId && !controller.network?.isOnline)
        throw new Error("联网账本离线时只读。");
      if (images.length && !input.profile.config)
        throw new Error("尚未配置视觉模型，图片识别不可用。");
      const before = controller.ledger,
        mode = controller.mode;
      const fingerprint = await input.hash(
        JSON.stringify({
          text,
          images: images.map((image) => image.hash).sort(),
          date: input.localNow().slice(0, 10),
        }),
      );
      pendingKey.current =
        pendingKey.current?.fingerprint === fingerprint
          ? pendingKey.current
          : { fingerprint, key: input.newId() };
      for (const image of images) await input.store.put(input.storageId, image);
      let drafts: AiDraft[];
      if (!bookId && !input.profile.config) {
        drafts = parseRuleText(text, before, input.localNow().slice(0, 10)).map(
          (candidate) => ({
            id: input.newId(),
            sourceHash: fingerprint,
            source: "text-rule",
            sourceLabel: "本地规则",
            createdAt: input.localNow(),
            attachmentIds: [],
            candidate,
            state: "pending",
          }),
        );
      } else {
        if (!input.isAuthenticated) throw new Error("请登录后使用服务端模型。");
        const uploaded: string[] = [];
        try {
          if (!bookId)
            for (const image of images) {
              await client.request("/attachments", {
                method: "POST",
                body: image,
              });
              uploaded.push(image.id);
            }
          const result = await client.request<
            { drafts: AiDraft[] } & Partial<NetworkSnapshot>
          >(`${bookId ? `/network/books/${bookId}` : ""}/ai/recognize`, {
            method: "POST",
            body: {
              key: pendingKey.current.key,
              revision: controller.network?.revision,
              text,
              attachmentIds: images.map((image) => image.id),
              targetEndpoint: input.profile.config?.endpoint,
              context: bookId
                ? undefined
                : { accounts: before.accounts, categories: before.categories },
            },
          });
          if (latest.current.controller.mode !== mode)
            throw new Error("当前账本已切换；请回到原账本查看结果。");
          if (bookId) {
            await controller.network?.receive?.(result as NetworkSnapshot);
            controller.notify(
              result.drafts.some((draft) => draft.state === "confirmed")
                ? "识别结果已入账，可撤销。"
                : "已生成待确认草稿。",
            );
            setText("");
            setImages([]);
            return;
          }
          drafts = result.drafts;
        } finally {
          for (const id of uploaded)
            await client
              .request(`/attachments/${id}`, { method: "DELETE", body: {} })
              .catch(() => {
                /* Server cleanup removes abandoned temporary images after 24 hours. */
              });
        }
      }
      if (
        latest.current.controller.mode !== mode ||
        latest.current.controller.ledger !== before
      )
        throw new Error("识别期间账本已变化，请重新识别。");
      await controller.commit(addAiDrafts(before, drafts, false), mode);
      controller.notify("已生成待确认草稿。");
      setText("");
      setImages([]);
    });
  }
  return {
    text,
    setText,
    images,
    isBusy,
    error,
    isAutoPost,
    bookId,
    recognize,
    addImages: (added) => {
      const unique = [...images, ...added].filter(
        (image, index, all) =>
          all.findIndex((other) => other.hash === image.hash) === index,
      );
      if (unique.length > 5) {
        setError("每次最多选择 5 张图片。");
        return;
      }
      setImages(unique);
    },
    removeImage: (id) =>
      setImages((previous) => previous.filter((image) => image.id !== id)),
    setAutoPost: (autoPost) =>
      run(async () => {
        if (!bookId) throw new Error("请先转换为联网账本。");
        await client.request(`/network/books/${bookId}/ai/options`, {
          method: "PUT",
          body: { autoPost },
        });
        setAutoPostState(autoPost);
      }),
    discard: (id) =>
      run(async () => {
        await controller.commit({
          ...controller.ledger,
          aiDrafts: controller.ledger.aiDrafts?.map((draft) =>
            draft.id === id ? { ...draft, state: "discarded" } : draft,
          ),
        });
        controller.notify("草稿已丢弃，可撤销。");
      }),
    confirm: async (draft, edited) => {
      const entry = aiEditedEntry(edited, draft);
      if (bookId) {
        const result = await client.request<NetworkSnapshot>(
          `/network/books/${bookId}/ai/confirm`,
          {
            method: "POST",
            body: {
              key: `confirm:${draft.id}`,
              revision: controller.network?.revision,
              draftId: draft.id,
              entry,
            },
          },
        );
        await controller.network?.receive?.(result);
      } else
        await controller.commit(
          confirmAiDraft(controller.ledger, draft.id, entry),
        );
      input.onPosted?.(entry.date);
      controller.notify("草稿已确认入账，可撤销。");
    },
  };
}
