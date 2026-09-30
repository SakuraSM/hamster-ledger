# Repository guidance

## Product and design

- Product name: 仓鼠记账 / Hamster Ledger.
- Preserve the chosen sidebar, monthly summary, trend chart, categories and transaction table layout.
- Use the warm cream, brown and apricot theme. Use the generated hamster asset and the existing icon family.
- Keep demo data separate from personal data. Never commit real statements, credentials or personal filesystem paths.

## Architecture

- Web UI and browser adapters live in `apps/web`.
- Shared business logic lives in `packages/ledger-core`.
- Statement normalization lives in `packages/statement-importers`.
- Shared design values live in `packages/design-tokens`.
- Shared packages must not import browser, React, Node filesystem or native platform APIs.
- Side effects belong in platform adapters. Keep ledger schemas and storage keys backward compatible, or document and test an explicit migration.
- Do not create a placeholder native app. Follow `docs/mobile-readiness.md` when a target platform is chosen.

## Working protocol

- Use Node.js 22 or 24 and npm. Preserve the root lockfile.
- Branch names must not start with `codex`. Use the repository's `feat/`, `fix/`, `refactor/` or `docs/` convention.
- Run `npm run check` before submitting changes. Add behavior tests for money, imports, duplicate handling and storage failure paths.
- Keep components focused and respect the existing TypeScript and accessibility conventions.
- Do not overwrite unrelated workspace changes or reset user data during verification.
- Start and verify local previews when changing UI. A successful build is not browser QA.
- The optional Sites packaging files belong to `apps/web`; keep the Worker and packaging contract intact.
- Keep screenshots and design evidence under `docs/`. If a verification step is blocked, record the scope honestly instead of marking it passed.
