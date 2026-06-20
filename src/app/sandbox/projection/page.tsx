"use client";

import { useEffect, useState } from "react";

export default function ProjectionPage() {
  const [thesis, setThesis] = useState('Shell + Long Lease');
  const [geography, setGeography] = useState('QA-01');
  const [gpuProfile, setGpuProfile] = useState('H100');
  const [capacity, setCapacity] = useState(100);
  const [aiMix, setAiMix] = useState(50);

  const handleReset = () => {
    setThesis('Shell + Long Lease');
    setGeography('QA-01');
    setGpuProfile('H100');
    setCapacity(100);
    setAiMix(50);
  };

  const handleRunSimulation = () => {
    console.log("Running simulation with:", { thesis, geography, gpuProfile, capacity, aiMix });
  };

  // Mock calculations for KPIs based on sliders to make it feel alive
  const capex = (capacity * 8.5 * (1 + aiMix / 100)).toFixed(1);
  const irr = (15 + (aiMix / 100) * 8 + (capacity > 500 ? 2 : 0)).toFixed(1);
  const yieldVal = (12 + (aiMix / 100) * 10).toFixed(1);

  useEffect(() => {
    // 2. Count-Up Animation (reused from cockpit)
    const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    
    const runCountUp = () => {
      const elements = document.querySelectorAll('.js-count-up');
      elements.forEach((el) => {
        const element = el as HTMLElement;
        const text = element.innerText;
        const isCurrency = text.includes('$');
        const isPercent = text.includes('%');
        const isPlus = text.includes('+');
        
        const numericStr = text.replace(/[^0-9.]/g, '');
        const targetValue = parseFloat(numericStr);
        if (isNaN(targetValue)) return;
        
        const parts = numericStr.split('.');
        const decimals = parts.length > 1 ? (parts[1]?.length ?? 0) : 0;
        
        let startValue = targetValue * 0.8;
        let startTime: number | null = null;
        const duration = 1500 + Math.random() * 1000;

        const animate = (timestamp: number) => {
          if (!startTime) startTime = timestamp;
          const progress = Math.min((timestamp - startTime) / duration, 1);
          const current = startValue + (targetValue - startValue) * easeOutExpo(progress);
          
          let formatted = current.toFixed(decimals);
          if (isCurrency) {
            const numParts = formatted.split('.');
            numParts[0] = (numParts[0] ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            formatted = '$' + numParts.join('.');
          } else if (isPercent) {
            formatted = formatted + '%';
          }
          
          if (isPlus && !isCurrency) {
            formatted = '+' + formatted;
          }
          
          element.innerText = formatted;
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            element.innerText = text;
          }
        };
        
        requestAnimationFrame(animate);
      });
    };

    const countTimer = setTimeout(runCountUp, 50);
    return () => clearTimeout(countTimer);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          /* MATÉRIAUX PHYSIQUES */
          --ct-bg-rail: #020305;      /* Châssis extérieur : Noir quasi absolu */
          --ct-bg-canvas: #080A0F;    /* Châssis central : Noir bleuté ultra profond */

          --ct-surface-panel: #161922; /* PLAQUE : Gris métallique mat affirmé */
          --ct-surface-well: #000000;  /* PUITS : Noir pur (écran encastré) */
          --ct-surface-hover: #1E222D; /* Interactive sur plaque */

          /* BORDURES & BISEAUX */
          --ct-panel-border: #222736;
          --ct-panel-highlight: #303747; /* Highlight zénithal */
          --ct-well-border: #10131A;
          --ct-border-faint: rgba(255, 255, 255, 0.06);
          --ct-border-soft: rgba(255, 255, 255, 0.12);

          /* Typography */
          --ct-text-primary: #FFFFFF;
          --ct-text-muted: rgba(255, 255, 255, 0.65);
          --ct-text-faint: rgba(255, 255, 255, 0.35);

          /* Accent - Hearst Calm */
          --ct-accent: #A7FB90;
          --ct-accent-soft: rgba(167, 251, 144, 0.12);
          --ct-accent-border: rgba(167, 251, 144, 0.28);

          /* Fonts */
          --ct-font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          --ct-font-mono: "SF Mono", "SFMono-Regular", ui-monospace, "Roboto Mono", Menlo, Monaco, Consolas, monospace;
        }

        .portfolio-cockpit {
          background-color: var(--ct-bg-rail);
          color: var(--ct-text-primary);
          font-family: var(--ct-font-sans);
          font-size: 13px;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: geometricPrecision;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .portfolio-cockpit * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .portfolio-cockpit .mono { 
          font-family: var(--ct-font-mono); 
          font-variant-numeric: tabular-nums; 
          letter-spacing: -0.01em; 
        }
        .portfolio-cockpit .text-accent { color: var(--ct-accent); }
        .portfolio-cockpit .text-primary { color: var(--ct-text-primary); }
        .portfolio-cockpit .text-secondary { color: var(--ct-text-muted); }
        .portfolio-cockpit .text-muted { color: var(--ct-text-muted); }
        .portfolio-cockpit .text-faint { color: var(--ct-text-faint); }
        
        .portfolio-cockpit .text-micro { font-size: 10px; font-weight: 500; letter-spacing: 0.02em; }
        .portfolio-cockpit .text-xs { font-size: 11px; font-weight: 500; }
        .portfolio-cockpit .text-sm { font-size: 13px; }
        .portfolio-cockpit .text-base { font-size: 14px; }
        .portfolio-cockpit .text-lg { font-size: 16px; font-weight: 500; letter-spacing: -0.01em; }
        .portfolio-cockpit .text-xl { font-size: 20px; font-weight: 400; letter-spacing: -0.02em; }
        .portfolio-cockpit .text-2xl { font-size: 28px; font-weight: 400; letter-spacing: -0.02em; }
        .portfolio-cockpit .text-3xl { font-size: 36px; font-weight: 300; letter-spacing: -0.03em; }
        
        .portfolio-cockpit .uppercase-eyebrow { text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; font-weight: 600; color: var(--ct-text-muted); }

        .portfolio-cockpit .flex { display: flex; }
        .portfolio-cockpit .flex-col { display: flex; flex-direction: column; }
        .portfolio-cockpit .items-center { align-items: center; }
        .portfolio-cockpit .items-baseline { align-items: baseline; }
        .portfolio-cockpit .justify-between { justify-content: space-between; }
        .portfolio-cockpit .gap-1 { gap: 4px; }
        .portfolio-cockpit .gap-2 { gap: 8px; }
        .portfolio-cockpit .gap-3 { gap: 12px; }
        .portfolio-cockpit .gap-4 { gap: 16px; }
        .portfolio-cockpit .gap-6 { gap: 24px; }
        .portfolio-cockpit .gap-8 { gap: 32px; }
        .portfolio-cockpit .mt-1 { margin-top: 4px; }
        .portfolio-cockpit .mt-2 { margin-top: 8px; }
        .portfolio-cockpit .mt-4 { margin-top: 16px; }
        .portfolio-cockpit .mb-1 { margin-bottom: 4px; }
        .portfolio-cockpit .mb-2 { margin-bottom: 8px; }
        .portfolio-cockpit .w-full { width: 100%; }
        .portfolio-cockpit .h-full { height: 100%; }

        /* SHELL */
        .portfolio-cockpit .app-shell {
          display: grid;
          grid-template-columns: 72px 1fr 340px;
          grid-template-rows: 1fr auto;
          height: 100%;
          width: 100%;
        }

        /* LEFT RAIL */
        .portfolio-cockpit .left-rail {
          grid-column: 1;
          grid-row: 1 / 3;
          background: var(--ct-bg-rail);
          border-right: 1px solid var(--ct-surface-panel);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 0;
          z-index: 20;
          box-shadow: 8px 0 24px rgba(0,0,0,0.5);
        }
        .portfolio-cockpit .logo {
          width: 36px; height: 36px;
          background: var(--ct-surface-panel);
          border-radius: 8px;
          border-top: 1px solid var(--ct-panel-highlight);
          border-bottom: 1px solid #000;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 48px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.4);
        }
        .portfolio-cockpit .logo svg { width: 16px; height: 16px; fill: var(--ct-text-primary); }
        
        .portfolio-cockpit .nav-item {
          width: 100%;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 16px 0;
          color: var(--ct-text-faint);
          cursor: pointer;
          position: relative;
          transition: color 0.2s ease;
        }
        .portfolio-cockpit .nav-item:hover { color: var(--ct-text-muted); }
        .portfolio-cockpit .nav-item.active { color: var(--ct-text-primary); }
        .portfolio-cockpit .nav-item.active::before {
          content: ''; position: absolute; left: 0; top: 20%; height: 60%; width: 3px;
          background: var(--ct-text-primary);
          border-radius: 0 2px 2px 0;
        }
        .portfolio-cockpit .nav-icon { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
        .portfolio-cockpit .nav-icon svg { width: 100%; height: 100%; stroke: currentColor; stroke-width: 1.5; fill: none; }
        
        .portfolio-cockpit .user-avatar {
          margin-top: auto;
          width: 32px; height: 32px;
          border-radius: 16px;
          background: var(--ct-surface-panel);
          display: flex; align-items: center; justify-content: center;
          color: var(--ct-text-muted);
          font-weight: 500;
        }

        /* MAIN CANVAS */
        .portfolio-cockpit .main-content {
          grid-column: 2;
          grid-row: 1;
          background-color: var(--ct-bg-canvas);
          position: relative;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 40px 48px;
          display: flex;
          flex-direction: column;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.02'/%3E%3C/svg%3E");
        }

        .portfolio-cockpit .page-header {
          position: relative;
          z-index: 1;
          margin-bottom: 40px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .portfolio-cockpit .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }

        /* BENTO GRID SPECIFIC FOR PROJECTION */
        .portfolio-cockpit .projection-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 24px;
          width: 100%;
          flex-grow: 1;
        }

        /* PANELS: PLAQUES GRISES VISSÉES SUR LE CHÂSSIS */
        .portfolio-cockpit .panel {
          background: var(--ct-surface-panel);
          border: 1px solid var(--ct-panel-border);
          border-top: 1px solid var(--ct-panel-highlight); /* Biseau lumière */
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow: 0 12px 24px rgba(0,0,0,0.5); /* Ombre portée dense */
        }
        
        .portfolio-cockpit .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        
        /* WELLS: PUITS NOIRS ENCASTRÉS DANS LA PLAQUE GRISE */
        .portfolio-cockpit .well {
          background: var(--ct-surface-well);
          border: 1px solid var(--ct-well-border);
          border-top: 1px solid #000;
          box-shadow: inset 0 3px 10px rgba(0,0,0,0.8); /* Encastrement */
          border-radius: 8px; /* Coins plus secs pour les écrans internes */
          padding: 16px;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* SEGMENTED CONTROLS */
        .portfolio-cockpit .control-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .portfolio-cockpit .segmented-control {
          background-color: var(--ct-surface-well);
          border: 1px solid var(--ct-well-border);
          border-top: 1px solid #000;
          box-shadow: inset 0 3px 10px rgba(0,0,0,0.8);
          border-radius: 8px;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .portfolio-cockpit .segmented-control.row {
          flex-direction: row;
        }
        .portfolio-cockpit .segmented-control.row > button {
          flex: 1;
        }

        .portfolio-cockpit .segment-btn {
          background: transparent;
          border: 1px solid transparent;
          color: var(--ct-text-muted);
          padding: 10px 12px;
          border-radius: 6px;
          font-family: var(--ct-font-mono);
          font-size: 11px;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s ease;
          user-select: none;
        }

        .portfolio-cockpit .segment-btn:hover:not(.active) {
          color: var(--ct-text-primary);
          background-color: rgba(255, 255, 255, 0.05);
        }

        .portfolio-cockpit .segment-btn.active {
          background-color: var(--ct-surface-panel);
          border: 1px solid var(--ct-panel-border);
          border-top: 1px solid var(--ct-panel-highlight);
          color: var(--ct-accent);
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }

        /* SLIDERS */
        .portfolio-cockpit .slider-container {
          display: flex;
          align-items: center;
          gap: 16px;
          background-color: var(--ct-surface-well);
          border: 1px solid var(--ct-well-border);
          border-top: 1px solid #000;
          box-shadow: inset 0 3px 10px rgba(0,0,0,0.8);
          padding: 12px 16px;
          border-radius: 8px;
        }

        .portfolio-cockpit .ct-slider {
          flex: 1;
          -webkit-appearance: none;
          background: var(--ct-surface-panel);
          height: 4px;
          border-radius: 2px;
          outline: none;
        }

        .portfolio-cockpit .ct-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--ct-surface-panel);
          border: 2px solid var(--ct-accent);
          cursor: pointer;
          transition: transform 0.1s;
        }

        .portfolio-cockpit .ct-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        /* ACTIONS */
        .portfolio-cockpit .ct-actions {
          display: flex;
          gap: 16px;
          margin-top: auto;
          padding-top: 24px;
          border-top: 1px solid var(--ct-panel-border);
        }

        .portfolio-cockpit .ct-btn {
          flex: 1;
          padding: 14px;
          border-radius: 8px;
          font-family: var(--ct-font-mono);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-transform: uppercase;
          border: none;
          transition: all 0.2s ease;
          letter-spacing: 0.05em;
        }

        .portfolio-cockpit .ct-btn:active {
          transform: translateY(1px);
        }

        .portfolio-cockpit .ct-btn-primary {
          background-color: var(--ct-accent);
          color: #000000;
        }

        .portfolio-cockpit .ct-btn-primary:hover {
          background-color: #93E57E;
        }

        .portfolio-cockpit .ct-btn-secondary {
          background-color: transparent;
          color: var(--ct-text-muted);
          border: 1px solid var(--ct-panel-border);
        }

        .portfolio-cockpit .ct-btn-secondary:hover {
          background-color: rgba(255, 255, 255, 0.05);
          color: var(--ct-text-primary);
        }

        /* OUTPUT MAIN AREA */
        .portfolio-cockpit .kpi-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 24px;
        }

        .portfolio-cockpit .kpi-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .portfolio-cockpit .kpi-value {
          font-family: var(--ct-font-mono);
          font-size: 32px;
          font-weight: 400;
          color: var(--ct-text-primary);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }

        .portfolio-cockpit .chart-well {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }

        .portfolio-cockpit .chart-grid-bg {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        /* ASSISTANT RAIL */
        .portfolio-cockpit .assistant-rail {
          grid-column: 3;
          grid-row: 1;
          background: var(--ct-bg-rail);
          border-left: 1px solid var(--ct-surface-panel);
          display: flex; flex-direction: column;
          z-index: 10;
          box-shadow: -8px 0 24px rgba(0,0,0,0.5);
        }
        .portfolio-cockpit .assistant-header {
          padding: 24px; border-bottom: 1px solid var(--ct-panel-border);
          display: flex; justify-content: space-between; align-items: center;
        }
        .portfolio-cockpit .assistant-body {
          padding: 24px; flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 24px;
        }
        .portfolio-cockpit .chat-message { display: flex; flex-direction: column; gap: 6px; }
        .portfolio-cockpit .chat-message.user { align-items: flex-end; }
        
        .portfolio-cockpit .chat-bubble {
          background: var(--ct-surface-well); 
          border: 1px solid var(--ct-well-border);
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.8);
          border-radius: 12px; padding: 14px 16px; max-width: 92%;
          color: var(--ct-text-muted);
          line-height: 1.5;
        }
        .portfolio-cockpit .chat-message.user .chat-bubble {
          background: var(--ct-surface-panel); 
          color: var(--ct-text-primary);
          border: 1px solid var(--ct-panel-highlight);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          border-bottom-right-radius: 4px;
        }
        .portfolio-cockpit .chat-message:not(.user) .chat-bubble {
          border-bottom-left-radius: 4px;
        }
        
        .portfolio-cockpit .suggestion-chips { display: flex; flex-direction: column; gap: 8px; margin-top: auto; }
        .portfolio-cockpit .chip {
          padding: 10px 14px; border: 1px solid var(--ct-panel-border); border-radius: 8px;
          font-size: 12px; color: var(--ct-text-muted); cursor: pointer;
          background: var(--ct-surface-panel); transition: background 0.2s, color 0.2s;
        }
        .portfolio-cockpit .chip:hover { background: var(--ct-surface-hover); color: var(--ct-text-primary); }
        .portfolio-cockpit .assistant-input-area {
          padding: 24px; border-top: 1px solid var(--ct-panel-border); background: var(--ct-bg-rail);
        }
        .portfolio-cockpit .input-box {
          background: var(--ct-surface-well); 
          border: 1px solid var(--ct-well-border);
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.8);
          border-radius: 8px; padding: 14px; color: var(--ct-text-muted);
          display: flex; justify-content: space-between; align-items: center;
        }

        /* Status Bar */
        .portfolio-cockpit .status-bar {
          grid-column: 2 / 4;
          grid-row: 2;
          background: var(--ct-bg-rail);
          border-top: 1px solid var(--ct-panel-border);
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 48px;
          color: var(--ct-text-faint);
          height: 40px;
        }

        .portfolio-cockpit ::-webkit-scrollbar { width: 6px; height: 6px; }
        .portfolio-cockpit ::-webkit-scrollbar-track { background: transparent; }
        .portfolio-cockpit ::-webkit-scrollbar-thumb { background: var(--ct-panel-highlight); border-radius: 3px; }
        .portfolio-cockpit ::-webkit-scrollbar-thumb:hover { background: var(--ct-text-muted); }

        /* Badges */
        .portfolio-cockpit .badge {
          display: inline-flex; align-items: center; padding: 4px 8px;
          border-radius: 4px; border: 1px solid var(--ct-panel-border);
          background: var(--ct-surface-well);
          color: var(--ct-text-muted);
          font-family: var(--ct-font-sans);
          font-size: 11px;
          font-weight: 500;
        }
        .portfolio-cockpit .badge.pill {
          border-radius: 12px;
        }

      `}} />

      <div className="portfolio-cockpit">
        <div className="app-shell">

          {/* LEFT RAIL */}
          <nav className="left-rail">
            <div className="logo">
              <svg viewBox="0 0 24 24"><path d="M4 4h6v16H4V4zm10 0h6v16h-6V4z"/></svg>
            </div>
            <div className="nav-item">
              <div className="nav-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>
              <span className="text-micro">Portfolio</span>
            </div>
            <div className="nav-item active">
              <div className="nav-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg></div>
              <span className="text-micro">Invest</span>
            </div>
            <div className="nav-item">
              <div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 3L3 8v8l9 5 9-5V8l-9-5z"/></svg></div>
              <span className="text-micro">Proofs</span>
            </div>
            <div className="nav-item">
              <div className="nav-icon">
                <svg viewBox="0 0 24 24">
                  <rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/>
                  <rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>
                </svg>
              </div>
              <span className="text-micro">Admin</span>
            </div>
            <div className="user-avatar mono">CO</div>
          </nav>

          {/* MAIN CONTENT */}
          <main className="main-content">
            <header className="page-header">
              <div className="header-top">
                <div className="flex-col gap-1">
                  <h1 className="text-2xl text-primary font-medium">Scenario Modeler</h1>
                  <div className="text-sm text-muted">Configure and run investment simulations across different hardware mixes and geographies.</div>
                </div>
              </div>
            </header>

            <div className="projection-grid">
              
              {/* SIDEBAR: PARAMETERS (PLAQUE) */}
              <div className="panel" style={{ padding: 32 }}>
                <div className="panel-header">
                  <div className="text-lg">Simulation Parameters</div>
                </div>

                <div className="control-group">
                  <div className="uppercase-eyebrow">Investment Thesis</div>
                  <div className="segmented-control">
                    {['Shell + Long Lease', 'Compute Cloud', 'Sovereign AI Cluster'].map(option => (
                      <button
                        key={option}
                        className={thesis === option ? "segment-btn active" : "segment-btn"}
                        onClick={() => setThesis(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="control-group">
                  <div className="uppercase-eyebrow">Geography</div>
                  <div className="segmented-control row">
                    {['QA-01', 'AE-02', 'SA-01', 'GC-00'].map(option => (
                      <button
                        key={option}
                        className={geography === option ? "segment-btn active" : "segment-btn"}
                        onClick={() => setGeography(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="control-group">
                  <div className="uppercase-eyebrow">GPU Profile</div>
                  <div className="segmented-control row">
                    {['H100', 'H200', 'GB200', 'MI300X'].map(option => (
                      <button
                        key={option}
                        className={gpuProfile === option ? "segment-btn active" : "segment-btn"}
                        onClick={() => setGpuProfile(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="control-group">
                  <div className="uppercase-eyebrow">Target Capacity</div>
                  <div className="slider-container">
                    <input
                      type="range"
                      min="10"
                      max="1000"
                      step="10"
                      value={capacity}
                      onChange={(e) => setCapacity(Number(e.target.value))}
                      className="ct-slider"
                    />
                    <div className="mono text-base text-accent" style={{ width: 65, textAlign: 'right' }}>{capacity} MW</div>
                  </div>
                </div>

                <div className="control-group">
                  <div className="uppercase-eyebrow">AI Infrastructure Mix</div>
                  <div className="slider-container">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={aiMix}
                      onChange={(e) => setAiMix(Number(e.target.value))}
                      className="ct-slider"
                    />
                    <div className="mono text-base text-accent" style={{ width: 65, textAlign: 'right' }}>{aiMix} %</div>
                  </div>
                </div>

                <div className="ct-actions">
                  <button className="ct-btn ct-btn-secondary" onClick={handleReset}>Reset</button>
                  <button className="ct-btn ct-btn-primary" onClick={handleRunSimulation}>Run Simulation</button>
                </div>
              </div>

              {/* MAIN AREA: OUTPUT (PLAQUE) */}
              <div className="panel" style={{ padding: 32 }}>
                <div className="panel-header">
                  <div className="text-lg">Projection Output</div>
                  <div className="badge pill">DRAFT</div>
                </div>

                <div className="kpi-row">
                  <div className="well kpi-card">
                    <div className="uppercase-eyebrow">Target IRR</div>
                    <div className="kpi-value js-count-up">{irr}%</div>
                  </div>
                  <div className="well kpi-card">
                    <div className="uppercase-eyebrow">Total Capex</div>
                    <div className="kpi-value js-count-up">{`$${capex}B`}</div>
                  </div>
                  <div className="well kpi-card">
                    <div className="uppercase-eyebrow">Projected Yield</div>
                    <div className="kpi-value text-accent js-count-up">{yieldVal}%</div>
                  </div>
                </div>

                <div className="well chart-well">
                  <div className="chart-grid-bg"></div>
                  <div className="mono text-faint" style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, border: '1px dashed var(--ct-panel-border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                      </svg>
                    </div>
                    <span className="uppercase-eyebrow">Simulation Chart Placeholder</span>
                  </div>
                </div>
              </div>

            </div>
          </main>

          {/* ASSISTANT RAIL */}
          <aside className="assistant-rail">
            <div className="assistant-header">
              <div className="flex items-center gap-2">
                <div style={{width:8,height:8,background:"var(--ct-accent)",borderRadius:2}}></div>
                <span className="text-sm font-medium text-primary">Hearst Connect</span>
              </div>
              <div className="badge pill mono text-xs">AI</div>
            </div>
            
            <div className="assistant-body">
              <div className="chat-message">
                <div className="uppercase-eyebrow mb-1 ml-1">ASSISTANT</div>
                <div className="chat-bubble text-sm">
                  I can help you build scenarios. Do you want to optimize for maximum IRR or minimum Capex?
                </div>
              </div>
              
              <div className="suggestion-chips">
                <div className="chip">Optimize for IRR</div>
                <div className="chip">Minimize Capex</div>
                <div className="chip">Explain AI Mix impact</div>
              </div>
            </div>
            
            <div className="assistant-input-area">
              <div className="input-box">
                <span className="text-sm text-faint">Ask a question...</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ct-text-muted)" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
            </div>
          </aside>

          {/* STATUS BAR */}
          <footer className="status-bar">
            <div className="flex items-center gap-2">
              <div style={{width:4,height:4,background:"var(--ct-text-muted)",borderRadius:1}}></div>
              <span className="text-xs mono">Hearst DeFi Terminal v2.1</span>
            </div>
            <div className="flex gap-8 text-xs mono">
              <span>Disclaimer</span>
              <span>Privacy</span>
              <span>Terms</span>
            </div>
            <div className="flex items-center gap-2">
              <div style={{width:6,height:6,background:"var(--ct-accent)",borderRadius:1}}></div>
              <span className="text-xs mono">System Operational</span>
            </div>
          </footer>

        </div>
      </div>
    </>
  );
}