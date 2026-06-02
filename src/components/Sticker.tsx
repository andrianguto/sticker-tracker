import React from 'react';
import { AlbumState } from '../types';
import { stickerCount, getName } from '../hooks/useStickers';

interface StickerProps {
  id: string;
  state: AlbumState;
  onTap: (id: string) => void;
  dim?: boolean;
}

export const Sticker: React.FC<StickerProps> = ({ id, state, onTap, dim }) => {
  const c = stickerCount(state, id);
  const have = c >= 1;
  const dup = c >= 2;
  const name = getName(state, id);
  const num = id.split("-")[1] || id;

  return (
    <button
      className={`sticker${have ? " have" : ""}${dup ? " dup" : ""}${dim ? " dim" : ""}`}
      onClick={() => onTap(id)}
      aria-label={id + (name ? ` ${name}` : "")}
      title={name || id}
    >
      <span className="snum">{num}</span>
      {name && <span className="sname">{name}</span>}
      {dup && <span className="dup-badge">+{c - 1}</span>}
    </button>
  );
};
