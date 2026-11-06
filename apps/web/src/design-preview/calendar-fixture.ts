const GRID_CELL_COUNT = 42;
const GRID_START_DATE = "2026-10-26T00:00:00Z";
const MILLISECONDS_PER_DAY = 86400000;
const DATE_KEY_LENGTH = 10;
const DAY_OFFSET = 8;
export const DESIGN_MONTH = "2026-11";
export const DESIGN_TODAY = "2026-11-06";
export const NOVEMBER_DAYS = Array.from(
  { length: GRID_CELL_COUNT },
  (_value, index) => {
    const date = new Date(
      Date.parse(GRID_START_DATE) + index * MILLISECONDS_PER_DAY,
    )
      .toISOString()
      .slice(0, DATE_KEY_LENGTH);
    return {
      date,
      day: Number(date.slice(DAY_OFFSET)),
      isCurrentMonth: date.startsWith(DESIGN_MONTH),
      isToday: date === DESIGN_TODAY,
    };
  },
);
export const NOVEMBER_AMOUNTS: Record<number, string> = {
  1: "100",
  2: "220",
  3: "84",
  4: "310",
  5: "516.4",
  6: "56",
};
export const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
