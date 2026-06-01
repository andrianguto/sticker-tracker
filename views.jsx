/* Sticker Tracker — views (Album, Missing, Duplicates, Stats, Onboarding) */
const { useState: useStateV, useEffect: useEffectV, useMemo: useMemoV, useRef: useRefV, useCallback: useCallbackV } = React;

// --- Album view ----------------------------------------------------------
function AlbumView({ state, onTap }) {
  const [query, setQuery] = useStateV("");
  const [letterFilter, setLetterFilter] = useStateV(null);
  const q = query.trim().toLowerCase();

  // Build alphabet index: { "A": ["ARG","ALG",...], "B": [...], ... }
  const alphaIndex = useMemoV(() => {
    const map = {};
    for (const t of window.ALL_TEAMS) {
      const letter = t.name[0].toUpperCase();
      if (!map[letter]) map[letter] = [];
      map[letter].push(t.code);
    }
    return map;
  }, []);

  const handleLetterTap = (letter) => {
    setLetterFilter(l => l === letter ? null : letter);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Search with PREFIX-first matching for team names (fix #5)
  const matches = useMemoV(() => {
    if (!q) return null;
    const teamCodes = new Set();
    const focusIds = new Set();
    let fwcFront = false, fwcBack = false;

    // Direct sticker ID match e.g. "arg-15" or "fwc-3"
    const idMatch = q.match(/^([a-z]+)\s*-?\s*(\d+)$/i);
    if (idMatch) {
      const code = idMatch[1].toUpperCase();
      const num = parseInt(idMatch[2], 10);
      if (code === "FWC" && num >= 1 && num <= window.FWC_COUNT) {
        focusIds.add(`FWC-${num}`);
        if (num <= window.FWC_FRONT_END) fwcFront = true; else fwcBack = true;
      } else if (window.ALL_TEAMS.find(t => t.code === code) && num >= 1 && num <= 20) {
        teamCodes.add(code);
        focusIds.add(`${code}-${num}`);
      }
    }

    // Team name: PREFIX match only — typing "T" shows Turkey/Tunisia, not Qatar
    // Team code: prefix match on 3-letter codes
    // Group: still allow "group A" style queries
    for (const t of window.ALL_TEAMS) {
      if (
        t.name.toLowerCase().startsWith(q) ||
        t.code.toLowerCase().startsWith(q) ||
        `group ${t.group}`.toLowerCase().includes(q)
      ) {
        teamCodes.add(t.code);
      }
    }

    // Player name — substring is fine here since names are specific
    for (const [id, rec] of Object.entries(state)) {
      if (!rec?.name) continue;
      if (rec.name.toLowerCase().includes(q)) {
        focusIds.add(id);
        if (id.startsWith("FWC")) {
          const n = parseInt(id.split("-")[1], 10);
          if (n <= window.FWC_FRONT_END) fwcFront = true; else fwcBack = true;
        } else {
          teamCodes.add(id.split("-")[0]);
        }
      }
    }
    return { teamCodes, focusIds, fwcFront, fwcBack };
  }, [q, state]);

  // Whether a team should be visible (letter filter takes priority over text search)
  const showTeam = (code) => {
    if (letterFilter) {
      const team = window.ALL_TEAMS.find(t => t.code === code);
      return team && team.name[0].toUpperCase() === letterFilter;
    }
    return !matches || matches.teamCodes.has(code) || (q && [...matches.focusIds].some(id => id.startsWith(code + "-")));
  };

  // Hide FWC sections when a letter filter is active
  const showFwcFront = !letterFilter && (!matches || matches.fwcFront || [...(matches?.focusIds || [])].some(id => window.FWC_FRONT.includes(id)));
  const showFwcBack  = !letterFilter && (!matches || matches.fwcBack  || [...(matches?.focusIds || [])].some(id => window.FWC_BACK.includes(id)));

  const renderFwc = (ids, key, label) => {
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
              <Sticker key={id} id={id} state={state} onTap={onTap}
                       dim={matches && !matches.focusIds.has(id) && q ? true : false} />
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

        {/* Alphabet jumper — replaces old group pills */}
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
            onClick={() => { setLetterFilter(null); setQuery(""); setTimeout(() => { const el = document.getElementById("fwc-front"); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 132, behavior: "smooth" }); }, 50); }}
            title="Special stickers"
          >★</button>
        </div>
      </div>

      {showFwcFront && renderFwc(window.FWC_FRONT, "fwc-front", "Special — Intro (FWC 1–8)")}

      {window.GROUPS.map(g => {
        const visibleTeams = g.teams.filter(t => showTeam(t.code));
        if (!visibleTeams.length) return null;
        const teamIds = g.teams.flatMap(t => Array.from({ length: 20 }, (_, i) => `${t.code}-${i + 1}`));
        const done = teamIds.filter(id => isHave(state, id)).length;
        return (
          <div className="group-section" id={`group-${g.id}`} key={g.id}>
            <div className="group-header">
              <div className="gbadge" style={{ background: window.GROUP_COLORS[g.id] }}>{g.id}</div>
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

      {showFwcBack && renderFwc(window.FWC_BACK, "fwc-back", "Special — Closing (FWC 9–19)")}

      {noResults && (
        <div className="empty">
          <div className="big">⌕</div>
          <div className="t">No matches</div>
          <div className="s">Try a country name (starts with…), code, or player name.</div>
        </div>
      )}
    </div>
  );
}

// --- Onboarding ----------------------------------------------------------
function Onboarding({ state, onTap, onSet, onFinish, onSkip, setupMode, setSetupMode }) {
  const steps = useMemoV(() => {
    const out = [{ kind: "fwc-front", label: "Special — Intro", flag: "★", ids: window.FWC_FRONT }];
    for (const t of window.ALL_TEAMS) {
      out.push({
        kind: "team", team: t, label: t.name, flag: t.flag,
        ids: Array.from({ length: 20 }, (_, i) => `${t.code}-${i + 1}`),
      });
    }
    out.push({ kind: "fwc-back", label: "Special — Closing", flag: "★", ids: window.FWC_BACK });
    return out;
  }, []);

  const [stepIdx, setStepIdx] = useStateV(0);
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const autoFilled = useRefV(new Set());

  useEffectV(() => {
    if (setupMode !== "missing") return;
    if (autoFilled.current.has(stepIdx)) return;
    const untouched = step.ids.every(id => stickerCount(state, id) === 0);
    if (untouched) {
      for (const id of step.ids) onSet(id, 1);
    }
    autoFilled.current.add(stepIdx);
  // eslint-disable-next-line
  }, [stepIdx, setupMode]);

  const haveInStep = step.ids.filter(id => isHave(state, id)).length;
  const fillAll = () => { for (const id of step.ids) onSet(id, Math.max(1, stickerCount(state, id))); };
  const clearAll = () => { for (const id of step.ids) onSet(id, 0); };

  return (
    <div className="onb-wrap">
      <div className="onb-hero">
        <div className="onb-meta">
          <span className="onb-eyebrow">Quick setup</span>
          <span className="onb-count">{stepIdx + 1} / {steps.length}</span>
        </div>
        <h2><span className="onb-flag">{step.flag}</span>{step.label}</h2>
        <p>Mark each sticker as you go. You can edit anything later.</p>
        <div className="mode-switch" role="tablist">
          <button className={setupMode === "have" ? "active" : ""} onClick={() => setSetupMode("have")}>
            <span className="dot have"></span>
            <span>I'll mark the ones <b>I HAVE</b></span>
          </button>
          <button className={setupMode === "missing" ? "active" : ""} onClick={() => { setSetupMode("missing"); autoFilled.current.delete(stepIdx); }}>
            <span className="dot missing"></span>
            <span>I'll mark the ones <b>I'M MISSING</b></span>
          </button>
        </div>
        <div className="onb-progress"><div className="fill" style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}></div></div>
      </div>

      <div className="team-card onb-team-card">
        <div className="team-row">
          <span className="team-flag">{step.flag}</span>
          {step.team && <span className="team-code">{step.team.code}</span>}
          <span className="team-name">{step.label}</span>
          <span className="team-prog">
            <span className={haveInStep === step.ids.length ? "pdone" : ""}>{haveInStep}</span>/{step.ids.length}
          </span>
        </div>
        <div className="sticker-grid">
          {step.ids.map(id => <Sticker key={id} id={id} state={state} onTap={onTap} />)}
        </div>
        <div className="quick-actions">
          <button onClick={fillAll}>Mark all</button>
          <button onClick={clearAll}>Clear all</button>
        </div>
      </div>

      <div className="onb-nav">
        <button className="btn" onClick={() => setStepIdx(i => Math.max(0, i - 1))} disabled={stepIdx === 0}>← Back</button>
        <button className="btn next" onClick={() => {
          if (isLast) onFinish();
          else { setStepIdx(i => i + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
        }}>{isLast ? "Finish" : "Next →"}</button>
      </div>
      <button className="onb-skip" onClick={onSkip}>Skip — I'll mark stickers later</button>
    </div>
  );
}

// --- Missing view --------------------------------------------------------
function MissingView({ state, onSet, onToast }) {
  const [query, setQuery] = useStateV("");
  const q = query.trim().toLowerCase();

  const data = useMemoV(() => buildMissing(state), [state]);

  // All missing — used for copy & count (never filtered)
  const allMissing = useMemoV(() => {
    const arr = [];
    arr.push(...data.fwcFront);
    for (const t of data.teams) arr.push(...t.missing);
    arr.push(...data.fwcBack);
    return arr;
  }, [data]);

  // Display-only filtered data
  const displayData = useMemoV(() => {
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

  const fmtItem = (id) => {
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

  const renderFwcRow = (items, label, key) => items.length > 0 && (
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

      {/* Search bar */}
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
                    const num = id.split("-")[1];
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
}

// --- Duplicates view -----------------------------------------------------
function DuplicatesView({ state, onSet, onToast }) {
  const [query, setQuery] = useStateV("");
  const q = query.trim().toLowerCase();

  const data = useMemoV(() => buildDuplicates(state), [state]);

  const total = useMemoV(() => {
    let n = 0;
    for (const t of data.teams) for (const it of t.items) n += it.n;
    for (const it of data.fwcFront) n += it.n;
    for (const it of data.fwcBack) n += it.n;
    return n;
  }, [data]);

  const flatList = useMemoV(() => {
    const arr = [];
    arr.push(...data.fwcFront);
    for (const t of data.teams) for (const it of t.items) arr.push(it);
    arr.push(...data.fwcBack);
    return arr;
  }, [data]);

  // Display-only filtered data
  const displayData = useMemoV(() => {
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

  const fmt = (it) => {
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

  const renderFwcRow = (items, label, key) => items.length > 0 && (
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

      {/* Search bar */}
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
}

// --- Stats view ----------------------------------------------------------
function StatsView({ state, activeUser, onLogout, onReset, onReplayOnboarding }) {
  const haveCount = useMemoV(() => window.allStickerIds().filter(id => isHave(state, id)).length, [state]);
  const dupTotal  = useMemoV(() => window.allStickerIds().reduce((a, id) => a + dupCount(state, id), 0), [state]);
  const pct = Math.round((haveCount / window.TOTAL_STICKERS) * 100);

  const R = 42, C = 2 * Math.PI * R;
  const dash = `${(pct / 100) * C} ${C}`;

  const groupStats = window.GROUPS.map(g => {
    const ids = g.teams.flatMap(t => Array.from({ length: 20 }, (_, i) => `${t.code}-${i + 1}`));
    const have = ids.filter(id => isHave(state, id)).length;
    return { id: g.id, have, total: ids.length };
  });

  const fwcFrontHave = window.FWC_FRONT.filter(id => isHave(state, id)).length;
  const fwcBackHave  = window.FWC_BACK.filter(id => isHave(state, id)).length;

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
            <div className="pcts">{haveCount} / {window.TOTAL_STICKERS} stickers</div>
          </div>
        </div>
        <div className="counts">
          <div className="ck"><div className="n">{haveCount}</div><div className="l">Owned</div></div>
          <div className="ck"><div className="n">{window.TOTAL_STICKERS - haveCount}</div><div className="l">Missing</div></div>
          <div className="ck"><div className="n">{dupTotal}</div><div className="l">Duplicates</div></div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stats-card">
          <h3>Progress by group</h3>
          <div className="bar-row">
            <div className="lbl">★ Intro</div>
            <div className="bar"><div className="f" style={{ width: `${(fwcFrontHave / window.FWC_FRONT.length) * 100}%` }}></div></div>
            <div className="n">{fwcFrontHave}/{window.FWC_FRONT.length}</div>
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
            <div className="bar"><div className="f" style={{ width: `${(fwcBackHave / window.FWC_BACK.length) * 100}%` }}></div></div>
            <div className="n">{fwcBackHave}/{window.FWC_BACK.length}</div>
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
}

Object.assign(window, { AlbumView, Onboarding, MissingView, DuplicatesView, StatsView });
