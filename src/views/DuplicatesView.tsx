import React, { useState, useMemo } from 'react';
import { AlbumState } from '../types';
import { buildDuplicates, getName, stickerCount } from '../hooks/useStickers';
import { copyText } from './MissingView';

interface DuplicatesViewProps {
  state: AlbumState;
  onSet: (id: string, count: number) => void;
  onToast: (msg: string) => void;
}

export const DuplicatesView: React.FC<DuplicatesViewProps> = ({ state, onSet, onToast }) => {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const data = useMemo(() => buildDuplicates(state), [state]);

  const total = useMemo(() => {
    let n = 0;
    for (const t of data.teams) {
      for (const it of t.items) n += it.n;
    }
    for (const it of data.fwcFront) n += it.n;
    for (const it of data.fwcBack) n += it.n;
    return n;
  }, [data]);

  const flatList = useMemo(() => {
    const arr: { id: string; n: number }[] = [];
    arr.push(...data.fwcFront);
    for (const t of data.teams) {
      for (const it of t.items) arr.push(it);
    }
    arr.push(...data.fwcBack);
    return arr;
  }, [data]);

  const displayData = useMemo(() => {
    if (!q) return data;
    const isSpecial = "fwc".startsWith(q) || "special".startsWith(q);
    return {
      teams: data.teams.filter(({ team }) =>
        team.name.toLowerCase().startsWith(q) || team.code.toLowerCase().startsWith(q)
      ),
      fwcFront: isSpecial || "intro".startsWith(q) ? data.fwcFront : [],
      fwcBack:  isSpecial || "closing".startsWith(q) ? data.fwcBack : [],
    };
  }, [q, data]);

  const fmt = (it: { id: string; n: number }) => {
    const name = getName(state, it.id);
    const base = it.n > 1 ? `${it.id} (x${it.n})` : it.id;
    return name ? `${base} ${name}` : base;
  };

  const copyAll = async () => {
    if (!flatList.length) return onToast("No duplicates yet");
    const lines = [`🔁 Duplicates to trade (${total})`];
    if (data.fwcFront.length) lines.push(`\n★ Special intro: ${data.fwcFront.map(fmt).join(", ")}`);
    for (const t of data.teams) lines.push(`\n${t.team.flag} ${t.team.code} ${t.team.name}: ${t.items.map(fmt).join(", ")}`);
    if (data.fwcBack.length) lines.push(`\n★ Special closing: ${data.fwcBack.map(fmt).join(", ")}`);
    const ok = await copyText(lines.join("\n"));
    onToast(ok ? "Duplicates copied" : "Copy failed");
  };

  const copyCompact = async () => {
    if (!flatList.length) return onToast("No duplicates yet");
    const ok = await copyText("Duplicates: " + flatList.map(it => it.n > 1 ? `${it.id} (x${it.n})` : it.id).join(", "));
    onToast(ok ? "Compact list copied" : "Copy failed");
  };

  if (!flatList.length) {
    return (
      <div className="list-view">
        <div className="list-header"><h2>Duplicates</h2></div>
        <div className="empty">
          <div className="big">🔁</div>
          <div className="t">No duplicates yet</div>
          <div className="s">In the album, tap an owned sticker and use the +/− stepper to track extras.</div>
        </div>
      </div>
    );
  }

  const renderFwcRow = (items: { id: string; n: number }[], label: string, key: string) => items.length > 0 && (
    <div className="list-team" key={key}>
      <div className="ltrow">
        <span className="lflag">★</span>
        <span className="lcode">FWC</span>
        <span className="lname">{label}</span>
        <span className="lcount">{items.reduce((a, b) => a + b.n, 0)} extras</span>
      </div>
      <div className="chips">
        {items.map(it => (
          <div key={it.id} className="chip dup">
            <span>{it.id}{it.n > 1 ? <span className="x"> ×{it.n}</span> : null}{getName(state, it.id) ? <span className="chip-name"> · {getName(state, it.id)}</span> : null}</span>
            <div className="chip-act">
              <button onClick={() => onSet(it.id, stickerCount(state, it.id) - 1)} title="Remove one extra">−</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const noResults = q && displayData.teams.length === 0 && displayData.fwcFront.length === 0 && displayData.fwcBack.length === 0;

  return (
    <div className="list-view">
      <div className="list-header">
        <h2>Duplicates</h2>
        <div className="totalpill">{total} extras</div>
      </div>
      <div className="copy-row">
        <button onClick={copyAll}><span className="ic">⎘</span>Copy grouped</button>
        <button className="primary" onClick={copyCompact}><span className="ic">⎘</span>Copy compact</button>
      </div>

      <div className="list-search">
        <div className="searchbar">
          <span className="sb-ic">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by team…"
          />
          {query && <button className="sb-clear" onClick={() => setQuery("")} aria-label="Clear">×</button>}
        </div>
      </div>

      <div className="list-section">
        {noResults ? (
          <div className="empty" style={{ padding: "30px 0" }}>
            <div className="t">No match</div>
            <div className="s">Try the team name or code (e.g. ARG)</div>
          </div>
        ) : (
          <>
            {renderFwcRow(displayData.fwcFront, "Special — Intro", "fwc-f")}
            {displayData.teams.map(({ team, items }) => (
              <div className="list-team" key={team.code}>
                <div className="ltrow">
                  <span className="lflag">{team.flag}</span>
                  <span className="lcode">{team.code}</span>
                  <span className="lname">{team.name}</span>
                  <span className="lcount">{items.reduce((a, b) => a + b.n, 0)} extras</span>
                </div>
                <div className="chips">
                  {items.map(it => {
                    const name = getName(state, it.id);
                    return (
                      <div key={it.id} className="chip dup">
                        <span>{it.id.split("-")[1]}{it.n > 1 ? <span className="x"> ×{it.n}</span> : null}{name ? <span className="chip-name"> · {name}</span> : null}</span>
                        <div className="chip-act">
                          <button onClick={() => onSet(it.id, stickerCount(state, it.id) - 1)} title="Remove one extra">−</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {renderFwcRow(displayData.fwcBack, "Special — Closing", "fwc-b")}
          </>
        )}
      </div>
    </div>
  );
};
export default DuplicatesView;
