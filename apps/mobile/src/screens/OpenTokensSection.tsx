import { useState } from "react";
import { Button, Checkbox, Text, TextInput } from "react-native-paper";
import {
  TOKEN_SCOPES,
  useOpenTokens,
  type NetworkClient,
} from "@hamster-ledger/ledger-react";
import { Section, ErrorMessage } from "../ui/Screen";
export function OpenTokensSection({
  client,
  bookId,
  isViewer,
}: {
  client: NetworkClient;
  bookId: string;
  isViewer: boolean;
}): React.JSX.Element {
  const tokens = useOpenTokens(client, bookId);
  const [name, setName] = useState(""),
    [days, setDays] = useState("30"),
    [scopes, setScopes] = useState(["records:read"]);
  return (
    <Section title="开放 API 与机器人令牌">
      <Text>
        令牌仅访问当前联网账本，以你的成员身份操作。每分钟最多 60 次请求。
      </Text>
      <ErrorMessage message={tokens.error} />
      <TextInput
        label="令牌名称"
        value={name}
        maxLength={80}
        onChangeText={setName}
      />
      <TextInput
        label="有效期（1–365 天）"
        value={days}
        keyboardType="number-pad"
        onChangeText={setDays}
      />
      {TOKEN_SCOPES.filter(
        (scope) => !isViewer || scope.value.endsWith(":read"),
      ).map((scope) => (
        <Checkbox.Item
          key={scope.value}
          label={scope.label}
          status={scopes.includes(scope.value) ? "checked" : "unchecked"}
          onPress={() =>
            setScopes(
              scopes.includes(scope.value)
                ? scopes.filter((item) => item !== scope.value)
                : [...scopes, scope.value],
            )
          }
        />
      ))}
      <Button
        mode="contained"
        disabled={tokens.isBusy || !name.trim() || !scopes.length}
        onPress={() => void tokens.create(name, scopes, Number(days))}
      >
        创建 API 令牌
      </Button>
      {tokens.secret ? (
        <Section title="请立即保存，关闭后不能再次查看">
          <Text selectable accessibilityLabel="新令牌（仅显示此次）">
            {tokens.secret}
          </Text>
          <Button onPress={tokens.dismiss}>我已保存，隐藏令牌</Button>
        </Section>
      ) : null}
      {tokens.tokens.map((token) => (
        <Section key={token.id} title={token.name}>
          <Text>
            {token.revokedAt
              ? "已撤销"
              : `有效至 ${new Date(token.expiresAt).toLocaleDateString()}`}
          </Text>
          <Text>
            {token.scopes
              .map(
                (scope) =>
                  TOKEN_SCOPES.find((item) => item.value === scope)?.label ??
                  scope,
              )
              .join("、")}
          </Text>
          {!token.revokedAt ? (
            <Button
              disabled={tokens.isBusy}
              onPress={() => void tokens.revoke(token.id)}
            >
              撤销令牌
            </Button>
          ) : null}
        </Section>
      ))}
    </Section>
  );
}
