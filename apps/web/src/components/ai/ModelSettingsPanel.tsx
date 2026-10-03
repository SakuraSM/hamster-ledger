import {
  Alert,
  Button,
  Checkbox,
  PasswordInput,
  TextInput,
} from "@mantine/core";
import type { ModelSettings } from "@hamster-ledger/ledger-react";
export function ModelSettingsPanel({
  form,
}: {
  form: ModelSettings;
}): React.JSX.Element {
  return (
    <details className="panel">
      <summary>模型服务设置</summary>
      <p className="muted">
        配置保存在当前服务端账号。密钥加密保存；不配置模型也可解析文本草稿。
      </p>
      <div className="form-grid">
        <TextInput
          label="OpenAI 兼容地址"
          value={form.draft.endpoint}
          onChange={(event) =>
            form.change("endpoint", event.currentTarget.value)
          }
          placeholder="https://api.openai.com/v1"
        />
        <TextInput
          label="模型名"
          description="可先保存地址，再读取模型列表选择"
          value={form.draft.model}
          onChange={(event) => form.change("model", event.currentTarget.value)}
          list="available-ai-models"
        />
        <datalist id="available-ai-models">
          {form.models.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
        <PasswordInput
          label={form.profile.hasKey ? "替换密钥（留空保留）" : "模型密钥"}
          autoComplete="new-password"
          value={form.key}
          onChange={(event) => form.setKey(event.currentTarget.value)}
        />
        <Checkbox
          label="明确允许局域网模型 / HTTP"
          checked={form.draft.allowLan}
          onChange={(event) =>
            form.change("allowLan", event.currentTarget.checked)
          }
        />
        <Checkbox
          label="此服务不需要密钥"
          checked={form.draft.noKey}
          onChange={(event) =>
            form.change("noKey", event.currentTarget.checked)
          }
        />
        <Checkbox
          label="启用视觉能力"
          checked={form.draft.vision}
          onChange={(event) =>
            form.change("vision", event.currentTarget.checked)
          }
        />
        <Checkbox
          label="清除已有密钥"
          checked={form.clearKey}
          onChange={(event) => form.setClearKey(event.currentTarget.checked)}
        />
      </div>
      <div className="button-row">
        <Button disabled={form.isBusy} onClick={() => void form.save()}>
          保存模型配置
        </Button>
        <Button
          variant="outline"
          disabled={form.isBusy || !form.profile.config}
          onClick={() => void form.list()}
        >
          读取模型列表
        </Button>
        <Button
          variant="outline"
          disabled={form.isBusy || !form.profile.config}
          onClick={() => void form.test(false)}
        >
          测试文本
        </Button>
        <Button
          variant="outline"
          disabled={form.isBusy || !form.profile.config?.vision}
          onClick={() => void form.test(true)}
        >
          测试视觉
        </Button>
        <Button
          variant="subtle"
          disabled={form.isBusy || !form.profile.config}
          onClick={() => void form.remove()}
        >
          移除配置
        </Button>
      </div>
      {form.error ? (
        <Alert color="red" role="alert">
          {form.error}
        </Alert>
      ) : null}
      {form.message ? <p role="status">{form.message}</p> : null}
    </details>
  );
}
