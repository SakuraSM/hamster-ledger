import type { ReactNode } from "react";
import { Icons } from "../Icons";
export function AuthLayout({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <main className="auth-layout">
      <aside className="auth-story">
        <a className="auth-brand" href="/">
          <img src="/assets/hamster-logo.png" alt="" width="52" height="52" />
          <strong>仓鼠记账</strong>
        </a>
        <div className="auth-story-copy">
          <img src="/assets/hamster-logo.png" alt="" width="112" height="112" />
          <h2>
            把每一笔，
            <br />
            存进小日子。
          </h2>
          <p>
            从今天的收支，到未来的计划，
            <br />
            给自己的生活一本清楚的账。
          </p>
          <div className="auth-benefits">
            <div>
              <Icons.Book size={22} />
              <span>收支、预算与资产，一起理清</span>
            </div>
            <div>
              <Icons.Shield size={22} />
              <span>本机保存，由你决定是否同步</span>
            </div>
          </div>
        </div>
        <p className="auth-story-footer">仓鼠记账 · 认真记录，慢慢积累</p>
      </aside>
      <section className="auth-main">
        <div className="auth-form-wrap">{children}</div>
        <p className="auth-footer">账号密码用于同步，本机解锁密码独立保存。</p>
      </section>
    </main>
  );
}
