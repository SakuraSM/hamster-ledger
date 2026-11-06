import { useSceneConfirmation } from "./useSceneConfirmation";
import { DesignIcon } from "./icons";
import { LOGO, type SceneBodyProps } from "./model";
import { SceneActions, SceneBody } from "./SceneShell";
export function DesktopAuthScene(props: SceneBodyProps): React.JSX.Element {
  const confirmation = useSceneConfirmation(props.scene);
  return (
    <section
      className="design-scene desktop-scene desktop-auth auth-layout"
      data-scene={props.scene.id}
      onChange={confirmation.onFormChange}
      aria-label={`${props.scene.title}桌面视觉稿`}
    >
      <aside className="auth-brand-panel">
        <button
          type="button"
          className="auth-brand-link"
          onClick={() => props.onNavigate("welcome")}
        >
          <img src={LOGO} alt="仓鼠记账" />
          <b>仓鼠记账</b>
        </button>
        <div className="auth-brand-copy">
          <span>HAMSTER LEDGER</span>
          <h2>
            把每一笔，
            <br />
            存进小日子。
          </h2>
          <p>
            从今天的收支，到未来的计划，
            <br />
            给生活留一本清楚的账。
          </p>
          <div className="auth-brand-points">
            <span>
              <DesignIcon name="book" size={20} />
              可以先从本机开始
            </span>
            <span>
              <DesignIcon name="shield" size={20} />
              由你决定如何保存与同步
            </span>
          </div>
        </div>
        <small>记录生活，也为未来留一点余量。</small>
      </aside>
      <main className="desktop-main auth-form-panel">
        <SceneBody {...props} />
        <SceneActions {...props} canProceed={confirmation.canProceed} />
      </main>
    </section>
  );
}
