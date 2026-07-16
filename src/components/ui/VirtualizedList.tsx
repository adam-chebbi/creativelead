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
  type RowProps = Record<string, never>;
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties; }) => (
    <div style={style}>{renderItem(index, style)}</div>
  ), [renderItem]);

  return (
    <div style={{ height, overflow: 'hidden' }} className={className}>
      <List<RowProps>
        rowCount={items.length}
        rowHeight={rowHeight}
        rowComponent={Row}
        rowProps={{}}
        overscanCount={overscanCount}
        style={{ height: '100%' }}
      />
    </div>
  );
}
