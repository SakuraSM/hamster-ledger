// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "./helpers/render";
import { SavedFilters as WebSavedFilters } from "../apps/web/src/components/finance/SavedFilters";

vi.mock("@hamster-ledger/ledger-react", () => ({
  useSavedFilters: () => ({
    ready: true,
    presets: [],
    error: "",
    save: vi.fn(),
    remove: vi.fn(),
  }),
}));
vi.mock("../apps/web/src/platform/browser/vault", () => ({
  protectedStore: {},
}));
afterEach(cleanup);

it("applies the pending filter from the Web shortcut", () => {
  const onApply = vi.fn();
  render(
    <WebSavedFilters
      bookId="web:personal"
      filter={{}}
      position={0}
      onApply={onApply}
      restoreLast={false}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "待报销" }));
  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      position: 0,
      filter: expect.objectContaining({ reimbursement: "pending" }),
    }),
  );
});
