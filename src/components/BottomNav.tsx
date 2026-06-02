import React from 'react';

interface BottomNavProps {
  tab: string;
  setTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ tab, setTab }) => {
  const items = [
    { id: "album", ic: "▦", label: "Album" },
    { id: "missing", ic: "✦", label: "Missing" },
    { id: "dupes", ic: "⇄", label: "Dupes" },
    { id: "stats", ic: "◔", label: "Stats" },
  ];

  return (
    <nav className="bottomnav">
      <div className="inner">
        {items.map(it => (
          <button 
            key={it.id} 
            className={tab === it.id ? "active" : ""}
            onClick={() => { setTab(it.id); window.scrollTo({ top: 0 }); }}
          >
            <span className="ic">{it.ic}</span>{it.label}
          </button>
        ))}
      </div>
    </nav>
  );
};
