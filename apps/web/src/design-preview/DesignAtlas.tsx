import { SELECTED_DIRECTION } from "./assets";
import { useMemo, useState } from "react";
import { SCENES, getScene, scenesForMode } from "./catalog";
import { DesktopScene } from "./DesktopScene";
import { DesignIcon } from "./icons";
import { LOGO, type DesignMode, type SceneSpec } from "./model";
import { MobileScene } from "./SceneShell";
const FRAME_NUMBER_WIDTH = 2;
interface DesignAtlasProps {
  sceneId: string;
  mode: DesignMode;
  onNavigate: (id: string) => void;
  onMode: (mode: DesignMode) => void;
}
function PreviewScene({
  scene,
  mode,
  onNavigate,
}: {
  scene: SceneSpec;
  mode: DesignMode;
  onNavigate: (id: string) => void;
}): React.JSX.Element {
  return mode === "mobile" ? (
    <MobileScene
      key={scene.id}
      scene={scene}
      mode={mode}
      onNavigate={onNavigate}
    />
  ) : (
    <DesktopScene
      key={scene.id}
      scene={scene}
      mode={mode}
      onNavigate={onNavigate}
    />
  );
}
export function DesignAtlas({
  sceneId,
  mode,
  onNavigate,
  onMode,
}: DesignAtlasProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const scene = getScene(sceneId);
  const visible = scenesForMode(mode).filter((item) =>
    `${item.title} ${item.group} ${item.id}`.includes(query.trim()),
  );
  const groups = useMemo(
    () => [...new Set(SCENES.map((item) => item.group))],
    [],
  );
  return (
    <div className="atlas">
      <aside className="atlas-index">
        <div className="atlas-logo">
          <img src={LOGO} alt="" />
          <span>
            <b>凭证接力</b>
            <small>仓鼠记账 · 全页面视觉稿</small>
          </span>
        </div>
        <div className="atlas-controls">
          <button
            className={mode === "mobile" ? "active" : ""}
            type="button"
            onClick={() => onMode("mobile")}
          >
            手机端
          </button>
          <button
            type="button"
            className={mode === "desktop" ? "active" : ""}
            onClick={() => onMode("desktop")}
          >
            桌面端
          </button>
        </div>
        <input
          className="atlas-search"
          aria-label="搜索视觉稿"
          placeholder="搜索页面 / 状态"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <nav className="atlas-groups" aria-label="视觉稿索引">
          {groups.map((group) => (
            <section className="atlas-group" key={group}>
              <h2>{group}</h2>
              {visible
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={item.id === scene.id ? "active" : ""}
                    onClick={() => onNavigate(item.id)}
                  >
                    <span>
                      {String(SCENES.indexOf(item) + 1).padStart(
                        FRAME_NUMBER_WIDTH,
                        "0",
                      )}
                    </span>
                    {item.title}
                  </button>
                ))}
            </section>
          ))}
        </nav>
        <div className="atlas-foot">
          选定方向：本轮第3张
          <br />
          {SCENES.length}个页面与状态 · {scenesForMode(mode).length}张
          {mode === "mobile" ? "手机" : "桌面"}稿<br />
          2026-11-06 · 全部使用虚构数据
        </div>
      </aside>
      <main className="atlas-work">
        <header className="atlas-toolbar">
          <div>
            <h1>{scene.title}</h1>
            <p>
              {scene.group} / {mode === "mobile" ? "390 × 844" : "1440 × 1024"}{" "}
              / {scene.id}
            </p>
          </div>
          <div className="atlas-toolbar-actions">
            <button
              type="button"
              onClick={() =>
                window.open(
                  `?raw=1&mode=${mode}&scene=${scene.id}`,
                  "_blank",
                  "noopener",
                )
              }
            >
              <DesignIcon name="eye" size={16} />
              纯画面
            </button>
            <button
              type="button"
              onClick={() => window.open(`?compare=1`, "_blank", "noopener")}
            >
              <DesignIcon name="image" size={16} />
              对照选定稿
            </button>
          </div>
        </header>
        <div className="atlas-stage">
          <PreviewScene
            key={`${mode}:${scene.id}`}
            scene={scene}
            mode={mode}
            onNavigate={onNavigate}
          />
          <aside className="atlas-notes">
            <span>DESIGN INTENT</span>
            <h2>{scene.title}</h2>
            <p>{scene.intent}</p>
            <p className="note-label">本页关注</p>
            <p>{scene.subtitle}</p>
            <p className="note-label">页面来源</p>
            {scene.sources.map((source) => (
              <span className="source-path" key={source}>
                {source}
              </span>
            ))}
            <p className="note-label">已选视觉方向</p>
            <img
              className="atlas-reference"
              src={SELECTED_DIRECTION}
              alt="用户选择的凭证接力方向原稿"
            />
            <p className="atlas-export-note">
              视觉稿中的各状态是独立示例。按钮可切换关联稿件，输入仅用于预览。数据不会提交到真实账本。
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
export function RawScene(props: DesignAtlasProps): React.JSX.Element {
  return (
    <PreviewScene
      scene={getScene(props.sceneId)}
      mode={props.mode}
      onNavigate={props.onNavigate}
    />
  );
}
export function ComparisonView({
  onNavigate,
}: Pick<DesignAtlasProps, "onNavigate">): React.JSX.Element {
  return (
    <main className="comparison-page">
      <figure>
        <figcaption>已选择的视觉方向 · 同比例显示</figcaption>
        <img src={SELECTED_DIRECTION} alt="凭证接力选定方向" />
      </figure>
      <figure>
        <figcaption>可导出的手机端视觉稿 · 390×844</figcaption>
        <div className="compare-capture">
          <MobileScene
            scene={getScene("inbox")}
            mode="mobile"
            onNavigate={onNavigate}
          />
        </div>
      </figure>
    </main>
  );
}
export function ContactSheet({
  ids,
  onNavigate,
}: {
  ids: string[];
  onNavigate: (id: string) => void;
}): React.JSX.Element {
  return (
    <main className="sheet-page">
      <h1 className="sheet-title">仓鼠记账 / 凭证接力</h1>
      <p className="sheet-subtitle">
        全页面视觉稿 · 2026-11-06 · 390×844 · 示例数据
      </p>
      <div className="contact-grid">
        {ids.map((id) => (
          <figure className="contact-item" key={id}>
            <MobileScene
              scene={getScene(id)}
              mode="mobile"
              onNavigate={onNavigate}
            />
            <figcaption>
              <b>{getScene(id).title}</b>
              <span>{id}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
