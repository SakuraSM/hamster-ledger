import { useState } from "react";
import { Button, List, Text, TextInput } from "react-native-paper";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { Screen, Section, ErrorMessage } from "../ui/Screen";
interface BooksScreenProps {
  controller: LedgerController;
}
export function BooksScreen({
  controller,
}: BooksScreenProps): React.JSX.Element {
  const [name, setName] = useState("");
  const [rename, setRename] = useState("");
  const [error, setError] = useState("");
  async function create(): Promise<void> {
    try {
      await controller.createBook(name);
      setName("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建失败");
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
      setRename("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新失败");
    }
  }
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        账本管理
      </Text>
      {controller.books.map((book) => (
        <List.Item
          key={book.id}
          title={book.name}
          description={
            book.id === controller.mode
              ? "当前账本"
              : book.isArchived
                ? "已归档"
                : "点击切换"
          }
          onPress={() => {
            if (!book.isArchived)
              controller.switchMode(book.id as LedgerController["mode"]);
          }}
          left={(props) => (
            <List.Icon
              {...props}
              icon={
                book.id === controller.mode
                  ? "book-open-variant"
                  : "book-outline"
              }
            />
          )}
          right={() =>
            book.id.startsWith("book:") ? (
              <Button
                disabled={book.id === controller.mode || controller.isSaving}
                onPress={() =>
                  void change({ id: book.id, isArchived: !book.isArchived })
                }
              >
                {book.isArchived ? "恢复" : "归档"}
              </Button>
            ) : null
          }
        />
      ))}
      <Section title="新建账本">
        <TextInput
          accessibilityLabel="新账本名称"
          mode="outlined"
          label="新账本名称"
          value={name}
          onChangeText={setName}
          maxLength={40}
        />
        <Button
          mode="contained"
          disabled={controller.isSaving}
          onPress={() => void create()}
        >
          创建账本
        </Button>
      </Section>
      <Section title="重命名当前账本">
        <TextInput
          accessibilityLabel="新名称"
          mode="outlined"
          label="新名称"
          value={rename}
          onChangeText={setRename}
          maxLength={40}
        />
        <Button
          mode="outlined"
          disabled={!rename.trim() || controller.isSaving}
          onPress={() => void change({ id: controller.mode, name: rename })}
        >
          保存名称
        </Button>
      </Section>
      <ErrorMessage message={error} />
    </Screen>
  );
}
