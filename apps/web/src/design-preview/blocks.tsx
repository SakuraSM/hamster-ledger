import { FieldsBlock } from "./FieldsBlock";
import { blockForMode, blockKey } from "./platforms";
import type { DesignMode } from "./model";
import { DesignIcon } from "./icons";
import { SOURCE_RECEIPT } from "./assets";
import type { BlockProps, VisualItem } from "./model";
import {
  VisualChart,
  MonthCalendar,
  NumericPad,
  ThemeTiles,
} from "./data-visuals";
export function ItemRow({
  item,
  onNavigate,
}: {
  item: VisualItem;
  onNavigate: (id: string) => void;
}): React.JSX.Element {
  const content = (
    <>
      <span className={`row-icon tone-${item.tone ?? "default"}`}>
        <DesignIcon name={item.icon ?? "receipt"} />
      </span>
      <span className="row-copy">
        <strong>{item.label}</strong>
        {item.note ? <small>{item.note}</small> : null}
      </span>
      {item.value ? <span className="row-value">{item.value}</span> : null}
      {item.target ? <DesignIcon name="chevron" size={17} /> : null}
    </>
  );
  return item.target ? (
    <button
      type="button"
      className="ledger-row"
      onClick={() => onNavigate(item.target!)}
    >
      {content}
    </button>
  ) : (
    <div className="ledger-row">{content}</div>
  );
}
function ListBlock({ block, onNavigate }: BlockProps): React.JSX.Element {
  return (
    <section className="block list-block">
      {block.heading ? <h2>{block.heading}</h2> : null}
      {block.items?.map((item) => (
        <ItemRow key={item.label} item={item} onNavigate={onNavigate} />
      ))}
    </section>
  );
}
function MetricsBlock({ block }: BlockProps): React.JSX.Element {
  return (
    <section className="block metrics">
      {block.items?.map((item) => (
        <div key={item.label}>
          <small>{item.label}</small>
          <strong>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}
function NoticeBlock({ block }: BlockProps): React.JSX.Element {
  return (
    <aside className={`block notice tone-${block.tone ?? "neutral"}`}>
      <DesignIcon
        name={
          block.tone === "red"
            ? "warning"
            : block.tone === "olive"
              ? "check"
              : "shield"
        }
        size={19}
      />
      <div>
        {block.heading ? <strong>{block.heading}</strong> : null}
        {block.text ? <p>{block.text}</p> : null}
      </div>
    </aside>
  );
}
function ImageBlock({ block }: BlockProps): React.JSX.Element {
  return (
    <figure className="block source-image">
      <img src={SOURCE_RECEIPT} alt="示例原始咖啡凭证，合计18元" />
      {block.caption ? <figcaption>{block.caption}</figcaption> : null}
    </figure>
  );
}
function UploadBlock({ block, onNavigate }: BlockProps): React.JSX.Element {
  return (
    <section className="block upload-block">
      <DesignIcon name="upload" size={42} />
      <h2>{block.heading}</h2>
      <p>{block.text}</p>
      <div className="upload-actions">
        {block.items?.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() =>
              onNavigate(
                block.heading?.includes("图片") ? "ai-drafts" : "mapping",
              )
            }
          >
            <DesignIcon name={item.icon ?? "plus"} size={18} />
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}
function ComparisonBlock({ block }: BlockProps): React.JSX.Element {
  return (
    <section className="block comparison-block">
      {block.items?.map((item) => (
        <article key={item.label}>
          <small>{item.label}</small>
          <strong>{item.value}</strong>
          <p>{item.note}</p>
          <span>
            查看原始依据 <DesignIcon name="chevron" size={14} />
          </span>
        </article>
      ))}
    </section>
  );
}
function ChoiceBlock({ block, onNavigate }: BlockProps): React.JSX.Element {
  return (
    <section className="block choices-block">
      {block.heading ? <h2>{block.heading}</h2> : null}
      <div className="chips">
        {block.items?.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`chip ${item.selected ? "is-selected" : ""}`}
            aria-pressed={Boolean(item.selected)}
            onClick={() => (item.target ? onNavigate(item.target) : undefined)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}
function ProgressBlock({ block }: BlockProps): React.JSX.Element {
  const progress = Number(block.value ?? "0");
  return (
    <section className="block progress-block">
      {block.heading ? <h2>{block.heading}</h2> : null}
      <progress
        max={100}
        value={progress}
        aria-label={block.heading ?? "操作进度"}
      />
      <p>{block.caption}</p>
    </section>
  );
}
function MappingBlock({ block }: BlockProps): React.JSX.Element {
  return (
    <section className="block mapping-block">
      {block.items?.map((item) => (
        <div key={item.label}>
          <span>
            <strong>{item.label}</strong>
            <small>{item.note}</small>
          </span>
          <label>
            <span className="sr-only">{item.label}对应的原始列</span>
            <select defaultValue={item.value}>
              <option>{item.value}</option>
              <option>暂不设置</option>
            </select>
            <DesignIcon name="chevron" size={14} />
          </label>
        </div>
      ))}
    </section>
  );
}
const BLOCKS: Record<
  BlockProps["block"]["kind"],
  (props: BlockProps) => React.JSX.Element
> = {
  list: ListBlock,
  fields: FieldsBlock,
  metrics: MetricsBlock,
  notice: NoticeBlock,
  image: ImageBlock,
  upload: UploadBlock,
  comparison: ComparisonBlock,
  choices: ChoiceBlock,
  progress: ProgressBlock,
  mapping: MappingBlock,
  chart: VisualChart,
  calendar: MonthCalendar,
  keypad: NumericPad,
  themes: ThemeTiles,
};
export function VisualBlocks({
  blocks,
  onNavigate,
  mode = "mobile",
}: {
  mode?: DesignMode;
  blocks: BlockProps["block"][];
  onNavigate: BlockProps["onNavigate"];
}): React.JSX.Element {
  return (
    <>
      {blocks.map((sourceBlock) => {
        const block = blockForMode(sourceBlock, mode);
        const Block = BLOCKS[block.kind];
        return (
          <Block key={blockKey(block)} block={block} onNavigate={onNavigate} />
        );
      })}
    </>
  );
}
