import React, { useState } from 'react';
import { Navigation, ActiveTab } from './components/Navigation';
import { PhysicalDiagram } from './components/PhysicalDiagram';
import { ProfilerSimulator } from './components/ProfilerSimulator';
import { StateMachineViewer } from './components/StateMachineViewer';
import { EnergyGateSimulator } from './components/EnergyGateSimulator';
import { ArgosInspector } from './components/ArgosInspector';
import { FirmwareExplorer } from './components/FirmwareExplorer';
import { DefenseDeck } from './components/DefenseDeck';
import { Anchor, Compass, ShieldCheck, Waves, Cpu, Award } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  const handleQuickSim = () => {
    setActiveTab('profiler');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* 3-Zone Top Bar Contract */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onQuickSim={handleQuickSim}
      />

      {/* Main Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Editorial Subtitle Kicker (Clean unboxed text, no pills) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/80 gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Autonomous Upper-Ocean Profiling System
            </h1>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-1">
              <span>Southern Ocean 0.3–10 m CTD</span>
              <span aria-hidden="true">·</span>
              <span>180-Day Mission Life</span>
              <span aria-hidden="true">·</span>
              <span>Argos-4 / Oceansat-3 Link</span>
              <span aria-hidden="true">·</span>
              <span className="text-cyan-400">SIH 2026 PS 26065</span>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
            <span>Ministry of Earth Sciences</span>
            <span aria-hidden="true">/</span>
            <span className="text-white font-medium">NCPOR Goa</span>
          </div>
        </div>

        {/* Tab Views */}
        {activeTab === 'overview' && <PhysicalDiagram />}
        {activeTab === 'profiler' && <ProfilerSimulator />}
        {activeTab === 'states' && <StateMachineViewer />}
        {activeTab === 'energy' && <EnergyGateSimulator />}
        {activeTab === 'argos' && <ArgosInspector />}
        {activeTab === 'code' && <FirmwareExplorer />}
        {activeTab === 'defense' && <DefenseDeck />}

      </main>

      {/* Subtle, Clean Engineering Footer (No fake telemetry tickers) */}
      <footer className="border-t border-slate-800 bg-slate-950/80 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-slate-500">
          <div>
            X-Drifter Master Design v3 · Ministry of Earth Sciences / NCPOR · Smart India Hackathon 2026
          </div>
          <div className="flex items-center gap-3">
            <span>STM32L476 Superloop</span>
            <span>·</span>
            <span>Kinéis KIM1 (400 MHz)</span>
            <span>·</span>
            <span>INCOIS Archive Format</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
