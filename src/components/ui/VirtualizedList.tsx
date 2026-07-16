import React, { useCallback } from 'react';
import { List } from 'react-window';

interface VirtualizedListProps<ItemType> {
  items: ItemType[];
  height: number;
  rowHeight: number;
  renderItem: (index: number, style: React.CSSProperties) => React.ReactNode;
  overscanCount?: number;
  className?: string;
}

export function VirtualizedList<ItemType extends unknown>({
  items, height, rowHeight, renderItem, overscanCount = 5, className,
}: VirtualizedListProps<ItemType>) {
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties; }) => (
    <div style={style}>{renderItem(index, style)}</div>
  ), [renderItem]);

  return (
    <div style={{ height, overflow: 'hidden' }} className={className}>
      <List
        rowCount={items.length}
        rowHeight={rowHeight}
        rowComponent={Row}
        rowProps={undefined as any}
        overscanCount={overscanCount}
        style={{ height: '100%' }}
      />
    </div>
  );
}
