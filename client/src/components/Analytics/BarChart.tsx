/**
 * BarChart — horizontal bar chart used by Category/Department breakdowns.
 * Pure inline-SVG / Tailwind; no external chart lib.
 */
type Item = { label: string; value: number; sub?: string };

interface IProps {
  lsItems: Item[];
  strColor?: string;
  fnFormat?: (n: number) => string;
  strEmpty?: string;
}

export default function BarChart({
  lsItems,
  strColor = '#00703C',
  fnFormat = (n) => n.toLocaleString(),
  strEmpty = 'No data yet.',
}: IProps) {
  if (!lsItems || lsItems.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-6 cursor-default">{strEmpty}</p>;
  }
  const numMax = Math.max(...lsItems.map((x) => x.value), 1);
  return (
    <div className="space-y-2">
      {lsItems.map((objItem, i) => {
        const numPct = (objItem.value / numMax) * 100;
        return (
          <div key={`${objItem.label}-${i}`} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-gray-700 font-medium truncate pr-2 cursor-default" title={objItem.label}>
                {objItem.label}
              </span>
              <span className="text-gray-900 font-semibold tabular-nums cursor-default">
                {fnFormat(objItem.value)}
                {objItem.sub && <span className="text-gray-500 font-normal ml-1">{objItem.sub}</span>}
              </span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${numPct}%`, backgroundColor: strColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
