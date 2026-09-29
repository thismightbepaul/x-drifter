import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, CheckCircle2, ArrowDown, ArrowUp, Activity } from 'lucide-react';
import { ProfileBin } from '../types/drifter';

type OceanPreset = 'meltwater_lens' | 'subantarctic_summer' | 'well_mixed_winter';

export const ProfilerSimulator: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [phase, setPhase] = useState<'DOCKED' | 'SOAK' | 'DESCENT' | 'BOTTOM_PAUSE' | 'ASCENT' | 'COMPLETED'>('DOCKED');
  const [depth, setDepth] = useState<number>(0.3);
  const [cablePaidOut, setCablePaidOut] = useState<number>(0.3);
  const [waveHeaveSetting, setWaveHeaveSetting] = useState<number>(1.2); // meters
  const [preset, setPreset] = useState<OceanPreset>('meltwater_lens');
  const [timeElapsedSec, setTimeElapsedSec] = useState<number>(0);
  const [samplesDroppedLoop, setSamplesDroppedLoop] = useState<number>(0);
  const [maxDepthSeen, setMaxDepthSeen] = useState<number>(0.3);
  
  // Real-time sensor values
  const [currentTemp, setCurrentTemp] = useState<number>(-0.5);
  const [currentSal, setCurrentSal] = useState<number>(33.5);
  const [motorCurrentMa, setMotorCurrentMa] = useState<number>(0);
  
  // Profile Bins collected
  const [binnedResults, setBinnedResults] = useState<ProfileBin[]>([]);

  // Simulation timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate synthetic ocean truth for depth
  const getOceanTruth = (d: number, mode: OceanPreset) => {
    if (mode === 'meltwater_lens') {
      // 0-2m: fresh meltwater lens (salinity 33.1 psu, temp -0.4°C), then jumps to 34.2 psu, -1.8°C at 10m
      const s = d < 2.0 ? 33.1 + d * 0.15 : 33.8 + (d - 2) * 0.05;
      const t = d < 2.0 ? -0.4 - d * 0.2 : -0.8 - (d - 2) * 0.12;
      return { temp: t, sal: s };
    } else if (mode === 'subantarctic_summer') {
      const s = 33.6 + d * 0.08;
      const t = 1.2 - d * 0.32;
      return { temp: t, sal: s };
    } else {
      // well mixed winter
      const s = 34.05 + d * 0.01;
      const t = -1.75 + d * 0.02;
      return { temp: t, sal: s };
    }
  };

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRunning(false);
    setPhase('DOCKED');
    setDepth(0.3);
    setCablePaidOut(0.3);
    setTimeElapsedSec(0);
    setSamplesDroppedLoop(0);
    setMaxDepthSeen(0.3);
    setMotorCurrentMa(0);
    const truth = getOceanTruth(0.3, preset);
    setCurrentTemp(truth.temp);
    setCurrentSal(truth.sal);
    setBinnedResults([]);
  };

  const toggleRun = () => {
    if (phase === 'COMPLETED') {
      handleReset();
      setTimeout(() => setIsRunning(true), 50);
      return;
    }
    setIsRunning(!isRunning);
  };

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeElapsedSec(prev => prev + 0.2);

      // Phase 1: Soak in dock (2 seconds sim)
      if (phase === 'DOCKED') {
        setPhase('SOAK');
        setMotorCurrentMa(15);
      } else if (phase === 'SOAK') {
        if (timeElapsedSec > 2.0) {
          setPhase('DESCENT');
          setMotorCurrentMa(120); // Motor paying out
        }
      } else if (phase === 'DESCENT') {
        // Free fall descent @ ~0.2 m/s
        setDepth(prevD => {
          // Add sinusoidal wave heave perturbation to simulate float bobbing on surface waves
          const heaveWave = Math.sin(timeElapsedSec * 3.5) * (waveHeaveSetting * 0.18);
          const nominalSink = prevD + 0.04; // 0.04m per 200ms = 0.20 m/s
          const actualInstantDepth = Math.max(0.3, nominalSink + heaveWave);

          // Update cable paid out slightly ahead to maintain slack (0.15m to 0.4m slack)
          setCablePaidOut(nominalSink + 0.25);

          // Loop-edit filter: If actual depth is less than max seen depth, probe was jerked up by heave
          if (actualInstantDepth < maxDepthSeen) {
            setSamplesDroppedLoop(count => count + 1);
          } else {
            setMaxDepthSeen(actualInstantDepth);
          }

          // Sample ocean properties
          const truth = getOceanTruth(actualInstantDepth, preset);
          setCurrentTemp(truth.temp);
          setCurrentSal(truth.sal);

          // Reached hard limit at 10.0 m
          if (nominalSink >= 10.0) {
            setPhase('BOTTOM_PAUSE');
            setMotorCurrentMa(0);
            return 10.0;
          }
          return actualInstantDepth;
        });
      } else if (phase === 'BOTTOM_PAUSE') {
        setMotorCurrentMa(0);
        if (timeElapsedSec > 58.0) { // pause 3 seconds
          setPhase('ASCENT');
          setMotorCurrentMa(280); // Motor pulling cable taut (higher load)
        }
      } else if (phase === 'ASCENT') {
        // Ascent recovery @ ~0.1 m/s (cable is taut, wave heave gets directly coupled)
        setDepth(prevD => {
          const heaveCoupled = Math.sin(timeElapsedSec * 3.5) * (waveHeaveSetting * 0.25);
          const newD = Math.max(0.3, prevD - 0.02 + heaveCoupled);
          setCablePaidOut(prevD);

          const truth = getOceanTruth(newD, preset);
          setCurrentTemp(truth.temp);
          setCurrentSal(truth.sal);

          if (prevD <= 0.35) {
            setPhase('COMPLETED');
            setIsRunning(false);
            setMotorCurrentMa(0);
            generateFinalBins();
            return 0.3;
          }
          return newD;
        });
      }
    }, 200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, phase, timeElapsedSec, maxDepthSeen, waveHeaveSetting, preset]);

  // Generate 1m binned profile after completion
  const generateFinalBins = () => {
    const bins: ProfileBin[] = [];
    for (let d = 1; d <= 10; d++) {
      const truth = getOceanTruth(d, preset);
      // Small calibration delta for upcast
      const upDeltaT = (Math.random() - 0.5) * 0.03;
      const upDeltaS = (Math.random() - 0.5) * 0.05;
      bins.push({
        depth: d,
        tempDown: Number(truth.temp.toFixed(2)),
        salinityDown: Number(truth.sal.toFixed(2)),
        tempUp: Number((truth.temp + upDeltaT).toFixed(2)),
        salinityUp: Number((truth.sal + upDeltaS).toFixed(2)),
        qcFlag: d === 1 ? 2 : 1 // 1m has surface proximity flag
      });
    }
    setBinnedResults(bins);
  };

  const slack = Math.max(0, cablePaidOut - depth);
  const isStormHeave = waveHeaveSetting > 3.5;

  return (
    <div className="space-y-6">
      
      {/* Simulation Controls & Parameters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">0.3 – 10.0 m Profiler Simulator</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                DESCENT = SCIENCE PASS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Decoupled free-fall descent with controlled cable slack. Ascent is recovery plus QC.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleRun}
              disabled={isStormHeave}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                isStormHeave
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : isRunning
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{phase === 'COMPLETED' ? 'Run Again' : isRunning ? 'Pause Cast' : 'Deploy Probe'}</span>
            </button>

            <button
              onClick={handleReset}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Environmental Parameter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-800">
          <div>
            <label className="text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>Wave Heave Height (IMU)</span>
              <span className="text-cyan-400 font-bold">{waveHeaveSetting.toFixed(1)} m</span>
            </label>
            <input
              type="range"
              min="0.2"
              max="4.5"
              step="0.1"
              value={waveHeaveSetting}
              onChange={e => setWaveHeaveSetting(parseFloat(e.target.value))}
              disabled={isRunning}
              className="w-full mt-2 accent-cyan-400 cursor-pointer"
            />
            {isStormHeave && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 mt-1 font-mono">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>STORM Rule: Wave heave &gt; 3.5 m defers profiling!</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400">Ocean Stratification Scenario</label>
            <select
              value={preset}
              onChange={e => setPreset(e.target.value as OceanPreset)}
              disabled={isRunning}
              className="w-full mt-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-400 outline-none"
            >
              <option value="meltwater_lens">Polar Meltwater Lens (Low S in top 2 m)</option>
              <option value="subantarctic_summer">Subantarctic Summer Stratified</option>
              <option value="well_mixed_winter">Deep Well-Mixed Winter</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400">Current Phase & Status</label>
            <div className="mt-2 flex items-center gap-2 text-xs font-mono">
              <span className={`w-2.5 h-2.5 rounded-full ${
                phase === 'DOCKED' ? 'bg-slate-400' :
                phase === 'DESCENT' ? 'bg-cyan-400 animate-pulse' :
                phase === 'ASCENT' ? 'bg-amber-400 animate-pulse' :
                phase === 'COMPLETED' ? 'bg-emerald-400' : 'bg-blue-400'
              }`} />
              <span className="font-semibold text-white">{phase}</span>
              <span className="text-slate-400">· T+{timeElapsedSec.toFixed(1)}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Viewport: Vertical Water Column & Real-Time Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Visual Water Column Tube (Depth Scale 0m to 12m) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Depth Axis & Slack Dynamics
            </h3>
            <span className="text-xs font-mono text-cyan-400">Winch: {phase}</span>
          </div>

          <div className="relative h-96 bg-gradient-to-b from-cyan-950/40 via-slate-950 to-blue-950/60 border border-slate-800 rounded-lg overflow-hidden flex">
            
            {/* Depth Tick Marks */}
            <div className="w-12 border-r border-slate-800/80 p-2 flex flex-col justify-between text-xs font-mono text-slate-500 select-none">
              <span>0.0 m</span>
              <span>2.0 m</span>
              <span>4.0 m</span>
              <span>6.0 m</span>
              <span>8.0 m</span>
              <span className="text-amber-400 font-bold">10.0 m</span>
              <span className="text-slate-600">12.0 m (Drogue)</span>
            </div>

            {/* Probe Representation */}
            <div className="flex-1 relative">
              {/* Sea Surface */}
              <div className="absolute top-0 left-0 right-0 h-4 border-b border-cyan-500/40 bg-cyan-500/10 flex items-center px-2 text-xs font-mono text-cyan-300">
                <span>Float Waterline (0.0 m)</span>
              </div>

              {/* Drogue Top Clearance Boundary */}
              <div className="absolute bottom-8 left-0 right-0 border-t border-dashed border-amber-500/50 flex items-center px-2 text-xs font-mono text-amber-400/80">
                <span>10.0 m Hard Stop (2 m Drogue Clearance)</span>
              </div>

              {/* Dynamic Probe Graphic */}
              <div
                className="absolute left-1/2 -translate-x-1/2 transition-all duration-150"
                style={{
                  top: `${(depth / 12) * 100}%`
                }}
              >
                {/* Winch Cable */}
                <div
                  className="w-0.5 bg-cyan-400/80 mx-auto -translate-y-full"
                  style={{
                    height: `${(depth / 12) * 384}px`
                  }}
                />

                {/* Probe Body (Tapered Nose Leading Down) */}
                <div className="relative -mt-1 flex flex-col items-center">
                  <div className="w-5 h-8 bg-slate-200 rounded-t-sm border border-slate-400 flex flex-col items-center justify-center shadow-lg">
                    <span className="text-[7px] font-mono text-slate-900 font-bold">X</span>
                  </div>
                  {/* Streamlined Tapered Nose */}
                  <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-amber-400" />
                  
                  {/* Live Depth Tag */}
                  <div className="absolute left-7 top-1 whitespace-nowrap bg-slate-950/90 border border-slate-700 px-2 py-0.5 rounded text-xs font-mono text-cyan-300">
                    {depth.toFixed(2)} m
                  </div>
                </div>
              </div>

            </div>

          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <div>
              <div className="text-slate-400">Cable Out</div>
              <div className="text-white font-bold">{cablePaidOut.toFixed(2)} m</div>
            </div>
            <div>
              <div className="text-slate-400">Probe Depth</div>
              <div className="text-cyan-400 font-bold">{depth.toFixed(2)} m</div>
            </div>
            <div>
              <div className="text-slate-400">Slack Buffer</div>
              <div className="text-emerald-400 font-bold">{slack.toFixed(2)} m</div>
            </div>
          </div>
        </div>

        {/* Live Readout & Loop-Edit Diagnostics */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="text-xs font-mono text-slate-400">TSYS01 Temp</div>
              <div className="text-lg font-bold text-white font-mono mt-1">
                {currentTemp.toFixed(2)} <span className="text-xs font-normal text-slate-400">°C</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="text-xs font-mono text-slate-400">EZO-EC Salinity</div>
              <div className="text-lg font-bold text-cyan-400 font-mono mt-1">
                {currentSal.toFixed(2)} <span className="text-xs font-normal text-slate-400">psu</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="text-xs font-mono text-slate-400">Motor Current</div>
              <div className="text-lg font-bold text-amber-400 font-mono mt-1">
                {motorCurrentMa} <span className="text-xs font-normal text-slate-400">mA</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="text-xs font-mono text-slate-400">Loop-Edit Drops</div>
              <div className="text-lg font-bold text-rose-400 font-mono mt-1">
                {samplesDroppedLoop} <span className="text-xs font-normal text-slate-400">samples</span>
              </div>
            </div>
          </div>

          {/* Loop-Edit Explanation Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs">
            <div className="flex items-center justify-between font-mono text-slate-300 mb-2">
              <span className="font-semibold text-cyan-400">Loop-Edit Algorithm &amp; Wave Decoupling</span>
              <span className="text-emerald-400">Active Filter</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              When float bobs upward on a 1.2 m wave crest, taut cable would pull the probe backwards into its own wake.
              By free-falling with controlled slack, the probe descends undisturbed. The firmware loop-edit routine suppresses
              any instantaneous readings where <code className="text-cyan-300">depth &lt; max_depth_seen</code>.
            </p>
          </div>

          {/* 1m Binned Profile Data Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
                10-Level Science Profile (Descent vs Ascent QC)
              </h4>
              <span className="text-xs font-mono text-cyan-400">10 Bins · Scaled Integers</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2">Depth</th>
                    <th className="pb-2 text-cyan-400">Descent Temp</th>
                    <th className="pb-2 text-cyan-400">Descent Sal</th>
                    <th className="pb-2 text-slate-400">Ascent Temp (QC)</th>
                    <th className="pb-2 text-slate-400">Ascent Sal (QC)</th>
                    <th className="pb-2">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {binnedResults.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500 font-mono">
                        Run a profile cast to populate the 1.0 m science and QC bins.
                      </td>
                    </tr>
                  ) : (
                    binnedResults.map(b => (
                      <tr key={b.depth} className="hover:bg-slate-800/40">
                        <td className="py-1.5 font-bold text-white">{b.depth}.0 m</td>
                        <td className="py-1.5 text-cyan-300">{b.tempDown.toFixed(2)} °C</td>
                        <td className="py-1.5 text-cyan-300">{b.salinityDown.toFixed(2)} psu</td>
                        <td className="py-1.5 text-slate-400">{b.tempUp?.toFixed(2)} °C</td>
                        <td className="py-1.5 text-slate-400">{b.salinityUp?.toFixed(2)} psu</td>
                        <td className="py-1.5">
                          {b.qcFlag === 2 ? (
                            <span className="text-amber-400">QC 2 (Surface)</span>
                          ) : (
                            <span className="text-emerald-400">QC 1 (Good)</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
