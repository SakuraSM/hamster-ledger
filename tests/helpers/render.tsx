import type { ReactElement, ReactNode } from "react";
import {
  render as testingRender,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { LedgerUIProvider } from "../../apps/web/src/ui/theme";
export * from "@testing-library/react";
export function render(
  ui: ReactElement,
  options: RenderOptions = {},
): RenderResult {
  const Wrapper = options.wrapper;
  return testingRender(ui, {
    ...options,
    wrapper: ({ children }: { children: ReactNode }) => (
      <LedgerUIProvider test>
        {Wrapper ? <Wrapper>{children}</Wrapper> : children}
      </LedgerUIProvider>
    ),
  });
}
