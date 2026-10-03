// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal, Button } from "@mantine/core";
import { render, screen, fireEvent, cleanup, waitFor } from "./helpers/render";
import { Dialog } from "../apps/web/src/components/Dialog";
afterEach(cleanup);
it("Escape closes a nested picker before its parent and restores focus to the opener", async () => {
  const closed = vi.fn();
  function Fixture(): React.JSX.Element {
    const [opened, setOpened] = useState(false);
    const [nested, setNested] = useState(false);
    return (
      <>
        <Button onClick={() => setOpened(true)}>打开编辑</Button>
        {opened ? (
          <Dialog
            title="账单编辑"
            onClose={() => {
              setOpened(false);
              closed();
            }}
          >
            <Button onClick={() => setNested(true)}>选择日期</Button>
            <Modal
              stackId="date-picker"
              opened={nested}
              title="日期选择"
              onClose={() => setNested(false)}
            >
              <p>日期内容</p>
            </Modal>
          </Dialog>
        ) : null}
      </>
    );
  }
  render(<Fixture />);
  const opener = screen.getByRole("button", { name: "打开编辑" });
  opener.focus();
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole("button", { name: "选择日期" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(2);
  fireEvent.keyDown(document.body, { key: "Escape" });
  await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
  expect(closed).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(closed).toHaveBeenCalledTimes(1));
  expect(document.activeElement).toBe(opener);
});
