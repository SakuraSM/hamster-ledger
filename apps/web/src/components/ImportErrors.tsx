const ERROR_PREVIEW_LIMIT = 10;
interface ImportErrorsProps {
  errors: string[];
  skipErrors: boolean;
  onSkip: (skip: boolean) => void;
}
export function ImportErrors({
  errors,
  skipErrors,
  onSkip,
}: ImportErrorsProps): React.JSX.Element | null {
  if (!errors.length) return null;
  return (
    <div className="parse-errors">
      <details open>
        <summary>{errors.length} 行无法识别，请检查字段或原始文件</summary>
        <ul>
          {errors.slice(0, ERROR_PREVIEW_LIMIT).map((message, index) => (
            <li key={`${index}-${message}`}>{message}</li>
          ))}
        </ul>
        {errors.length > ERROR_PREVIEW_LIMIT ? (
          <p>另有 {errors.length - ERROR_PREVIEW_LIMIT} 行错误</p>
        ) : null}
      </details>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={skipErrors}
          onChange={(event) => onSkip(event.target.checked)}
        />
        跳过错误行，仅导入有效记录
      </label>
    </div>
  );
}
