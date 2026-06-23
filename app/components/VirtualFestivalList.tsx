"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
} from "react";
import { List, useListRef } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
import FestivalCard from "./FestivalCard";
import type { Festival } from "../../lib/types";
import type { Language } from "../../lib/i18n";

// ── Virtual item types ────────────────────────────────────────────────────────

export type VirtualHeader = {
  type: "header";
  label: string;
  count: number;
  isHot: boolean;
};

export type VirtualCard = {
  type: "card";
  festival: Festival;
  listIndex: number; // position within its group/flat list (for FestivalCard index prop)
};

type Spacer = { type: "spacer" };

export type VirtualItem = VirtualHeader | VirtualCard;
type VirtualItemOrSpacer = VirtualItem | Spacer;

// ── Item heights (measured in DOM, including 10px gap between items) ───────────
//
// Measured from the live page:
//   card with submission_deadline:  322px + 10px gap = 332
//   card without deadline:          293px + 10px gap = 303
//   group section header:            29px + 10px gap =  39
//   first item extra top padding (py-3):               +12
//   bottom spacer (pb-12):                              48

const GAP             = 10;
const CARD_H          = 293 + GAP;   // 303
const CARD_DEADLINE_H = 322 + GAP;   // 332
const HEADER_H        = 29  + GAP;   // 39
const TOP_PAD         = 12;
const BOTTOM_PAD      = 48;

function getItemHeight(item: VirtualItemOrSpacer, index: number): number {
  if (item.type === "spacer") return BOTTOM_PAD;
  const base =
    item.type === "header"
      ? HEADER_H
      : item.festival.submission_deadline
      ? CARD_DEADLINE_H
      : CARD_H;
  return index === 0 ? base + TOP_PAD : base;
}

// ── GroupHeader (local copy — VirtualFestivalList is self-contained) ──────────

function GroupHeader({
  label,
  count,
  isHot,
}: {
  label: string;
  count: number;
  isHot: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-1 pt-2 pb-1">
      <span
        style={{
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.07em",
          color: isHot ? "#DC2626" : "var(--text-muted)",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {isHot && <span style={{ marginRight: 4 }}>●</span>}
        {label}
      </span>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 500,
          padding: "1px 6px",
          borderRadius: 99,
          background: isHot ? "rgba(220,38,38,0.08)" : "rgba(0,0,0,0.05)",
          color: isHot ? "#DC2626" : "var(--text-muted)",
        }}
      >
        {count}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

// ── Row data (passed to all rows via rowProps) ────────────────────────────────

type RowDataProps = {
  items: VirtualItemOrSpacer[];
  hoveredId: number | null;
  hasSomeHover: boolean;
  userId: string | null;
  savedIds: number[];
  lang: Language;
  isPremium: boolean | null;
  onHoverChange: (id: number | null) => void;
};

// ── Row component (react-window v2 signature) ─────────────────────────────────
//
// react-window v2 spreads rowProps into the row component props alongside
// the fixed ariaAttributes, index, and style fields.

type RowProps = {
  ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
  index: number;
  style: React.CSSProperties;
} & RowDataProps;

function Row({
  ariaAttributes,
  index,
  style,
  items,
  hoveredId,
  hasSomeHover,
  userId,
  savedIds,
  lang,
  isPremium,
  onHoverChange,
}: RowProps) {
  const item = items[index];

  // Spacer at bottom — just empty space (pb-12 equivalent)
  if (item.type === "spacer") {
    return <div style={style} />;
  }

  const rowStyle: React.CSSProperties = {
    ...style,
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: GAP,
    paddingTop: index === 0 ? TOP_PAD : 0,
    boxSizing: "border-box",
  };

  if (item.type === "header") {
    return (
      <div {...ariaAttributes} style={rowStyle}>
        <GroupHeader label={item.label} count={item.count} isHot={item.isHot} />
      </div>
    );
  }

  const { festival, listIndex } = item;
  return (
    <div
      {...ariaAttributes}
      style={rowStyle}
      onMouseEnter={() => onHoverChange(festival.id)}
      onMouseLeave={() => onHoverChange(null)}
    >
      <FestivalCard
        festival={festival}
        index={listIndex}
        lang={lang}
        isActive={hoveredId === festival.id}
        isDimmed={hasSomeHover && hoveredId !== festival.id}
        userId={userId}
        initialSaved={savedIds.includes(festival.id)}
        isPremium={isPremium}
      />
    </div>
  );
}

// ── Public ref handle ─────────────────────────────────────────────────────────

export type VirtualFestivalListHandle = {
  scrollToFestival: (id: number) => void;
};

// ── Main component ────────────────────────────────────────────────────────────

const VirtualFestivalList = forwardRef<
  VirtualFestivalListHandle,
  {
    items: VirtualItem[];
    hoveredId: number | null;
    hasSomeHover: boolean;
    userId: string | null;
    savedIds: number[];
    lang: Language;
    isPremium: boolean | null;
    onHoverChange: (id: number | null) => void;
  }
>(function VirtualFestivalList(
  { items, hoveredId, hasSomeHover, userId, savedIds, lang, isPremium, onHoverChange },
  ref,
) {
  const listRef = useListRef(null);

  // Append a spacer row to provide pb-12 equivalent bottom padding.
  const itemsWithSpacer = useMemo<VirtualItemOrSpacer[]>(
    () => [...items, { type: "spacer" }],
    [items],
  );

  // O(1) lookup: festival.id → virtual list index (for scroll-to-festival)
  const festivalIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type === "card") map.set(item.festival.id, i);
    }
    return map;
  }, [items]);

  // Reset scroll to top when the item list changes (filter/sort change).
  useEffect(() => {
    listRef.current?.scrollToRow({ index: 0, behavior: "instant" });
  }, [items, listRef]);

  useImperativeHandle(ref, () => ({
    scrollToFestival(id: number) {
      const idx = festivalIndexMap.get(id);
      if (idx !== undefined) {
        listRef.current?.scrollToRow({ index: idx, align: "smart", behavior: "smooth" });
      }
    },
  }));

  // rowHeight receives rowProps so it can look up items[index].
  // react-window v2 does NOT cache predetermined heights, so no reset needed
  // when items change — the function is called fresh each layout pass.
  const rowHeight = useCallback(
    (index: number, rp: RowDataProps) => getItemHeight(rp.items[index], index),
    [],
  );

  // rowProps is recreated when hoveredId changes; react-window only passes it
  // to visible rows (~3–9 at a time), keeping re-render scope minimal.
  const rowProps = useMemo<RowDataProps>(
    () => ({ items: itemsWithSpacer, hoveredId, hasSomeHover, userId, savedIds, lang, isPremium, onHoverChange }),
    [itemsWithSpacer, hoveredId, hasSomeHover, userId, savedIds, lang, isPremium, onHoverChange],
  );

  return (
    <AutoSizer
      renderProp={({ height, width }) =>
        height == null || width == null ? null : (
          <List
            listRef={listRef}
            rowCount={itemsWithSpacer.length}
            rowHeight={rowHeight}
            rowComponent={Row}
            rowProps={rowProps}
            overscanCount={3}
            style={{ height, width }}
          />
        )
      }
    />
  );
});

export default VirtualFestivalList;
