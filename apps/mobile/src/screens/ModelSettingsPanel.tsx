import { Button, Checkbox, List, Text, TextInput } from "react-native-paper";
import type { ModelSettings } from "@hamster-ledger/ledger-react";
import { View } from "react-native";
import { ChoiceField } from "../ui/ChoiceField";
import { ErrorMessage } from "../ui/Screen";
export function ModelSettingsPanel({
  form,
}: {
  form: ModelSettings;
}): React.JSX.Element {
  return (
    <List.Accordion
      title="模型服务设置"
      left={(props) => <List.Icon {...props} icon="cog-outline" />}
    >
      <View style={{ gap: 12, padding: 12 }}>
        <Text>
          模型配置由服务端账号管理，密钥加密保存且不回传。不配置时仍可解析文本草稿。
        </Text>
        <TextInput
          label="OpenAI 兼容地址"
          autoCapitalize="none"
          value={form.draft.endpoint}
          onChangeText={(value) => form.change("endpoint", value)}
        />
        <TextInput
          label="模型名"
          autoCapitalize="none"
          value={form.draft.model}
          onChangeText={(value) => form.change("model", value)}
        />
        {form.models.length ? (
          <ChoiceField
            label="服务端模型列表"
            value={form.draft.model}
            options={form.models.map((value) => ({ label: value, value }))}
            onChange={(value) => form.change("model", value)}
          />
        ) : null}
        <TextInput
          label={form.profile.hasKey ? "替换密钥（留空保留）" : "模型密钥"}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={form.key}
          onChangeText={form.setKey}
        />
        <Checkbox.Item
          label="明确允许局域网模型 / HTTP"
          status={form.draft.allowLan ? "checked" : "unchecked"}
          onPress={() => form.change("allowLan", !form.draft.allowLan)}
        />
        <Checkbox.Item
          label="此服务不需要密钥"
          status={form.draft.noKey ? "checked" : "unchecked"}
          onPress={() => form.change("noKey", !form.draft.noKey)}
        />
        <Checkbox.Item
          label="启用视觉能力"
          status={form.draft.vision ? "checked" : "unchecked"}
          onPress={() => form.change("vision", !form.draft.vision)}
        />
        <Checkbox.Item
          label="清除已有密钥"
          status={form.clearKey ? "checked" : "unchecked"}
          onPress={() => form.setClearKey(!form.clearKey)}
        />
        <Button
          mode="contained"
          disabled={form.isBusy}
          onPress={() => void form.save()}
        >
          保存模型配置
        </Button>
        <Button
          mode="outlined"
          disabled={form.isBusy || !form.profile.config}
          onPress={() => void form.list()}
        >
          读取模型列表
        </Button>
        <Button
          disabled={form.isBusy || !form.profile.config}
          onPress={() => void form.test(false)}
        >
          测试文本
        </Button>
        <Button
          disabled={form.isBusy || !form.profile.config?.vision}
          onPress={() => void form.test(true)}
        >
          测试视觉
        </Button>
        <Button
          disabled={form.isBusy || !form.profile.config}
          onPress={() => void form.remove()}
        >
          移除配置
        </Button>
        <ErrorMessage message={form.error} />
        {form.message ? (
          <Text accessibilityLiveRegion="polite">{form.message}</Text>
        ) : null}
      </View>
    </List.Accordion>
  );
}
