import React from 'react';
import { Compass, Cpu, BatteryCharging, Radio, FileCode2, ShieldAlert, Award } from 'lucide-react';

export type ActiveTab = 'overview' | 'profiler' | 'states' | 'energy' | 'argos' | 'code' | 'defense';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onQuickSim: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange, onQuickSim }) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onTabChange('overview')}
            className="text-base font-bold tracking-tight text-white hover:text-cyan-400 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Compass className="w-5 h-5 text-cyan-400" />
            <span>X Drifter</span>
          </button>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>·</span>
            <span>SIH 2026 PS 26065</span>
            <span>·</span>
            <span>MoES / NCPOR</span>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Clean text with hover state) */}
        <nav className="hidden lg:flex items-center gap-5 text-xs font-medium">
          <button
            onClick={() => onTabChange('overview')}
            className={`transition-colors py-1 cursor-pointer ${
              activeTab === 'overview'
                ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            System Specs
          </button>

          <button
            onClick={() => onTabChange('profiler')}
            className={`transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'profiler'
                ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Profiler Sim
          </button>

          <button
            onClick={() => onTabChange('states')}
            className={`transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'states'
                ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            State Machine
          </button>

          <button
            onClick={() => onTabChange('energy')}
            className={`transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'energy'
                ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BatteryCharging className="w-3.5 h-3.5" />
            Energy Gate
          </button>

          <button
            onClick={() => onTabChange('argos')}
            className={`transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'argos'
                ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Argos 31B Codec
          </button>

          <button
            onClick={() => onTabChange('code')}
            className={`transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'code'
                ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            Firmware Tree
          </button>

          <button
            onClick={() => onTabChange('defense')}
            className={`transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'defense'
                ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Pitch & Q&A
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={onQuickSim}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors whitespace-nowrap shadow-sm cursor-pointer"
          >
            Run Profile Cast
          </button>
        </div>

      </div>

      {/* Mobile sub-bar */}
      <div className="lg:hidden flex items-center gap-2 overflow-x-auto px-4 py-2 border-t border-slate-800 bg-slate-900/60 text-xs">
        {(['overview', 'profiler', 'states', 'energy', 'argos', 'code', 'defense'] as ActiveTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-2.5 py-1 rounded text-xs capitalize whitespace-nowrap ${
              activeTab === tab ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </header>
  );
};
