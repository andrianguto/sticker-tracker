import React, { useState, useMemo } from 'react';
import { AlbumState } from '../types';
import { Sticker } from '../components/Sticker';
import { isHave } from '../hooks/useStickers';
import { 
  ALL_TEAMS, 
  GROUPS, 
  GROUP_COLORS, 
  FWC_FRONT, 
  FWC_BACK, 
  FWC_COUNT, 
  FWC_FRONT_END
} from '../data';

interface AlbumViewProps {
  state: AlbumState;
  onTap: (id: string) => void;
}

export const AlbumView: React.FC<AlbumViewProps> = ({ state, onTap }) => {
  const [query, setQuery] = useState("");
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const alphaIndex = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of ALL_TEAMS) {
      const letter = t.name[0].toUpperCase();
      if (!map[letter]) map[letter] = [];
      map[letter].push(t.code);
    }
    return map;
  }, []);

  const handleLetterTap = (letter: string) => {
    setLetterFilter(l => l === letter ? null : letter);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const matches = useMemo(() => {
    if (!q) return null;
    const teamCodes = new Set<string>();
    const focusIds = new Set<string>();
    let fwcFront = false;
    let fwcBack = false;

    const idMatch = q.match(/^([a-z]+)\s*-?\s*(\d+)$/i);
    if (idMatch) {
      const code = idMatch[1].toUpperCase();
      const num = parseInt(idMatch[2], 10);
      if (code === "FWC" && num >= 1 && num <= FWC_COUNT) {
        focusIds.add(`FWC-${num}`);
        if (num <= FWC_FRONT_END) fwcFront = true; else fwcBack = true;
      } else if (ALL_TEAMS.find(t => t.code === code) && num >= 1 && num <= 20) {
        teamCodes.add(code);
        focusIds.add(`${code}-${num}`);
      }
    }

    for (const t of ALL_TEAMS) {
      if (
        t.name.toLowerCase().startsWith(q) ||
        t.code.toLowerCase().startsWith(q) ||
        `group ${t.group}`.toLowerCase().includes(q)
      ) {
        teamCodes.add(t.code);
      }
    }

    for (const [id, rec] of Object.entries(state)) {
      if (!rec?.name) continue;
      if (rec.name.toLowerCase().includes(q)) {
        focusIds.add(id);
        if (id.startsWith("FWC")) {
          const n = parseInt(id.split("-")[1], 10);
          if (n <= FWC_FRONT_END) fwcFront = true; else fwcBack = true;
        } else {
          teamCodes.add(id.split("-")[0]);
        }
      }
    }
    return { teamCodes, focusIds, fwcFront, fwcBack };
  }, [q, state]);

  const showTeam = (code: string) => {
    if (letterFilter) {
      const team = ALL_TEAMS.find(t => t.code === code);
      return team && team.name[0].toUpperCase() === letterFilter;
    }
    return !matches || matches.teamCodes.has(code) || (q && [...matches.focusIds].some(id => id.startsWith(code + "-")));
  };

  const showFwcFront = !letterFilter && (!matches || matches.fwcFront || [...(matches?.focusIds || [])].some(id => FWC_FRONT.includes(id)));
  const showFwcBack  = !letterFilter && (!matches || matches.fwcBack  || [...(matches?.focusIds || [])].some(id => FWC_BACK.includes(id)));

  const renderFwc = (ids: string[], key: string, label: string) => {
    const owned = ids.filter(id => isHave(state, id)).length;
    const complete = owned === ids.length;
    return (
      <div className="group-section" id={key} key={key}>
        <div className="group-header">
          <div className="gbadge" style={{ background: "#d4ff3a", color: "#0b0c0e" }}>★</div>
          <div className="gtitle">{label}</div>
          <div className="gprog">{owned}/{ids.length}</div>
        </div>
        <div className={`special-card${complete ? " complete" : ""}`}>
          <div className="sticker-grid fwc-grid">
            {ids.map(id => (
              <Sticker 
                key={id} 
                id={id} 
                state={state} 
                onTap={onTap}
                dim={matches && !matches.focusIds.has(id) && q ? true : false} 
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const noResults = !letterFilter && matches && matches.teamCodes.size === 0 && matches.focusIds.size === 0;

  return (
    <div className="album">
      <div className="album-toolbar">
        <div className="searchbar">
          <span className="sb-ic">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (letterFilter) setLetterFilter(null); }}
            placeholder="Search team, player, or ID (ARG-15)…"
          />
          {query && <button className="sb-clear" onClick={() => setQuery("")} aria-label="Clear">×</button>}
        </div>

        <div className="jumper">
          <button
            className={`jp${!letterFilter && !q ? " jp-active" : ""}`}
            onClick={() => { setLetterFilter(null); setQuery(""); }}
          >All</button>
          {Object.keys(alphaIndex).sort().map(letter => (
            <button
              key={letter}
              className={`jp${letterFilter === letter ? " jp-active" : ""}`}
              onClick={() => handleLetterTap(letter)}
            >{letter}</button>
          ))}
          <button
            className="jp"
            onClick={() => { 
              setLetterFilter(null); 
              setQuery(""); 
              setTimeout(() => { 
                const el = document.getElementById("fwc-front"); 
                if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 132, behavior: "smooth" }); 
              }, 50); 
            }}
            title="Special stickers"
          >★</button>
        </div>
      </div>

      {showFwcFront && renderFwc(FWC_FRONT, "fwc-front", "Special — Intro (FWC 1–8)")}

      {GROUPS.map(g => {
        const visibleTeams = g.teams.filter(t => showTeam(t.code));
        if (!visibleTeams.length) return null;
        const teamIds = g.teams.flatMap(t => Array.from({ length: 20 }, (_, i) => `${t.code}-${i + 1}`));
        const done = teamIds.filter(id => isHave(state, id)).length;
        return (
          <div className="group-section" id={`group-${g.id}`} key={g.id}>
            <div className="group-header">
              <div className="gbadge" style={{ background: GROUP_COLORS[g.id] }}>{g.id}</div>
              <div className="gtitle">Group {g.id}</div>
              <div className="gteams">{g.teams.map(t => t.code).join(" · ")}</div>
              <div className="gprog">{done}/{teamIds.length}</div>
            </div>
            {visibleTeams.map(t => {
              const ids = Array.from({ length: 20 }, (_, i) => `${t.code}-${i + 1}`);
              const have = ids.filter(id => isHave(state, id)).length;
              const complete = have === 20;
              return (
                <div className={`team-card${complete ? " complete" : ""}`} id={`team-${t.code}`} key={t.code}>
                  <div className="team-row">
                    <span className="team-flag">{t.flag}</span>
                    <span className="team-code">{t.code}</span>
                    <span className="team-name">{t.name}</span>
                    <span className="team-prog">
                      <span className={complete ? "pdone" : ""}>{have}</span>/20
                      {complete && <span className="complete-badge">✓</span>}
                    </span>
                  </div>
                  <div className="sticker-grid">
                    {ids.map(id => (
                      <Sticker key={id} id={id} state={state} onTap={onTap} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {showFwcBack && renderFwc(FWC_BACK, "fwc-back", "Special — Closing (FWC 9–19)")}

      {noResults && (
        <div className="empty">
          <div className="big">⌕</div>
          <div className="t">No matches</div>
          <div className="s">Try a country name (starts with…), code, or player name.</div>
        </div>
      )}
    </div>
  );
};
export default AlbumView;
