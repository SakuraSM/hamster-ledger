import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import {
  TOKEN_SCOPES,
  useOpenTokens,
  type NetworkClient,
} from "@hamster-ledger/ledger-react";
export function OpenTokensPanel({
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
    [scopes, setScopes] = useState(["records:read"]),
    [days, setDays] = useState<number | string>(30);
  return (
    <details>
      <summary>开放 API 与机器人令牌</summary>
      <Stack gap="sm" mt="md">
        <Text size="sm">
          令牌仅访问当前联网账本，以你的成员身份操作。每分钟最多 60 次请求。
        </Text>
        {tokens.error ? (
          <Alert color="red" role="alert">
            {tokens.error}
          </Alert>
        ) : null}
        <TextInput
          label="令牌名称"
          placeholder="例如：家庭记账机器人"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <NumberInput
          label="有效期（天）"
          min={1}
          max={365}
          value={days}
          onChange={setDays}
        />
        <Checkbox.Group label="权限范围" value={scopes} onChange={setScopes}>
          <Stack gap="xs" mt="xs">
            {TOKEN_SCOPES.filter(
              (scope) => !isViewer || scope.value.endsWith(":read"),
            ).map((scope) => (
              <Checkbox
                key={scope.value}
                value={scope.value}
                label={scope.label}
              />
            ))}
          </Stack>
        </Checkbox.Group>
        <Button
          disabled={tokens.isBusy || !name.trim() || !scopes.length}
          onClick={() => void tokens.create(name, scopes, Number(days))}
        >
          创建 API 令牌
        </Button>
        {tokens.secret ? (
          <Alert title="请立即保存，关闭后不能再次查看">
            <Textarea
              label="新令牌（仅显示此次）"
              value={tokens.secret}
              readOnly
              autosize
              styles={{
                input: { fontFamily: "monospace", overflowWrap: "anywhere" },
              }}
            />
            <Button variant="subtle" onClick={tokens.dismiss}>
              我已保存，隐藏令牌
            </Button>
          </Alert>
        ) : null}
        {tokens.tokens.map((token) => (
          <Group key={token.id} justify="space-between" align="start">
            <div>
              <Text>{token.name}</Text>
              <Text size="sm" c="dimmed">
                {token.revokedAt
                  ? "已撤销"
                  : `有效至 ${new Date(token.expiresAt).toLocaleDateString()}`}{" "}
                ·{" "}
                {token.scopes
                  .map(
                    (scope) =>
                      TOKEN_SCOPES.find((item) => item.value === scope)
                        ?.label ?? scope,
                  )
                  .join("、")}
              </Text>
            </div>
            {!token.revokedAt ? (
              <Button
                variant="subtle"
                color="red"
                disabled={tokens.isBusy}
                onClick={() => void tokens.revoke(token.id)}
              >
                撤销令牌
              </Button>
            ) : null}
          </Group>
        ))}
      </Stack>
    </details>
  );
}
