import { PAPER_SHEET, SOURCE_RECEIPT } from "./assets";
import type { SceneBodyProps } from "./model";
import { DesignIcon } from "./icons";
export function ReceiptScene({
  scene,
  onNavigate,
}: SceneBodyProps): React.JSX.Element {
  return (
    <>
      <div className="receipt-filters">
        <button
          type="button"
          className="chip is-selected"
          onClick={() => onNavigate("ai-drafts")}
        >
          <DesignIcon name="sparkle" size={19} />
          AI 草稿 1
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => onNavigate("duplicate")}
        >
          <DesignIcon name="download" size={19} />
          导入核对 2
        </button>
      </div>
      <article className="receipt-sheet" aria-label="街角咖啡待确认凭证">
        <img className="sheet-background" src={PAPER_SHEET} alt="" />
        <div className="sheet-content">
          <div className="receipt-origin">
            <DesignIcon name="image" size={19} />
            <span>截图识别 · 未入账</span>
          </div>
          <h2>街角咖啡</h2>
          <strong className="receipt-amount">−¥18.00</strong>
          <button
            className="receipt-date text-action"
            type="button"
            onClick={() => onNavigate("metadata")}
          >
            11月6日 09:20 <DesignIcon name="chevron" size={14} />
          </button>
          <button
            className="receipt-source"
            type="button"
            onClick={() => onNavigate("attachment")}
          >
            <img src={SOURCE_RECEIPT} alt="合成咖啡凭证，拿铁1杯，共18元" />
            <span>
              <DesignIcon name="image" size={18} />
              查看
              <br />
              原图
            </span>
          </button>
          <div className="receipt-fields">
            <button type="button" onClick={() => onNavigate("metadata")}>
              <DesignIcon name="food" size={21} />
              <span>分类</span>
              <strong className="category-value">
                餐饮 <DesignIcon name="chevron" size={14} />
              </strong>
            </button>
            <button type="button" onClick={() => onNavigate("metadata")}>
              <DesignIcon name="wallet" size={21} />
              <span>账户</span>
              <strong>
                现金 <DesignIcon name="chevron" size={14} />
              </strong>
            </button>
          </div>
        </div>
      </article>
      <div className="receipt-pager">
        <button type="button" aria-label="上一张凭证" disabled>
          <DesignIcon name="back" size={18} />
        </button>
        <span>当前 1 / 3</span>
        <button
          type="button"
          aria-label="下一张凭证"
          onClick={() => onNavigate("duplicate")}
        >
          <DesignIcon name="chevron" size={20} />
        </button>
      </div>
      <div className="receipt-undo">
        <DesignIcon name="check" size={18} />
        <span>上一笔已入账</span>
        <button type="button" onClick={() => onNavigate("entry-saved")}>
          撤销
        </button>
      </div>
      {scene.night ? <span className="sr-only">夜读主题</span> : null}
    </>
  );
}
