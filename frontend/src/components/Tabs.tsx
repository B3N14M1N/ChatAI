import type { FC, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import './Tabs.css';

export interface TabItem {
  id: string;
  label: string;
  render: () => ReactNode;
}

interface TabsProps {
  items: TabItem[];
  initialId?: string;
}

const Tabs: FC<TabsProps> = ({ items, initialId }) => {
  const [active, setActive] = useState<string>(initialId ?? items[0]?.id);
  const activeItem = useMemo(() => items.find(i => i.id === active) ?? items[0], [items, active]);

  return (
    <div className="tabs">
      <div className="tabs-header" role="tablist">
        <div className="tab-bar">
          {items.map(i => (
            <button
              key={i.id}
              role="tab"
              aria-selected={active === i.id}
              className={`tab-pill ${active === i.id ? 'active' : ''}`}
              onClick={() => setActive(i.id)}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>
      <div className="tabs-body">
        {activeItem?.render()}
      </div>
    </div>
  );
};

export default Tabs;
