import { Button } from "@mantine/core";
export interface ImportSuccess {
  added: number;
  duplicate: number;
  pending: number;
}
import { Icons } from "./Icons";
interface ImportCompleteProps {
  success: { added: number; duplicate: number; pending: number };
  onContinue: () => void;
  onReview: () => void;
  onAll: () => void;
}
export function ImportComplete({
  success,
  onContinue,
  onReview,
  onAll,
}: ImportCompleteProps): React.JSX.Element {
  return (
    <section>
      <div className="page-heading">
        <h1>账单，整理好了</h1>
        <p>已保存到我的账本，示例数据没有混入</p>
      </div>
      <div className="import-success">
        <Icons.Check size={62} weight="duotone" />
        <h2>导入完成</h2>
        <p>
          {success.added} 条已入账 · {success.duplicate} 条重复记录 ·{" "}
          {success.pending} 条待确认
        </p>
        <p className="muted">原始字段已保留，可在账单详情查看。</p>
        <div className="button-row">
          <Button
            variant="outline"
            type="submit"
            className="secondary-button"
            onClick={onContinue}
          >
            继续导入
          </Button>
          <Button
            variant="filled"
            type="submit"
            className="primary-button"
            onClick={success.pending ? onReview : onAll}
          >
            {success.pending ? "前往核对" : "查看我的账单"}
            <Icons.Arrow size={19} />
          </Button>
        </div>
      </div>
    </section>
  );
}
export function ImportHelp(): React.JSX.Element {
  return (
    <div className="import-help">
      <h2>第一次导入？</h2>
      <p>
        从支付软件导出交易明细。系统会寻找表头并建议字段，识别结果可在「调整字段」中按样例核对。银行账单没有账户列时，可填写卡尾号辅助核对。
      </p>
      <div className="sample-links">
        <a href="/samples/alipay-demo.csv" download>
          <Icons.File size={20} />
          支付宝示例 CSV
        </a>
        <a href="/samples/wechat-demo.csv" download>
          <Icons.File size={20} />
          微信示例 CSV
        </a>
        <a href="/samples/cmb-demo.csv" download>
          <Icons.File size={20} />
          招行示例 CSV
        </a>
      </div>
      <p className="muted small">
        PDF、图片及银行直连暂不支持。不同版本的账单字段可能需要手动调整。
      </p>
    </div>
  );
}
