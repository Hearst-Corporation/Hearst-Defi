"use client";

import { useEffect } from "react";

export default function PortfolioLabPage() {
  useEffect(() => {
    const animatePaths = () => {
      const strokes = document.querySelectorAll('.chart-stroke-anim');
      strokes.forEach((p) => {
        const path = p as SVGPathElement;
        const length = path.getTotalLength();
        if (length > 0) {
          path.style.strokeDasharray = length.toString();
          path.style.strokeDashoffset = length.toString();
          path.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(0.85, 0, 0.15, 1)';
          path.getBoundingClientRect();
          path.style.strokeDashoffset = '0';
        }
      });
      
      const fills = document.querySelectorAll('.chart-fill-anim');
      fills.forEach((f) => {
        const fill = f as SVGPathElement;
        fill.style.opacity = '0';
        fill.style.transition = 'opacity 2s ease-in 0.6s';
        fill.getBoundingClientRect();
        fill.style.opacity = '1';
      });
    };

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

    const pathTimer = setTimeout(animatePaths, 100);
    const countTimer = setTimeout(runCountUp, 50);
    
    return () => {
      clearTimeout(pathTimer);
      clearTimeout(countTimer);
    };
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

          /* Chart Neutrals */
          --ct-chart-neutral-1: rgba(255, 255, 255, 0.70);
          --ct-chart-neutral-2: rgba(255, 255, 255, 0.45);
          --ct-chart-neutral-3: #1A1E29; /* Gris des barres vides (accordé aux plaques) */

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
          /* Subtle noise texture on the deep background */
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
        .portfolio-cockpit .header-micro-row {
          display: flex;
          gap: 40px;
          padding-top: 20px;
          border-top: 1px solid var(--ct-panel-border);
        }

        /* BENTO GRID */
        .portfolio-cockpit .dashboard-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          grid-auto-rows: minmax(100px, auto);
          gap: 24px;
          width: 100%;
          max-width: 1440px;
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
          margin-bottom: 20px;
        }
        
        /* WELLS: PUITS NOIRS ENCASTRÉS DANS LA PLAQUE GRISE */
        .portfolio-cockpit .well {
          background: var(--ct-surface-well);
          border: 1px solid var(--ct-well-border);
          border-top: 1px solid #000;
          box-shadow: inset 0 3px 10px rgba(0,0,0,0.8); /* Encastrement */
          border-radius: 8px; /* Coins plus secs pour les écrans internes */
          padding: 16px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .portfolio-cockpit .panel-hero { grid-column: span 8; grid-row: span 2; }
        .portfolio-cockpit .panel-signal-1 { grid-column: span 4; }
        .portfolio-cockpit .panel-signal-2 { grid-column: span 4; }
        
        .portfolio-cockpit .panel-allocation { grid-column: span 4; }
        .portfolio-cockpit .panel-calendar { grid-column: span 4; }
        .portfolio-cockpit .panel-trust { grid-column: span 4; }
        
        .portfolio-cockpit .panel-positions { grid-column: span 8; }
        .portfolio-cockpit .panel-activity { grid-column: span 4; }

        .portfolio-cockpit .signal-block {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
        }
        .portfolio-cockpit .signal-value {
          font-size: 28px;
          font-weight: 300;
          line-height: 1;
          margin: 12px 0 8px 0;
          color: var(--ct-text-primary);
        }
        .portfolio-cockpit .signal-sparkline {
          height: 36px;
          width: 100%;
          margin-top: auto;
          position: relative;
        }

        /* Badges */
        .portfolio-cockpit .badge {
          display: inline-flex; align-items: center; padding: 4px 8px;
          border-radius: 4px; border: 1px solid var(--ct-panel-border);
          background: var(--ct-surface-well); /* Badges encastrés aussi */
          color: var(--ct-text-muted);
          font-family: var(--ct-font-sans);
          font-size: 11px;
          font-weight: 500;
        }
        .portfolio-cockpit .badge.accent {
          border-color: var(--ct-accent-border);
          color: var(--ct-accent);
          background: var(--ct-accent-soft);
        }
        .portfolio-cockpit .badge.pill {
          border-radius: 12px;
        }

        /* Tables (Sur Plaque) */
        .portfolio-cockpit .table-container { width: 100%; overflow-x: auto; }
        .portfolio-cockpit table { width: 100%; border-collapse: collapse; text-align: right; }
        .portfolio-cockpit th { 
          padding-bottom: 12px; 
          border-bottom: 1px solid var(--ct-panel-border); 
          color: var(--ct-text-muted); 
          font-weight: 500; 
          font-size: 11px;
        }
        .portfolio-cockpit td { 
          padding: 16px 8px; 
          border-bottom: 1px solid var(--ct-panel-border); 
          color: var(--ct-text-primary);
          transition: background 0.15s;
        }
        .portfolio-cockpit th:first-child, .portfolio-cockpit td:first-child { text-align: left; padding-left: 0; }
        .portfolio-cockpit th:last-child, .portfolio-cockpit td:last-child { padding-right: 0; }
        .portfolio-cockpit tr:last-child td { border-bottom: none; padding-bottom: 0; }
        .portfolio-cockpit tbody tr:hover td { background: var(--ct-surface-hover); border-radius: 4px; }
        
        /* Timelines */
        .portfolio-cockpit .timeline { position: relative; padding-left: 20px; display: flex; flex-direction: column; gap: 24px; }
        .portfolio-cockpit .timeline::before {
          content: ''; position: absolute; left: 4px; top: 6px; bottom: 6px; width: 1px;
          background: var(--ct-panel-border);
        }
        .portfolio-cockpit .timeline-item { position: relative; display: flex; justify-content: space-between; align-items: flex-start; }
        .portfolio-cockpit .timeline-dot {
          position: absolute; left: -20px; top: 6px; width: 9px; height: 9px;
          border-radius: 50%; background: var(--ct-surface-panel); border: 2px solid var(--ct-panel-highlight);
        }
        .portfolio-cockpit .timeline-dot.active { 
          border-color: var(--ct-accent); 
          background: var(--ct-surface-panel);
        }

        /* SVGs */
        .portfolio-cockpit svg { display: block; width: 100%; overflow: visible; }
        .portfolio-cockpit .svg-grid-line { stroke: var(--ct-panel-border); stroke-width: 1; }
        .portfolio-cockpit .svg-axis-text { fill: var(--ct-text-faint); font-family: var(--ct-font-mono); font-size: 10px; }
        
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
        
        /* Bulles : Assistant (encastré noir), User (plaque grise saillante) */
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

        @keyframes fadeInSoft {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .portfolio-cockpit .panel {
          animation: fadeInSoft 0.4s ease-out forwards;
        }
        .portfolio-cockpit .panel:nth-child(1) { animation-delay: 0.05s; }
        .portfolio-cockpit .panel:nth-child(2) { animation-delay: 0.10s; }
        .portfolio-cockpit .panel:nth-child(3) { animation-delay: 0.15s; }
        .portfolio-cockpit .panel:nth-child(4) { animation-delay: 0.20s; }
        .portfolio-cockpit .panel:nth-child(5) { animation-delay: 0.25s; }
        .portfolio-cockpit .panel:nth-child(6) { animation-delay: 0.30s; }
        .portfolio-cockpit .panel:nth-child(7) { animation-delay: 0.35s; }
        .portfolio-cockpit .panel:nth-child(8) { animation-delay: 0.40s; }

        @media (max-width: 1400px) {
          .portfolio-cockpit .app-shell { grid-template-columns: 72px 1fr 300px; }
          .portfolio-cockpit .main-content { padding: 32px; }
          .portfolio-cockpit .dashboard-grid { grid-template-columns: repeat(8, 1fr); }
          .portfolio-cockpit .panel-hero { grid-column: span 8; }
          .portfolio-cockpit .panel-signal-1 { grid-column: span 4; }
          .portfolio-cockpit .panel-signal-2 { grid-column: span 4; }
          .portfolio-cockpit .panel-allocation { grid-column: span 8; }
          .portfolio-cockpit .panel-calendar { grid-column: span 4; }
          .portfolio-cockpit .panel-trust { grid-column: span 4; }
          .portfolio-cockpit .panel-positions { grid-column: span 8; }
          .portfolio-cockpit .panel-activity { grid-column: span 8; }
        }
        @media (max-width: 1024px) {
          .portfolio-cockpit .app-shell { grid-template-columns: 72px 1fr; }
          .portfolio-cockpit .assistant-rail { display: none; }
          .portfolio-cockpit .status-bar { grid-column: 2 / 3; }
        }
      `}} />

      <div className="portfolio-cockpit">
        <div className="app-shell">

          {/* LEFT RAIL */}
          <nav className="left-rail">
            <div className="logo">
              <svg viewBox="0 0 24 24"><path d="M4 4h6v16H4V4zm10 0h6v16h-6V4z"/></svg>
            </div>
            <div className="nav-item active">
              <div className="nav-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>
              <span className="text-micro">Portfolio</span>
            </div>
            <div className="nav-item">
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
                  <h1 className="uppercase-eyebrow">Consolidated Portfolio</h1>
                  <div className="flex items-baseline gap-4 mt-1">
                    <span className="text-3xl mono text-primary js-count-up">$284,750.00</span>
                    <span className="text-base mono text-accent js-count-up">+14.2% YTD</span>
                  </div>
                </div>
                <div className="flex-col items-end gap-1 text-right">
                  <div className="uppercase-eyebrow">Blended APY Range</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xl mono text-primary">9.4–12.8%</span>
                    <span className="text-micro text-faint">(NOT GUARANTEED)</span>
                  </div>
                </div>
              </div>
              
              <div className="header-micro-row">
                <div className="micro-stat">
                  <span className="uppercase-eyebrow">Status</span>
                  <div className="flex items-center gap-2">
                    <div style={{width:6, height:6, background:"var(--ct-accent)", borderRadius:"50%"}}></div>
                    <span className="text-sm text-primary">Audited</span>
                  </div>
                </div>
                <div className="micro-stat">
                  <span className="uppercase-eyebrow">Reporting Date</span>
                  <span className="text-sm mono text-primary">Oct 14, 2025</span>
                </div>
                <div className="micro-stat">
                  <span className="uppercase-eyebrow">Reserve Coverage</span>
                  <span className="text-sm mono text-primary js-count-up">102.4%</span>
                </div>
                <div className="micro-stat">
                  <span className="uppercase-eyebrow">Principal</span>
                  <span className="text-sm mono text-primary js-count-up">$260,000.00</span>
                </div>
              </div>
            </header>

            <div className="dashboard-grid">
              
              {/* 1. HERO AREA CHART */}
              <div className="panel panel-hero">
                <div className="panel-header">
                  <div className="text-lg">12-Month Performance</div>
                  <div className="flex gap-2">
                    <div className="badge pill">1M</div>
                    <div className="badge pill">3M</div>
                    <div className="badge pill accent">1Y</div>
                    <div className="badge pill">ALL</div>
                  </div>
                </div>
                
                {/* WELL: Encastré Noir */}
                <div className="well" style={{height: 260, padding: "0 16px"}}>
                  <svg viewBox="0 0 1000 200" preserveAspectRatio="none" style={{height: "100%", width: "100%"}}>
                    <path className="svg-grid-line" d="M 0 40 L 1000 40 M 0 100 L 1000 100 M 0 160 L 1000 160" />
                    <text x="0" y="32" className="svg-axis-text">UPPER BOUND</text>
                    <text x="0" y="92" className="svg-axis-text">MEDIAN</text>
                    <text x="0" y="152" className="svg-axis-text">LOWER BOUND</text>

                    <path className="chart-fill-anim" d="M 0 160 C 80 155, 160 140, 250 145 C 330 150, 410 110, 500 90 C 580 70, 660 80, 750 40 C 830 0, 910 20, 1000 0 L 1000 200 L 0 200 Z" 
                          fill="var(--ct-accent)" fillOpacity="0.12" />
                    <path className="chart-stroke-anim" d="M 0 160 C 80 155, 160 140, 250 145 C 330 150, 410 110, 500 90 C 580 70, 660 80, 750 40 C 830 0, 910 20, 1000 0" 
                          stroke="var(--ct-accent)" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
                    
                    <circle cx="1000" cy="0" r="3" fill="var(--ct-accent)" />
                  </svg>
                  
                  <div style={{position: "absolute", top: 16, left: 24}}>
                    <div className="uppercase-eyebrow mb-1">Peak Value</div>
                    <div className="mono text-lg text-primary js-count-up">$284,750</div>
                  </div>
                </div>
              </div>

              {/* 2. SIGNAL: VOLATILITY */}
              <div className="panel panel-signal-1">
                <div className="panel-header">
                  <div className="text-base font-medium">Realized Volatility</div>
                  <div className="badge accent">LOW</div>
                </div>
                <div className="well">
                  <div className="signal-block">
                    <div className="uppercase-eyebrow">30D ANNUALIZED</div>
                    <div className="signal-value mono js-count-up">4.2%</div>
                    <div className="text-xs text-accent mt-1">−0.8% FROM LAST WEEK</div>
                    <div className="signal-sparkline mt-4">
                      <svg viewBox="0 0 100 20" preserveAspectRatio="none">
                        <path className="chart-stroke-anim" d="M 0 15 L 20 12 L 40 14 L 60 8 L 80 10 L 100 5" stroke="var(--ct-accent)" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
                        <circle cx="20" cy="12" r="1.5" fill="var(--ct-accent)" />
                        <circle cx="40" cy="14" r="1.5" fill="var(--ct-accent)" />
                        <circle cx="60" cy="8" r="1.5" fill="var(--ct-accent)" />
                        <circle cx="80" cy="10" r="1.5" fill="var(--ct-accent)" />
                        <circle cx="100" cy="5" r="2.5" fill="var(--ct-accent)" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. SIGNAL: SHARPE RATIO */}
              <div className="panel panel-signal-2">
                <div className="panel-header">
                  <div className="text-base font-medium">Sharpe Ratio</div>
                  <div className="badge pill">Q3</div>
                </div>
                <div className="well">
                  <div className="signal-block">
                    <div className="uppercase-eyebrow">RISK-ADJUSTED RETURN</div>
                    <div className="signal-value mono js-count-up">2.84</div>
                    <div className="text-xs text-muted mt-1">BENCHMARK: 1.42</div>
                    <div className="signal-sparkline mt-4">
                      <svg viewBox="0 0 100 20" preserveAspectRatio="none">
                        <path className="chart-stroke-anim" d="M 0 18 L 25 15 L 50 16 L 75 10 L 100 8" stroke="var(--ct-chart-neutral-2)" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
                        <circle cx="25" cy="15" r="1.5" fill="var(--ct-chart-neutral-2)" />
                        <circle cx="50" cy="16" r="1.5" fill="var(--ct-chart-neutral-2)" />
                        <circle cx="75" cy="10" r="1.5" fill="var(--ct-chart-neutral-2)" />
                        <circle cx="100" cy="8" r="2.5" fill="var(--ct-chart-neutral-1)" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. ALLOCATION DONUT */}
              <div className="panel panel-allocation">
                <div className="panel-header">
                  <div className="text-base font-medium">Capital Allocation</div>
                  <div className="text-xs mono text-faint">100%</div>
                </div>
                <div className="well flex items-center gap-6 h-full">
                  <div style={{width: 88, height: 88, flexShrink: 0, position: "relative"}}>
                    <svg viewBox="0 0 40 40" style={{transform: "rotate(-90deg)"}}>
                      <circle cx="20" cy="20" r="15.9155" fill="none" stroke="var(--ct-panel-border)" strokeWidth="5" />
                      <circle className="chart-stroke-anim" cx="20" cy="20" r="15.9155" fill="none" stroke="var(--ct-accent)" strokeWidth="5" strokeDasharray="45 100" strokeDashoffset="0" />
                      <circle className="chart-stroke-anim" cx="20" cy="20" r="15.9155" fill="none" stroke="var(--ct-chart-neutral-1)" strokeWidth="5" strokeDasharray="25 100" strokeDashoffset="-45" />
                      <circle className="chart-stroke-anim" cx="20" cy="20" r="15.9155" fill="none" stroke="var(--ct-chart-neutral-2)" strokeWidth="5" strokeDasharray="18 100" strokeDashoffset="-70" />
                      <circle className="chart-stroke-anim" cx="20" cy="20" r="15.9155" fill="none" stroke="var(--ct-chart-neutral-3)" strokeWidth="5" strokeDasharray="8 100" strokeDashoffset="-88" />
                      <circle className="chart-stroke-anim" cx="20" cy="20" r="15.9155" fill="none" stroke="var(--ct-panel-border)" strokeWidth="5" strokeDasharray="4 100" strokeDashoffset="-96" />
                    </svg>
                  </div>
                  <div className="flex-col gap-2 w-full">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><div style={{width:6,height:6,background:"var(--ct-accent)",borderRadius:1}}></div><span className="text-xs text-secondary">Mining Cashflow</span></div>
                      <div className="mono text-xs text-primary js-count-up">45%</div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><div style={{width:6,height:6,background:"var(--ct-chart-neutral-1)",borderRadius:1}}></div><span className="text-xs text-secondary">USDC Reserve</span></div>
                      <div className="mono text-xs text-primary js-count-up">25%</div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><div style={{width:6,height:6,background:"var(--ct-chart-neutral-2)",borderRadius:1}}></div><span className="text-xs text-secondary">Compute Credit</span></div>
                      <div className="mono text-xs text-primary js-count-up">18%</div>
                    </div>
                    <div className="flex justify-between items-center mt-1 pt-2" style={{borderTop: "1px solid var(--ct-well-border)"}}>
                      <span className="text-xs text-faint">Buffer & Fees</span>
                      <span className="mono text-xs text-faint">12%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. PAYOUT CALENDAR */}
              <div className="panel panel-calendar">
                <div className="panel-header">
                  <div className="text-base font-medium">Distributions (USDC)</div>
                  <div className="text-xs mono text-muted">12M: <span className="text-primary js-count-up">$24,750</span></div>
                </div>
                <div className="well" style={{display: "flex", alignItems: "flex-end", padding: "16px 20px"}}>
                  <svg viewBox="0 0 230 100" preserveAspectRatio="none" style={{height: "100%"}}>
                    <line x1="0" y1="100" x2="230" y2="100" className="svg-grid-line" />
                    <rect x="0" y="60" width="10" height="40" fill="var(--ct-chart-neutral-3)" rx="2" />
                    <rect x="20" y="55" width="10" height="45" fill="var(--ct-chart-neutral-3)" rx="2" />
                    <rect x="40" y="70" width="10" height="30" fill="var(--ct-chart-neutral-3)" rx="2" />
                    <rect x="60" y="50" width="10" height="50" fill="var(--ct-chart-neutral-3)" rx="2" />
                    <rect x="80" y="45" width="10" height="55" fill="var(--ct-chart-neutral-3)" rx="2" />
                    <rect x="100" y="35" width="10" height="65" fill="var(--ct-chart-neutral-3)" rx="2" />
                    <rect x="120" y="40" width="10" height="60" fill="var(--ct-chart-neutral-3)" rx="2" />
                    <rect x="140" y="25" width="10" height="75" fill="var(--ct-chart-neutral-3)" rx="2" />
                    <rect x="160" y="30" width="10" height="70" fill="var(--ct-chart-neutral-3)" rx="2" />
                    <rect x="180" y="20" width="10" height="80" fill="var(--ct-accent)" rx="2" className="chart-fill-anim" />
                    {/* Future Projections - Dashed */}
                    <rect x="200" y="15" width="10" height="85" fill="transparent" stroke="var(--ct-panel-border)" strokeWidth="1.5" strokeDasharray="2 2" rx="2" />
                    <rect x="220" y="10" width="10" height="90" fill="transparent" stroke="var(--ct-panel-border)" strokeWidth="1.5" strokeDasharray="2 2" rx="2" />
                  </svg>
                </div>
              </div>

              {/* 6. TRUST & PROOF */}
              <div className="panel panel-trust">
                <div className="panel-header">
                  <div className="text-base font-medium">Trust & Proof</div>
                  <div className="badge pill">VERIFIED</div>
                </div>
                <div className="well flex items-center gap-6 h-full">
                  <div style={{width: 72, height: 48, position: "relative"}}>
                    <svg viewBox="0 0 100 50" style={{position: "absolute", bottom: 0}}>
                      <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--ct-panel-border)" strokeWidth="8" strokeLinecap="round" />
                      <path className="chart-stroke-anim" d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--ct-accent)" strokeWidth="8" strokeDasharray="103 125.66" strokeLinecap="round" />
                    </svg>
                    <div className="mono text-xl text-primary js-count-up" style={{position: "absolute", bottom: 0, width: "100%", textAlign: "center"}}>82</div>
                  </div>
                  <div className="flex-col w-full gap-3">
                    <div className="flex justify-between items-center border-b pb-2" style={{borderBottom: "1px solid var(--ct-well-border)"}}>
                      <span className="text-xs text-secondary">Reserve Coverage</span>
                      <span className="text-xs mono text-primary js-count-up">102.4%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-secondary">On-chain Proof</span>
                      <span className="text-xs mono text-accent">AUDITED</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 7. POSITIONS TABLE (Directement sur la plaque grise) */}
              <div className="panel panel-positions">
                <div className="panel-header">
                  <div className="text-base font-medium">Active Vaults</div>
                  <div className="badge pill">3 ACTIVE</div>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr className="uppercase-eyebrow">
                        <th>Asset / Strategy</th>
                        <th>Principal</th>
                        <th>Current Value</th>
                        <th>APY Range</th>
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      <tr>
                        <td>
                          <div className="text-primary font-medium">Alpha BTC Mining Note</div>
                          <div className="uppercase-eyebrow mt-1">MINING YIELD • MODERATE</div>
                        </td>
                        <td className="mono text-secondary text-sm js-count-up">$115,000</td>
                        <td className="mono text-primary text-sm js-count-up">$128,400</td>
                        <td className="mono text-secondary text-sm">11.0–14.5%</td>
                        <td>
                          <div style={{width: 48, height: 16, display: "inline-block"}}>
                            <svg viewBox="0 0 48 16" preserveAspectRatio="none">
                              <path className="chart-stroke-anim" d="M 0 14 L 12 10 L 24 12 L 36 6 L 48 2" stroke="var(--ct-accent)" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
                            </svg>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div className="text-primary font-medium">USDC Reserve Sleeve</div>
                          <div className="uppercase-eyebrow mt-1">STABLECOIN • LOW RISK</div>
                        </td>
                        <td className="mono text-secondary text-sm js-count-up">$70,000</td>
                        <td className="mono text-primary text-sm js-count-up">$72,350</td>
                        <td className="mono text-secondary text-sm">6.5–8.0%</td>
                        <td>
                          <div style={{width: 48, height: 16, display: "inline-block"}}>
                            <svg viewBox="0 0 48 16" preserveAspectRatio="none">
                              <path className="chart-stroke-anim" d="M 0 12 L 16 10 L 32 9 L 48 6" stroke="var(--ct-accent)" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
                            </svg>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div className="text-primary font-medium">Compute Yield Vault</div>
                          <div className="uppercase-eyebrow mt-1">INFRASTRUCTURE • MOD-HIGH</div>
                        </td>
                        <td className="mono text-secondary text-sm js-count-up">$75,000</td>
                        <td className="mono text-primary text-sm js-count-up">$84,000</td>
                        <td className="mono text-secondary text-sm">9.0–12.0%</td>
                        <td>
                          <div style={{width: 48, height: 16, display: "inline-block"}}>
                            <svg viewBox="0 0 48 16" preserveAspectRatio="none">
                              <path className="chart-stroke-anim" d="M 0 14 L 16 12 L 32 8 L 48 4" stroke="var(--ct-accent)" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
                            </svg>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-between items-center uppercase-eyebrow">
                  <div className="flex items-center gap-2">
                    <div style={{width:6,height:6,background:"var(--ct-accent)",borderRadius:1}}></div>
                    <span>Assembled from On-chain Proofs</span>
                  </div>
                  <span className="mono">Ref: 0x82f...a12</span>
                </div>
              </div>

              {/* 8. ACTIVITY TIMELINE */}
              <div className="panel panel-activity">
                <div className="panel-header">
                  <div className="text-base font-medium">Recent Activity</div>
                  <div className="badge pill">VIEW ALL</div>
                </div>
                {/* Timeline sur la plaque grise, sans puits */}
                <div style={{flexGrow: 1, padding: "8px 0"}}>
                  <div className="timeline">
                    <div className="timeline-item">
                      <div className="timeline-dot active"></div>
                      <div className="flex-col gap-1">
                        <div className="text-sm text-primary font-medium">Yield Distribution</div>
                        <div className="uppercase-eyebrow">OCT 14 • COMPLETED</div>
                      </div>
                      <div className="mono text-sm text-accent js-count-up">+$2,450</div>
                    </div>
                    <div className="timeline-item">
                      <div className="timeline-dot"></div>
                      <div className="flex-col gap-1">
                        <div className="text-sm text-secondary font-medium">Reserve Rebalance</div>
                        <div className="uppercase-eyebrow">OCT 12 • VERIFIED</div>
                      </div>
                      <div className="mono text-sm text-secondary">USDC</div>
                    </div>
                  </div>
                </div>
                {/* Evidence Link */}
                <div className="mt-4 p-3 border rounded-lg flex items-center justify-between" style={{border: "1px solid var(--ct-panel-border)", background: "var(--ct-surface-well)"}}>
                  <span className="uppercase-eyebrow">Audit Hash: 82f9...12a</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ct-text-muted)" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
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
              <div className="chat-message user">
                <div className="chat-bubble text-sm">
                  What was the average yield last quarter?
                </div>
              </div>
              
              <div className="chat-message">
                <div className="uppercase-eyebrow mb-1 ml-1">ASSISTANT</div>
                <div className="chat-bubble text-sm">
                  The blended APY for Q3 2025 was 11.2%, driven primarily by the Compute Yield Vault outperformance. Total distributions were $7,240.
                </div>
              </div>
              
              <div className="suggestion-chips">
                <div className="chip">Explain last payout</div>
                <div className="chip">Show proof trail</div>
                <div className="chip">Compare APY ranges</div>
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
