import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AlbumState } from '../types';
import { Sticker } from '../components/Sticker';
import { isHave, stickerCount } from '../hooks/useStickers';
import { ALL_TEAMS, FWC_FRONT, FWC_BACK } from '../data';

interface OnboardingProps {
  state: AlbumState;
  onTap: (id: string) => void;
  onSet: (id: string, count: number) => void;
  onFinish: () => void;
  onSkip: () => void;
  setupMode: "have" | "missing";
  setSetupMode: (m: "have" | "missing") => void;
}

interface Step {
  kind: string;
  label: string;
  flag: string;
  ids: string[];
  team?: typeof ALL_TEAMS[0];
}

export const Onboarding: React.FC<OnboardingProps> = ({
  state,
  onTap,
  onSet,
  onFinish,
  onSkip,
  setupMode,
  setSetupMode,
}) => {
  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [{ kind: "fwc-front", label: "Special — Intro", flag: "★", ids: FWC_FRONT }];
    for (const t of ALL_TEAMS) {
      out.push({
        kind: "team", 
        team: t, 
        label: t.name, 
        flag: t.flag,
        ids: Array.from({ length: 20 }, (_, i) => `${t.code}-${i + 1}`),
      });
    }
    out.push({ kind: "fwc-back", label: "Special — Closing", flag: "★", ids: FWC_BACK });
    return out;
  }, []);

  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const autoFilled = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (setupMode !== "missing") return;
    if (autoFilled.current.has(stepIdx)) return;
    const untouched = step.ids.every(id => stickerCount(state, id) === 0);
    if (untouched) {
      for (const id of step.ids) onSet(id, 1);
    }
    autoFilled.current.add(stepIdx);
  }, [stepIdx, setupMode, step.ids, state, onSet]);

  const haveInStep = step.ids.filter(id => isHave(state, id)).length;
  
  const fillAll = () => { 
    for (const id of step.ids) onSet(id, Math.max(1, stickerCount(state, id))); 
  };
  
  const clearAll = () => { 
    for (const id of step.ids) onSet(id, 0); 
  };

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
};
export default Onboarding;
