"use client";

import React, { useState } from 'react';

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
    // In a real app, this would trigger a calculation or API call
  };

  // Mock calculations for KPIs based on sliders to make it feel alive
  const capex = (capacity * 8.5 * (1 + aiMix / 100)).toFixed(1);
  const irr = (15 + (aiMix / 100) * 8 + (capacity > 500 ? 2 : 0)).toFixed(1);
  const yieldVal = (12 + (aiMix / 100) * 10).toFixed(1);

  return (
    <div className="sandbox-projection-container">
      <style dangerouslySetInnerHTML={{ __html: `
        .sandbox-projection-container {
          --ct-bg-rail: #020305;
          --ct-bg-canvas: #080A0F;
          --ct-surface-panel: #161922;
          --ct-border-panel: #222736;
          --ct-bevel-top: #303747;
          --ct-well-bg: #000000;
          --ct-accent: #A7FB90;
          --ct-text-primary: #FFFFFF;
          --ct-text-muted: rgba(255,255,255,0.65);
          
          --ct-font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          --ct-font-mono: "SF Mono", "SFMono-Regular", ui-monospace, "Roboto Mono", Menlo, Monaco, Consolas, monospace;

          background-color: var(--ct-bg-rail);
          padding: 32px;
          min-height: 100vh;
          font-family: var(--ct-font-sans);
          color: var(--ct-text-primary);
          box-sizing: border-box;
        }

        .ct-canvas {
          background-color: var(--ct-bg-canvas);
          border-radius: 16px;
          padding: 32px;
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 32px;
          min-height: calc(100vh - 64px);
        }

        .ct-header {
          grid-column: 1 / -1;
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
          color: var(--ct-text-primary);
        }

        .ct-panel {
          background-color: var(--ct-surface-panel);
          border: 1px solid var(--ct-border-panel);
          border-top: 1px solid var(--ct-bevel-top);
          border-radius: 12px;
          box-shadow: 0 12px 24px rgba(0,0,0,0.5);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .ct-panel-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--ct-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ct-panel-title::before {
          content: '';
          display: block;
          width: 8px;
          height: 8px;
          background-color: var(--ct-accent);
          border-radius: 50%;
        }

        .ct-control-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ct-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--ct-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .ct-segmented-control {
          background-color: var(--ct-well-bg);
          box-shadow: inset 0 3px 10px rgba(0,0,0,0.8);
          border-radius: 8px;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ct-segmented-control.row {
          flex-direction: row;
        }

        .ct-segmented-control.row > button {
          flex: 1;
        }

        .ct-segment-btn {
          background: transparent;
          border: none;
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

        .ct-segment-btn:hover:not(.active) {
          color: var(--ct-text-primary);
          background-color: rgba(255, 255, 255, 0.05);
        }

        .ct-segment-btn.active {
          background-color: var(--ct-surface-panel);
          border: 1px solid var(--ct-bevel-top);
          color: var(--ct-accent);
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }

        .ct-slider-container {
          display: flex;
          align-items: center;
          gap: 16px;
          background-color: var(--ct-well-bg);
          box-shadow: inset 0 3px 10px rgba(0,0,0,0.8);
          padding: 12px 16px;
          border-radius: 8px;
        }

        .ct-slider {
          flex: 1;
          -webkit-appearance: none;
          background: #1A1D27;
          height: 4px;
          border-radius: 2px;
          outline: none;
        }

        .ct-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--ct-surface-panel);
          border: 2px solid var(--ct-accent);
          cursor: pointer;
          transition: transform 0.1s;
        }

        .ct-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .ct-slider-value {
          font-family: var(--ct-font-mono);
          font-size: 13px;
          color: var(--ct-accent);
          width: 65px;
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-weight: 600;
        }

        .ct-actions {
          display: flex;
          gap: 16px;
          margin-top: 16px;
          padding-top: 24px;
          border-top: 1px solid var(--ct-border-panel);
        }

        .ct-btn {
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

        .ct-btn:active {
          transform: translateY(1px);
        }

        .ct-btn-primary {
          background-color: var(--ct-accent);
          color: #000000;
        }

        .ct-btn-primary:hover {
          background-color: #93E57E;
        }

        .ct-btn-secondary {
          background-color: transparent;
          color: var(--ct-text-muted);
          border: 1px solid var(--ct-border-panel);
        }

        .ct-btn-secondary:hover {
          background-color: rgba(255, 255, 255, 0.05);
          color: var(--ct-text-primary);
        }

        .ct-main-area {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .ct-kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .ct-kpi-card {
          background-color: var(--ct-surface-panel);
          border: 1px solid var(--ct-border-panel);
          border-top: 1px solid var(--ct-bevel-top);
          border-radius: 12px;
          box-shadow: 0 12px 24px rgba(0,0,0,0.5);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
          overflow: hidden;
        }

        .ct-kpi-card::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 60px;
          height: 60px;
          background: radial-gradient(circle at top right, rgba(167, 251, 144, 0.1), transparent 70%);
        }

        .ct-kpi-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--ct-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .ct-kpi-value {
          font-family: var(--ct-font-mono);
          font-size: 32px;
          font-weight: 500;
          color: var(--ct-accent);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }

        .ct-chart-well {
          background-color: var(--ct-well-bg);
          box-shadow: inset 0 3px 10px rgba(0,0,0,0.8);
          border-radius: 12px;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px solid #111;
          position: relative;
          overflow: hidden;
        }

        .ct-chart-grid {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .ct-chart-placeholder {
          font-family: var(--ct-font-mono);
          color: var(--ct-accent);
          font-size: 14px;
          opacity: 0.6;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .ct-chart-icon {
          width: 48px;
          height: 48px;
          border: 1px dashed rgba(167, 251, 144, 0.3);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}} />

      <div className="ct-canvas">
        <div className="ct-header">Scenario Modeler</div>

        {/* SIDEBAR */}
        <div className="ct-panel">
          <div className="ct-panel-title">Simulation Parameters</div>

          <div className="ct-control-group">
            <div className="ct-label">Investment Thesis</div>
            <div className="ct-segmented-control">
              {['Shell + Long Lease', 'Compute Cloud', 'Sovereign AI Cluster'].map(option => (
                <button
                  key={option}
                  className={thesis === option ? "ct-segment-btn active" : "ct-segment-btn"}
                  onClick={() => setThesis(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="ct-control-group">
            <div className="ct-label">Geography</div>
            <div className="ct-segmented-control row">
              {['QA-01', 'AE-02', 'SA-01', 'GC-00'].map(option => (
                <button
                  key={option}
                  className={geography === option ? "ct-segment-btn active" : "ct-segment-btn"}
                  onClick={() => setGeography(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="ct-control-group">
            <div className="ct-label">GPU Profile</div>
            <div className="ct-segmented-control row">
              {['H100', 'H200', 'GB200', 'MI300X'].map(option => (
                <button
                  key={option}
                  className={gpuProfile === option ? "ct-segment-btn active" : "ct-segment-btn"}
                  onClick={() => setGpuProfile(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="ct-control-group">
            <div className="ct-label">Target Capacity</div>
            <div className="ct-slider-container">
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="ct-slider"
              />
              <div className="ct-slider-value">{capacity} MW</div>
            </div>
          </div>

          <div className="ct-control-group">
            <div className="ct-label">AI Infrastructure Mix</div>
            <div className="ct-slider-container">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={aiMix}
                onChange={(e) => setAiMix(Number(e.target.value))}
                className="ct-slider"
              />
              <div className="ct-slider-value">{aiMix} %</div>
            </div>
          </div>

          <div className="ct-actions">
            <button className="ct-btn ct-btn-secondary" onClick={handleReset}>Reset</button>
            <button className="ct-btn ct-btn-primary" onClick={handleRunSimulation}>Run Simulation</button>
          </div>
        </div>

        {/* MAIN AREA */}
        <div className="ct-main-area">
          <div className="ct-kpi-grid">
            <div className="ct-kpi-card">
              <div className="ct-kpi-label">Target IRR</div>
              <div className="ct-kpi-value">{irr}%</div>
            </div>
            <div className="ct-kpi-card">
              <div className="ct-kpi-label">Total Capex</div>
              <div className="ct-kpi-value">{`$${capex}B`}</div>
            </div>
            <div className="ct-kpi-card">
              <div className="ct-kpi-label">Projected Yield</div>
              <div className="ct-kpi-value">{yieldVal}%</div>
            </div>
          </div>

          <div className="ct-chart-well">
            <div className="ct-chart-grid"></div>
            <div className="ct-chart-placeholder">
              <div className="ct-chart-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
              </div>
              Projection Output Chart
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
