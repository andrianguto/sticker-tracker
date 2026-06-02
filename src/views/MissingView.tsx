import React, { useState, useMemo } from 'react';
import { AlbumState } from '../types';
import { buildMissing, getName } from '../hooks/useStickers';

interface MissingViewProps {
  state: AlbumState;
  onSet: (id: string, count: number) => void;
  onToast: (msg: string) => void;
}

export const copyText = async (txt: string): Promise<boolean> => {
  try { 
    await navigator.clipboard.writeText(txt); 
    return true; 
  } catch {
    const ta = document.createElement("textarea");
    ta.value = txt; 
    document.body.appendChild(ta); 
    ta.select();
    try { 
      document.execCommand("copy"); 
      document.body.removeChild(ta); 
      return true; 
    } catch { 
      document.body.removeChild(ta); 
      return false; 
    }
  }
};

export const MissingView: React.FC<MissingViewProps> = ({ state, onSet, onToast }) => {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const data = useMemo(() => buildMissing(state), [state]);

  const allMissing = useMemo(() => {
    const arr: string[] = [];
    arr.push(...data.fwcFront);
    for (const t of data.teams) arr.push(...t.missing);
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

  const fmtItem = (id: string) => {
    const name = getName(state, id);
    return name ? `${id} (${name})` : id;
  };

  const copyAll = async () => {
    if (!allMissing.length) return onToast("Nothing missing — congrats!");
    const lines = [`📒 Missing stickers (${allMissing.length})`];
    if (data.fwcFront.length) lines.push(`\n★ Special intro: ${data.fwcFront.map(fmtItem).join(", ")}`);
    for (const t of data.teams) lines.push(`\n${t.team.flag} ${t.team.code} ${t.team.name}: ${t.missing.map(fmtItem).join(", ")}`);
    if (data.fwcBack.length) lines.push(`\n★ Special closing: ${data.fwcBack.map(fmtItem).join(", ")}`);
    const ok = await copyText(lines.join("\n"));
    onToast(ok ? "Missing list copied" : "Copy failed");
  };

  const copyCompact = async () => {
    if (!allMissing.length) return onToast("Nothing missing — congrats!");
    const ok = await copyText(`Missing: ${allMissing.join(", ")}`);
    onToast(ok ? "Compact list copied" : "Copy failed");
  };

  if (!allMissing.length) {
    return (
      <div className="list-view">
        <div className="list-header"><h2>Missing</h2></div>
        <div className="empty">
          <div className="big">🏆</div>
          <div className="t">Complete album!</div>
          <div className="s">Every sticker is marked as owned. Nice work.</div>
        </div>
      </div>
    );
  }

  const renderFwcRow = (items: string[], label: string, key: string) => items.length > 0 && (
    <div className="list-team" key={key}>
      <div className="ltrow">
        <span className="lflag">★</span>
        <span className="lcode">FWC</span>
        <span className="lname">{label}</span>
        <span className="lcount">{items.length} missing</span>
      </div>
      <div className="chips">
        {items.map(id => (
          <button key={id} className="chip" onClick={() => onSet(id, 1)} title={getName(state, id) || "Mark as got"}>
            {id}{getName(state, id) ? <span className="chip-name"> · {getName(state, id)}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );

  const noResults = q && displayData.teams.length === 0 && displayData.fwcFront.length === 0 && displayData.fwcBack.length === 0;

  return (
    <div className="list-view">
      <div className="list-header">
        <h2>Missing</h2>
        <div className="totalpill">{allMissing.length} stickers</div>
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
            {displayData.teams.map(({ team, missing }) => (
              <div className="list-team" key={team.code}>
                <div className="ltrow">
                  <span className="lflag">{team.flag}</span>
                  <span className="lcode">{team.code}</span>
                  <span className="lname">{team.name}</span>
                  <span className="lcount">{missing.length} missing</span>
                </div>
                <div className="chips">
                  {missing.map(id => {
                    const num = id.split("-")[1] || id;
                    const name = getName(state, id);
                    return (
                      <button key={id} className="chip" onClick={() => onSet(id, 1)} title={name || "Mark as got"}>
                        {num}{name ? <span className="chip-name"> · {name}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {renderFwcRow(displayData.fwcBack, "Special — Closing", "fwc-b")}
          </>
        )}
        {!q && <div className="hint-row">Tap a chip to mark it as got it</div>}
      </div>
    </div>
  );
};
export default MissingView;
