import React, { useMemo } from 'react';
import { AlbumState } from '../types';
import { isHave, dupCount } from '../hooks/useStickers';
import { allStickerIds, TOTAL_STICKERS, GROUPS, FWC_FRONT, FWC_BACK } from '../data';

interface StatsViewProps {
  state: AlbumState;
  activeUser: string;
  onLogout: () => void;
  onReset: () => void;
  onReplayOnboarding: () => void;
}

export const StatsView: React.FC<StatsViewProps> = ({ 
  state, 
  activeUser, 
  onLogout, 
  onReset, 
  onReplayOnboarding 
}) => {
  const haveCount = useMemo(() => allStickerIds().filter(id => isHave(state, id)).length, [state]);
  const dupTotal  = useMemo(() => allStickerIds().reduce((a, id) => a + dupCount(state, id), 0), [state]);
  const pct = Math.round((haveCount / TOTAL_STICKERS) * 100);

  const R = 42;
  const C = 2 * Math.PI * R;
  const dash = `${(pct / 100) * C} ${C}`;

  const groupStats = GROUPS.map(g => {
    const ids = g.teams.flatMap(t => Array.from({ length: 20 }, (_, i) => `${t.code}-${i + 1}`));
    const have = ids.filter(id => isHave(state, id)).length;
    return { id: g.id, have, total: ids.length };
  });

  const fwcFrontHave = FWC_FRONT.filter(id => isHave(state, id)).length;
  const fwcBackHave  = FWC_BACK.filter(id => isHave(state, id)).length;

  return (
    <div className="stats">
      <h2>Your album</h2>
      <div className="stat-hero">
        <div className="ring-wrap">
          <svg className="ring-svg" viewBox="0 0 100 100">
            <circle className="ring-bg" cx="50" cy="50" r={R} fill="none" strokeWidth="10" />
            <circle className="ring-fg" cx="50" cy="50" r={R} fill="none" strokeWidth="10"
                    strokeDasharray={dash} strokeLinecap="round" transform="rotate(-90 50 50)" />
          </svg>
          <div>
            <div className="pct">{pct}%</div>
            <div className="pcts">{haveCount} / {TOTAL_STICKERS} stickers</div>
          </div>
        </div>
        <div className="counts">
          <div className="ck"><div className="n">{haveCount}</div><div className="l">Owned</div></div>
          <div className="ck"><div className="n">{TOTAL_STICKERS - haveCount}</div><div className="l">Missing</div></div>
          <div className="ck"><div className="n">{dupTotal}</div><div className="l">Duplicates</div></div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stats-card">
          <h3>Progress by group</h3>
          <div className="bar-row">
            <div className="lbl">★ Intro</div>
            <div className="bar"><div className="f" style={{ width: `${(fwcFrontHave / FWC_FRONT.length) * 100}%` }}></div></div>
            <div className="n">{fwcFrontHave}/{FWC_FRONT.length}</div>
          </div>
          {groupStats.map(g => (
            <div className="bar-row" key={g.id}>
              <div className="lbl">Group {g.id}</div>
              <div className="bar"><div className="f" style={{ width: `${(g.have / g.total) * 100}%` }}></div></div>
              <div className="n">{g.have}/{g.total}</div>
            </div>
          ))}
          <div className="bar-row">
            <div className="lbl">★ End</div>
            <div className="bar"><div className="f" style={{ width: `${(fwcBackHave / FWC_BACK.length) * 100}%` }}></div></div>
            <div className="n">{fwcBackHave}/{FWC_BACK.length}</div>
          </div>
        </div>

        <div className="stats-card">
          <h3>Account</h3>
          <div className="acct-row">
            <div>
              <div className="acct-lbl">Signed in as</div>
              <div className="acct-name">{activeUser}</div>
            </div>
            <button className="manage-btn inline" onClick={onLogout}>🔒 Lock / switch</button>
          </div>
        </div>
        <div className="stats-card">
          <h3>Manage</h3>
          <button className="manage-btn" onClick={onReplayOnboarding}>⤺ Re-run guided setup</button>
          <button className="manage-btn danger" onClick={onReset}>✕ Reset this album</button>
        </div>
      </div>
    </div>
  );
};
export default StatsView;
