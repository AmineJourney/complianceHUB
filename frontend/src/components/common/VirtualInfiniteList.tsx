/* eslint-disable react-hooks/incompatible-library */
import { useVirtualizer, VirtualItem } from "@tanstack/react-virtual";
import { useRef, useMemo, useEffect, ReactNode } from "react";

interface Page<T> {
  results: T[];
}

interface VirtualInfiniteListProps<T> {
  pages?: Page<T>[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage: () => void;

  estimateSize?: number;
  overscan?: number;
  height?: number | string;

  isLoading?: boolean;
  emptyState?: ReactNode;

  renderItem: (item: T, index: number) => ReactNode;
}

export function VirtualInfiniteList<T>({
  pages,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  estimateSize = 120,
  overscan = 5,
  height = 400,
  isLoading,
  emptyState,
  renderItem,
}: VirtualInfiniteListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Flatten paginated results
  const items = useMemo(() => {
    return pages?.flatMap((p) => p.results) ?? [];
  }, [pages]);

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  // Infinite scroll trigger
  useEffect(() => {
    const virtualItems = rowVirtualizer.getVirtualItems();
    const lastItem = virtualItems[virtualItems.length - 1];

    if (!lastItem) return;

    if (
      lastItem.index >= items.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    rowVirtualizer,
    items.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-6">Loading...</div>
    );
  }

  if (!items.length) {
    return <>{emptyState}</>;
  }

  return (
    <div ref={parentRef} className="overflow-y-auto w-full" style={{ height }}>
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow: VirtualItem) => {
          const item = items[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>

      {isFetchingNextPage && (
        <div className="flex justify-center py-4 text-sm text-gray-500">
          Loading more...
        </div>
      )}
    </div>
  );
}
