import { useCallback, useReducer } from "react";
import type { AppTool } from "./AuxiliaryPages";
export interface ToolHistoryEntry {
  id: number;
  page: AppTool;
}
interface ToolHistoryState {
  entries: ToolHistoryEntry[];
  nextId: number;
}
type Action =
  { type: "open"; page: AppTool } | { type: "back" } | { type: "clear" };
function reducer(state: ToolHistoryState, action: Action): ToolHistoryState {
  if (action.type === "open")
    return {
      entries: [...state.entries, { id: state.nextId, page: action.page }],
      nextId: state.nextId + 1,
    };
  if (action.type === "clear") return { ...state, entries: [] };
  return { ...state, entries: state.entries.slice(0, -1) };
}
export function useToolHistory(): {
  entries: ToolHistoryEntry[];
  current: AppTool | null;
  open: (page: AppTool) => void;
  back: () => void;
  clear: () => void;
} {
  const [state, dispatch] = useReducer(reducer, { entries: [], nextId: 0 });
  const open = useCallback(
    (page: AppTool) => dispatch({ type: "open", page }),
    [],
  );
  const back = useCallback(() => dispatch({ type: "back" }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);
  return {
    entries: state.entries,
    current: state.entries[state.entries.length - 1]?.page ?? null,
    open,
    back,
    clear,
  };
}
