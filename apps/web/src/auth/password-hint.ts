import type { AuthPolicy } from "../platform/browser/auth-model";

export function newPasswordHint(policy: AuthPolicy): string {
  return `${policy.minimumPasswordLength}–${policy.maximumPasswordLength} 个字符，支持中文和空格，不强制混合大小写、数字或符号。建议使用独特的长密码或短语，避免常见密码或重复同一字符。`;
}
