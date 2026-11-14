import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { parseCsv } from "../materials/parseCsv";

const numberPattern = /^-?\d+(\.\d+)?$/;

// Pinned columns may take at most this share of the visible width, otherwise
// on a phone there would be no room left for the columns being scrolled.
const maxPinnedShare = 0.6;

export function CsvTableView({ text, caption }: { text: string; caption: string }) {
  const table = useMemo(() => parseCsv(text), [text]);
  const boxRef = useRef<HTMLDivElement>(null);
  const headerCellRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  // Left offset of each pinned column; first column is always pinned.
  const [pinnedOffsets, setPinnedOffsets] = useState<number[]>([0]);

  // Right-align columns where every filled value is a number, so digits line up.
  const numericColumns = useMemo(
    () =>
      table.header.map((_, columnIndex) => {
        const values = table.rows.map((row) => row[columnIndex]).filter((value) => value !== "");
        return values.length > 0 && values.every((value) => numberPattern.test(value));
      }),
    [table],
  );

  // Column widths are only known after render, and change with the box width.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      // Rounded down: a sub-pixel gap between pinned columns lets scrolled text show through.
      const firstWidth = Math.floor(headerCellRefs.current[0]?.getBoundingClientRect().width ?? 0);
      const secondWidth = Math.floor(headerCellRefs.current[1]?.getBoundingClientRect().width ?? 0);
      const pinTwo = secondWidth > 0 && firstWidth + secondWidth <= box.clientWidth * maxPinnedShare;
      setPinnedOffsets(pinTwo ? [0, firstWidth] : [0]);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [table]);

  if (table.header.length === 0) {
    return <p className="text-ink-muted">Soubor je prázdný.</p>;
  }

  const isPinned = (columnIndex: number) => columnIndex < pinnedOffsets.length;
  const pinnedStyle = (columnIndex: number): CSSProperties | undefined =>
    isPinned(columnIndex) ? { position: "sticky", left: pinnedOffsets[columnIndex] } : undefined;
  // A thin line after the last pinned column shows where scrolling content slides under.
  const pinnedEdge = (columnIndex: number) =>
    columnIndex === pinnedOffsets.length - 1 ? "shadow-[1px_0_0_var(--color-line)]" : "";

  return (
    // The table scrolls inside its own box so the page itself never scrolls sideways on a phone.
    // Focusable so the table can be scrolled with the keyboard; a focusable box needs a name for screen readers.
    <div
      ref={boxRef}
      role="region"
      aria-label={`Tabulka: ${caption}`}
      className="rl-scroll-box max-h-[70vh] overflow-auto border border-line rounded-control bg-surface"
      tabIndex={0}
    >
      <table className="text-sm border-separate border-spacing-0 tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {table.header.map((column, columnIndex) => (
              <th
                key={column}
                ref={(cell) => {
                  headerCellRefs.current[columnIndex] = cell;
                }}
                scope="col"
                style={pinnedStyle(columnIndex)}
                className={`sticky top-0 bg-surface border-b border-line px-3 py-2 font-semibold whitespace-nowrap ${ numericColumns[columnIndex] ?"text-right" : "text-left"
                } ${isPinned(columnIndex) ? "z-20" : "z-10"} ${pinnedEdge(columnIndex)}`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((value, columnIndex) => (
                <td
                  key={columnIndex}
                  style={pinnedStyle(columnIndex)}
                  className={`px-3 py-1.5 whitespace-nowrap border-b border-line ${ numericColumns[columnIndex] ?"text-right" : ""
                  } ${isPinned(columnIndex) ? "bg-surface z-0" : ""} ${pinnedEdge(columnIndex)}`}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sr-only">{table.rows.length} řádků</p>
    </div>
  );
}
