import React, { useState } from 'react';
import { FolderTree, FileCode, Copy, Check, Download, Search, Terminal, FileText } from 'lucide-react';
import { FIRMWARE_CODEBASE, CodeFile } from '../services/firmwareCodebase';

export const FirmwareExplorer: React.FC = () => {
  const [selectedFilePath, setSelectedFilePath] = useState<string>('firmware/main-mcu/src/main.c');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterModule, setFilterModule] = useState<'all' | 'main' | 'probe' | 'ground' | 'sim' | 'docs' | 'hw'>('all');
  const [copied, setCopied] = useState<boolean>(false);

  const filteredFiles = FIRMWARE_CODEBASE.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterModule === 'main') return f.path.startsWith('firmware/main-mcu');
    if (filterModule === 'probe') return f.path.startsWith('firmware/probe-mcu');
    if (filterModule === 'ground') return f.path.startsWith('ground');
    if (filterModule === 'sim') return f.path.startsWith('sim');
    if (filterModule === 'docs') return f.path.startsWith('docs');
    if (filterModule === 'hw') return f.path.startsWith('hardware');

    return true;
  });

  const activeFile: CodeFile = FIRMWARE_CODEBASE.find(f => f.path === selectedFilePath) || FIRMWARE_CODEBASE[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      
      {/* Header and File Tree Intro */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">X-Drifter Firmware &amp; Ground Pipeline Codebase</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Bare-Metal C &amp; Python
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Event-driven superloop (no RTOS), drivers for KIM1 &amp; NEO-M9N, 180-day energy ledger, and ground station decoder.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Active File</span>
            </button>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-4 pt-4 border-t border-slate-800">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search source files or symbols..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-400 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto text-xs font-mono">
            {[
              { id: 'all', label: 'All Files' },
              { id: 'main', label: 'Main MCU' },
              { id: 'probe', label: 'Probe MCU' },
              { id: 'ground', label: 'Ground Python' },
              { id: 'sim', label: 'Simulators' },
              { id: 'docs', label: 'Docs' },
              { id: 'hw', label: 'Hardware/BOM' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterModule(f.id as any)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  filterModule === f.id
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Explorer Workspace: Left File Tree, Right Code Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: File Tree Selector */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between max-h-[640px] overflow-y-auto">
          <div>
            <div className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 pb-2 mb-3 border-b border-slate-800 flex items-center justify-between">
              <span>Repository Tree</span>
              <span className="text-slate-500">{filteredFiles.length} files</span>
            </div>

            <div className="space-y-1">
              {filteredFiles.map(file => {
                const isSelected = file.path === selectedFilePath;
                return (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFilePath(file.path)}
                    className={`w-full text-left p-2 rounded-lg font-mono text-xs transition-colors cursor-pointer flex items-start gap-2 ${
                      isSelected
                        ? 'bg-cyan-950/60 border border-cyan-500/40 text-cyan-300'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <FileCode className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <div className="truncate">
                      <div className="font-semibold truncate text-white">{file.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{file.path}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-500 mt-4">
            Toolchain: arm-none-eabi-gcc + make · Nucleo-L476RG Prototype
          </div>
        </div>

        {/* Right Column: Code Viewer with Line Numbers */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between max-h-[640px]">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold font-mono text-white">{activeFile.name}</h3>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {activeFile.language}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{activeFile.path}</p>
                <p className="text-xs text-cyan-400 mt-1">{activeFile.description}</p>
              </div>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer transition-colors self-start sm:self-auto"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Code Content Container */}
            <div className="mt-4 bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs overflow-x-auto max-h-[440px] overflow-y-auto">
              <pre className="text-slate-300 leading-relaxed">
                {activeFile.content.split('\n').map((line, idx) => (
                  <div key={idx} className="flex">
                    <span className="w-10 text-slate-600 select-none text-right pr-3 shrink-0">
                      {idx + 1}
                    </span>
                    <span className="whitespace-pre">{line}</span>
                  </div>
                ))}
              </pre>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400 mt-4">
            <span>Size: {activeFile.content.length} characters</span>
            <span className="text-cyan-400">SIH 2026 PS 26065 Clean Source</span>
          </div>

        </div>

      </div>

    </div>
  );
};
