import tokens from "@hamster-ledger/design-tokens/tokens.json";
/** Recursively split the available area. Labels below the map stay readable for tiny segments. */
export function CompositionMap({
  groups,
}: {
  groups: { label: string; value: number }[];
}) {
  const total = groups.reduce((s, g) => s + g.value, 0);
  let x = 0,
    y = 0,
    w = 100,
    h = 100,
    left = total;
  return (
    <div className="atlas-map" aria-hidden="true">
      {groups.map((g, i) => {
        const share = g.value / left,
          horizontal = w * 2 >= h;
        const width = horizontal ? w * share : w,
          height = horizontal ? h : h * share;
        const style = {
          left: x + "%",
          top: y + "%",
          width: width + "%",
          height: height + "%",
          backgroundColor:
            tokens.chart.categories[i % tokens.chart.categories.length],
        };
        if (horizontal) {
          x += width;
          w -= width;
        } else {
          y += height;
          h -= height;
        }
        left -= g.value;
        return (
          <div key={g.label} style={style}>
            {width > 22 && height > 33 ? (
              <>
                <span>{g.label}</span>
                <b>{((100 * g.value) / total).toFixed(1)}%</b>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
