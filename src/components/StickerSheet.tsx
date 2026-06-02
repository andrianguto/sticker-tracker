import React, { useState, useEffect } from 'react';
import { AlbumState } from '../types';
import { stickerCount, getName } from '../hooks/useStickers';
import { ALL_TEAMS } from '../data';

interface StickerSheetProps {
  id: string | null;
  state: AlbumState;
  onClose: () => void;
  onSet: (id: string, count: number) => void;
  onName: (id: string, name: string) => void;
}

export const StickerSheet: React.FC<StickerSheetProps> = ({ id, state, onClose, onSet, onName }) => {
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    if (id) {
      setNameDraft(getName(state, id));
    }
  }, [id, state]);

  if (!id) return null;

  const c = stickerCount(state, id);
  const have = c >= 1;
  const dup = Math.max(0, c - 1);
  const teamCode = id.startsWith("FWC") ? "FWC" : id.split("-")[0];
  const team = ALL_TEAMS.find(t => t.code === teamCode);
  const subtitle = team ? `${team.flag} ${team.name}` : "Special sticker";

  const commitName = () => {
    const stored = getName(state, id);
    if (nameDraft.trim() !== stored) {
      onName(id, nameDraft);
    }
  };

  return (
    <div className="sheet-back" onClick={() => { commitName(); onClose(); }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grip"></div>
        <div className="sheet-id">{id}</div>
        <div className="sheet-sub">{subtitle}</div>

        <div className="sheet-actions">
          <button className={`b${!have ? " active" : ""}`} onClick={() => onSet(id, 0)}>
            <span style={{ fontSize: 18 }}>○</span>
            Need it
            <small>missing</small>
          </button>
          <button className={`b${have && !dup ? " active" : ""}`} onClick={() => onSet(id, 1)}>
            <span style={{ fontSize: 18 }}>✓</span>
            Got it
            <small>in album</small>
          </button>
        </div>

        <div className="dup-stepper">
          <div className="lbl">Duplicates {dup > 0 ? `(${dup})` : ""}</div>
          <div className="controls">
            <button 
              className="step" 
              onClick={() => onSet(id, Math.max(1, c - 1))} 
              disabled={c < 2}
            >−</button>
            <span className="num">{dup}</span>
            <button className="step" onClick={() => onSet(id, Math.max(2, c + 1))}>+</button>
          </div>
        </div>

        <div className="name-field">
          <label>Player / sticker name <span className="opt">(optional, searchable)</span></label>
          <input
            type="text"
            placeholder="e.g. Lionel Messi"
            value={nameDraft}
            maxLength={40}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { 
              if (e.key === "Enter") { 
                commitName(); 
                onClose(); 
              } 
            }}
          />
        </div>
      </div>
    </div>
  );
};
export default StickerSheet;
