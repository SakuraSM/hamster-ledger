import { UnstyledButton, Button, TextInput } from "@mantine/core";
import { useState } from "react";
import type { LedgerController } from "../../hooks/useLedger";
export function BooksPanel({
  controller,
}: {
  controller: LedgerController;
}): React.JSX.Element {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [rename, setRename] = useState("");
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
                onClick={() =>
                  void change({ id: book.id, isArchived: !book.isArchived })
                }
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
    </section>
  );
}
