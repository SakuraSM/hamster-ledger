import { UnstyledButton, Button, TextInput } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { Book } from "@hamster-ledger/core";
import type { LedgerController } from "../../hooks/useLedger";
import { Dialog } from "../Dialog";
export function BooksPanel({
  controller,
}: {
  controller: LedgerController;
}): React.JSX.Element {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [rename, setRename] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<Book | null>(null);
  const [isArchiving, setArchiving] = useState(false);
  const archiveLock = useRef(false);
  useEffect(() => {
    if (!archiveTarget && !isArchiving) archiveLock.current = false;
  }, [archiveTarget, isArchiving]);
  async function archiveBook(): Promise<void> {
    if (!archiveTarget || archiveLock.current) return;
    archiveLock.current = true;
    setArchiving(true);
    let succeeded = false;
    try {
      const current = controller.books.find(
        (book) => book.id === archiveTarget.id,
      );
      if (
        !current ||
        current.isArchived ||
        current.name !== archiveTarget.name ||
        current.id === controller.mode
      )
        throw new Error("账本已变化或已切换为当前账本，请关闭后重新确认。");
      await controller.updateBooks(
        controller.books.map((book) =>
          book.id === current.id ? { ...book, isArchived: true } : book,
        ),
      );
      succeeded = true;
      setArchiveTarget(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "归档账本失败");
    } finally {
      if (!succeeded) archiveLock.current = false;
      setArchiving(false);
    }
  }
  async function create(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    try {
      await controller.createBook(name);
      setName("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建失败");
    } finally {
      setIsSaving(false);
    }
  }
  async function change(input: {
    id: string;
    name?: string;
    isArchived?: boolean;
  }): Promise<void> {
    try {
      await controller.updateBooks(
        controller.books.map((book) =>
          book.id === input.id ? { ...book, ...input } : book,
        ),
      );
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    }
  }
  return (
    <section className="panel">
      <h2>账本管理</h2>
      <div className="book-list">
        {controller.books.map((book) => (
          <div className="book-row" key={book.id}>
            <UnstyledButton
              type="submit"
              className={
                book.id === controller.mode
                  ? "selected book-select"
                  : "book-select"
              }
              disabled={book.isArchived}
              onClick={() =>
                controller.switchMode(book.id as LedgerController["mode"])
              }
            >
              {book.name}
              {book.id === controller.mode ? " · 当前" : ""}
              {book.isArchived ? " · 已归档" : ""}
            </UnstyledButton>
            {book.id.startsWith("book:") ? (
              <Button
                variant="subtle"
                type="submit"
                className="text-button"
                disabled={book.id === controller.mode}
                onClick={() => {
                  if (book.isArchived)
                    void change({ id: book.id, isArchived: false });
                  else if (!archiveLock.current) {
                    setError("");
                    setArchiveTarget(book);
                  }
                }}
              >
                {book.isArchived ? "恢复" : "归档"}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      <form className="inline-form" onSubmit={create}>
        <TextInput
          label={<>新账本名称</>}
          required
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="家庭、旅行、个人…"
        />
        <Button
          variant="outline"
          type="submit"
          className="secondary-button"
          disabled={isSaving}
        >
          创建账本
        </Button>
      </form>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          void change({ id: controller.mode, name: rename });
        }}
      >
        <TextInput
          label={<>重命名当前账本</>}
          required
          maxLength={40}
          value={rename}
          onChange={(event) => setRename(event.target.value)}
        />
        <Button variant="outline" type="submit" className="secondary-button">
          重命名
        </Button>
      </form>
      {error ? (
        <p role="alert" className="error-message">
          {error}
        </p>
      ) : null}
      {archiveTarget ? (
        <Dialog title="归档账本？" onClose={() => setArchiveTarget(null)}>
          <p>
            归档“{archiveTarget.name}
            ”后，历史账单会保留，恢复账本后可再次切换使用。
          </p>
          {error ? (
            <p role="alert" className="error-message">
              {error}
            </p>
          ) : null}
          <div className="dialog-actions">
            <Button
              variant="outline"
              disabled={isArchiving}
              onClick={() => setArchiveTarget(null)}
            >
              取消
            </Button>
            <Button loading={isArchiving} onClick={() => void archiveBook()}>
              确认归档
            </Button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
