import { isAuthScene, bookName } from "./view-context";
import { useSceneConfirmation } from "./useSceneConfirmation";
import { supportsTarget } from "./platforms";
import { AssetsOverview, AccountDetailScene } from "./AssetWorkspace";
import type { SceneBodyProps, IconName } from "./model";
import { LOGO } from "./model";
import { DesignIcon } from "./icons";
import { VisualBlocks } from "./blocks";
import { ReceiptScene } from "./ReceiptScene";
const NAV_ITEMS: Array<{
  id: string;
  label: string;
  icon: IconName;
  target: string;
}> = [
  { id: "inbox", label: "待处理", icon: "receipt", target: "inbox" },
  { id: "ledger", label: "账单", icon: "book", target: "transactions" },
  { id: "mine", label: "资产", icon: "wallet", target: "assets" },
];
export function SceneHeader({
  scene,
  onNavigate,
}: SceneBodyProps): React.JSX.Element {
  return (
    <header className="scene-header">
      <button
        type="button"
        className="brand"
        onClick={() => onNavigate(isAuthScene(scene) ? "welcome" : "books")}
      >
        <img src={LOGO} alt="仓鼠记账" />
        <span>
          <b>仓鼠记账</b>
          <small>
            {isAuthScene(scene)
              ? "把每一笔，存进小日子"
              : `${bookName(scene)} · 示例`}{" "}
            {!isAuthScene(scene) ? (
              <DesignIcon name="chevron" size={12} />
            ) : null}
          </small>
        </span>
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={isAuthScene(scene) ? "返回入口" : "打开工具"}
        onClick={() => onNavigate(isAuthScene(scene) ? "welcome" : "tools")}
      >
        <DesignIcon name="book" size={24} />
      </button>
    </header>
  );
}
export function SceneHeading({
  scene,
}: Pick<SceneBodyProps, "scene">): React.JSX.Element {
  return (
    <div className="scene-heading">
      <div>
        <h1>{scene.title}</h1>
        <p>{scene.subtitle}</p>
      </div>
      {scene.counter ? (
        <span className="heading-counter">{scene.counter}</span>
      ) : null}
    </div>
  );
}
export function SceneActions({
  scene,
  onNavigate,
  mode,
  canProceed = true,
}: SceneBodyProps & { canProceed?: boolean }): React.JSX.Element {
  return (
    <div className="scene-actions">
      {scene.actions
        .filter((action) => supportsTarget(action.target, mode))
        .map((action) => (
          <button
            type="button"
            className={action.secondary ? "secondary-action" : "primary-action"}
            key={action.label}
            disabled={!action.secondary && !canProceed}
            onClick={() => onNavigate(action.target)}
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
export function SceneNavigation({
  scene,
  onNavigate,
}: SceneBodyProps): React.JSX.Element {
  return (
    <nav className="scene-navigation" aria-label="应用主导航">
      {NAV_ITEMS.map((item) => (
        <button
          type="button"
          key={item.id}
          aria-current={scene.nav === item.id ? "page" : undefined}
          className={scene.nav === item.id ? "active" : ""}
          onClick={() => onNavigate(item.target)}
        >
          <DesignIcon name={item.icon} size={24} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
function GenericBody({
  scene,
  onNavigate,
  mode,
}: SceneBodyProps): React.JSX.Element {
  return (
    <>
      <SceneHeading scene={scene} />
      {scene.layout === "state" ? (
        <div className="state-symbol">
          <DesignIcon
            name={
              scene.id.includes("error")
                ? "warning"
                : scene.id === "loading"
                  ? "clock"
                  : "check"
            }
            size={54}
          />
        </div>
      ) : null}
      {scene.hero ? (
        <section className="scene-hero">
          <small>{scene.heroLabel}</small>
          <strong>{scene.hero}</strong>
        </section>
      ) : null}
      <VisualBlocks blocks={scene.blocks} onNavigate={onNavigate} mode={mode} />
    </>
  );
}
function ReceiptBody(props: SceneBodyProps): React.JSX.Element {
  return (
    <>
      <SceneHeading scene={props.scene} />
      <ReceiptScene {...props} />
    </>
  );
}
const BODY_COMPONENTS: Partial<
  Record<
    NonNullable<SceneBodyProps["scene"]["layout"]>,
    (props: SceneBodyProps) => React.JSX.Element
  >
> = {
  assets: AssetsOverview,
  account: AccountDetailScene,
  receipt: ReceiptBody,
};
export function SceneBody(props: SceneBodyProps): React.JSX.Element {
  const Body = BODY_COMPONENTS[props.scene.layout ?? "standard"] ?? GenericBody;
  return <Body {...props} />;
}
export function MobileScene(props: SceneBodyProps): React.JSX.Element {
  const { scene } = props;
  const confirmation = useSceneConfirmation(scene);
  return (
    <section
      className={`design-scene mobile-scene ${scene.layout ?? "standard"}-layout ${scene.night ? "night-theme" : ""}`}
      onChange={confirmation.onFormChange}
      data-scene={scene.id}
      aria-label={`${scene.title}手机视觉稿`}
    >
      <SceneHeader {...props} />
      <main className="scene-main">
        <SceneBody {...props} />
      </main>
      <SceneActions {...props} canProceed={confirmation.canProceed} />
      {!isAuthScene(scene) ? (
        <SceneNavigation {...props} />
      ) : (
        <p className="auth-footer">你的账，按你的节奏。</p>
      )}
    </section>
  );
}
