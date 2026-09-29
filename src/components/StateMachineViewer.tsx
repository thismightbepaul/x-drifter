import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, Snowflake, Wind, Sun, Compass, Radio, CheckCircle, ArrowRight } from 'lucide-react';
import { AutonomousState } from '../types/drifter';

export const StateMachineViewer: React.FC = () => {
  const [currentState, setCurrentState] = useState<AutonomousState>('NORMAL');
  const [candidateState, setCandidateState] = useState<AutonomousState>('NORMAL');
  const [hysteresisCount, setHysteresisCount] = useState<number>(0);
  
  // Stimulus inputs
  const [sst, setSst] = useState<number>(0.8); // °C
  const [waveHeight, setWaveHeight] = useState<number>(1.5); // m
  const [waterlineWet, setWaterlineWet] = useState<boolean>(true);
  const [antennaWet, setAntennaWet] = useState<boolean>(false);
  const [drogueTensionNormal, setDrogueTensionNormal] = useState<boolean>(true);
  const [winchStall, setWinchStall] = useState<boolean>(false);
  const [activeAlert, setActiveAlert] = useState<string | null>(null);

  // States description metadata
  const stateDetails: Record<AutonomousState, {
    title: string;
    icon: any;
    color: string;
    action: string;
    enterRule: string;
    exitRule: string;
    energyImpact: string;
  }> = {
    NORMAL: {
      title: 'NORMAL (Default Open Ocean)',
      icon: Compass,
      color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/20',
      action: '2 baseline profiles / day, status telemetry every 6 h, adaptive extra profiles allowed by energy gate.',
      enterRule: 'Default state when wave energy, SST, and drift indicate open, non-hazardous subantarctic waters.',
      exitRule: 'Transitions if 3 consecutive checks confirm storm, calm, or ice signatures.',
      energyImpact: 'Baseline: 0.687 Wh/day (Profile = 0.590 Wh, Comms = 0.067 Wh, Sleep = 0.013 Wh).'
    },
    STORM: {
      title: 'STORM (Heavy Heave Protection)',
      icon: Wind,
      color: 'text-amber-400 border-amber-500/40 bg-amber-950/20',
      action: 'Probe docked and locked. Profiling deferred to protect tether from snatch loads. Wave spectrum logged. Status reporting rate accelerated but capped at 2–4 h.',
      enterRule: 'IMU wave energy > threshold for ≥ 30 s sustained, confirmed across 3 checks. Rapidly falling barometric pressure primes state.',
      exitRule: 'Wave energy drops below limit for 3 consecutive checks.',
      energyImpact: 'Saves 0.590 Wh per storm day by deferring winch operation in heavy seas.'
    },
    CALM: {
      title: 'CALM (Energy Conservation Mode)',
      icon: Sun,
      color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20',
      action: 'Skips second daily profile (water column is quiescent and already characterised). Status interval stretched to 8–12 h.',
      enterRule: 'No T/S step over last N profiles and IMU quiet for N cycles (wave height < 0.4 m).',
      exitRule: 'Any sudden temperature/salinity step or wave motion returns system to NORMAL.',
      energyImpact: 'Saves ≈ 0.3 Wh per calm day (≈ 20 Wh banked over ~68 calm days to fund extra profiles).'
    },
    ICE_APPROACH: {
      title: 'ICE_APPROACH (Pre-Ice Warning)',
      icon: Snowflake,
      color: 'text-blue-400 border-blue-500/40 bg-blue-950/20',
      action: 'Probe docked early. Reduced to 1 profile / day at solar noon. Extra vigilance on tether load cell.',
      enterRule: '2 of 3 signs for 3+ cycles: SST ≤ 0 °C and falling; drift slowing or changing; IMU shows damped waves and bumps.',
      exitRule: 'Environmental signs clear for 3 consecutive checks.',
      energyImpact: 'Conserves energy and protects probe before sea ice freezing event.'
    },
    ICE: {
      title: 'ICE (Sea Ice Locked)',
      icon: Snowflake,
      color: 'text-indigo-400 border-indigo-500/40 bg-indigo-950/20',
      action: 'ZERO profiling. Probe docked and locked. Status reported once daily. Doppler position backup active.',
      enterRule: 'SST ≤ -1.5 °C, or drift under ~100 m in 6 h, or wave energy near zero (damped by sea ice cover).',
      exitRule: 'SST > -1.0 °C and moving for 3–4 heartbeats, then a single cautious test profile.',
      energyImpact: 'Saves 0.59 Wh per ice day. Prevents destroying probe on sea ice pack.'
    },
    ON_FLOE: {
      title: 'ON_FLOE (Stranded on Sea Ice Floe)',
      icon: ShieldCheck,
      color: 'text-purple-400 border-purple-500/40 bg-purple-950/20',
      action: 'Position + status only. Winch locked. Argos transmission locked if internal temp < -20 °C.',
      enterRule: 'Both capacitive wet pads dry! (Waterline pad = dry, Antenna pad = dry).',
      exitRule: 'Wet again (waterline re-submerges after ice melt or calving).',
      energyImpact: 'Extreme low power mode: Acts as polar ice beacon.'
    }
  };

  // Evaluate stimulus and compute proposed state
  const evaluateStimulus = (
    newSst: number,
    newWave: number,
    wet1: boolean,
    wet2: boolean
  ): AutonomousState => {
    if (!wet1 && !wet2) {
      return 'ON_FLOE';
    }
    if (newSst <= -1.5 || (newWave < 0.1 && newSst <= 0.0)) {
      return 'ICE';
    }
    if (newSst <= 0.0) {
      return 'ICE_APPROACH';
    }
    if (newWave > 3.5) {
      return 'STORM';
    }
    if (newWave < 0.4) {
      return 'CALM';
    }
    return 'NORMAL';
  };

  // Step the hysteresis engine
  const stepHysteresis = (proposed: AutonomousState) => {
    if (proposed === currentState) {
      setCandidateState(currentState);
      setHysteresisCount(0);
      return;
    }

    if (proposed === candidateState) {
      const nextCount = hysteresisCount + 1;
      if (nextCount >= 3) {
        // Transition fires!
        setCurrentState(proposed);
        setCandidateState(proposed);
        setHysteresisCount(0);
      } else {
        setHysteresisCount(nextCount);
      }
    } else {
      setCandidateState(proposed);
      setHysteresisCount(1);
    }
  };

  // Apply scenario preset
  const applyPreset = (presetName: string) => {
    let s = sst;
    let w = waveHeight;
    let w1 = waterlineWet;
    let w2 = antennaWet;

    if (presetName === 'STORM') {
      s = 0.5; w = 4.2; w1 = true; w2 = false;
    } else if (presetName === 'CALM') {
      s = 1.2; w = 0.3; w1 = true; w2 = false;
    } else if (presetName === 'ICE_APPROACH') {
      s = -0.2; w = 0.6; w1 = true; w2 = false;
    } else if (presetName === 'ICE') {
      s = -1.7; w = 0.05; w1 = true; w2 = false;
    } else if (presetName === 'ON_FLOE') {
      s = -12.0; w = 0.0; w1 = false; w2 = false;
    } else {
      s = 1.0; w = 1.5; w1 = true; w2 = false;
    }

    setSst(s);
    setWaveHeight(w);
    setWaterlineWet(w1);
    setAntennaWet(w2);

    const proposed = evaluateStimulus(s, w, w1, w2);
    stepHysteresis(proposed);
  };

  // Single manual stimulus update
  const handleUpdateStimulus = (newSst: number, newWave: number, w1: boolean, w2: boolean) => {
    setSst(newSst);
    setWaveHeight(newWave);
    setWaterlineWet(w1);
    setAntennaWet(w2);
    const proposed = evaluateStimulus(newSst, newWave, w1, w2);
    stepHysteresis(proposed);
  };

  return (
    <div className="space-y-6">
      
      {/* Header and State Architecture Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Autonomous 6-State Machine</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                3-Check Hysteresis Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Guarantees zero false state flipping in erratic subantarctic seas. Immediate action on hardware critical events.
            </p>
          </div>

          {/* Quick Scenario Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['NORMAL', 'STORM', 'CALM', 'ICE_APPROACH', 'ICE', 'ON_FLOE'] as AutonomousState[]).map(st => (
              <button
                key={st}
                onClick={() => applyPreset(st)}
                className="px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer border border-slate-700"
              >
                Inject {st}
              </button>
            ))}
          </div>
        </div>

        {/* 6-State Flow Diagram */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-5">
          {(['NORMAL', 'STORM', 'CALM', 'ICE_APPROACH', 'ICE', 'ON_FLOE'] as AutonomousState[]).map(st => {
            const meta = stateDetails[st];
            const Icon = meta.icon;
            const isCurrent = currentState === st;
            const isCandidate = candidateState === st && candidateState !== currentState;

            return (
              <div
                key={st}
                className={`p-3 rounded-lg border transition-all text-xs font-mono ${
                  isCurrent
                    ? `${meta.color} ring-1 ring-cyan-400/50 shadow-md`
                    : isCandidate
                    ? 'border-dashed border-amber-500/70 bg-amber-950/10 text-amber-300'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Icon className="w-4 h-4" />
                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                  {isCandidate && (
                    <span className="text-[10px] text-amber-400 font-bold">
                      {hysteresisCount}/3
                    </span>
                  )}
                </div>
                <div className="font-bold text-white text-[11px] truncate">{st}</div>
                <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                  {st === 'CALM' ? 'Skip 2nd profile' : st === 'STORM' ? 'Defer profile' : st === 'ICE' ? 'Lock probe' : st === 'ON_FLOE' ? 'Beacon only' : '2 profiles/day'}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Interactive Stimulus Workbench & Hysteresis Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Sensor Stimulus Injector */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Sensor Stimulus Injector
            </h3>
            <span className="text-xs font-mono text-cyan-400">Step Stimulus</span>
          </div>

          {/* SST Slider */}
          <div>
            <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
              <span>Sea Surface Temp (SST)</span>
              <span className={`font-bold ${sst <= 0 ? 'text-blue-400' : 'text-cyan-400'}`}>
                {sst.toFixed(2)} °C
              </span>
            </div>
            <input
              type="range"
              min="-2.0"
              max="3.0"
              step="0.1"
              value={sst}
              onChange={e => handleUpdateStimulus(parseFloat(e.target.value), waveHeight, waterlineWet, antennaWet)}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>-2.0°C (Ice Freeze)</span>
              <span>0.0°C (Approach)</span>
              <span>+3.0°C (Warm)</span>
            </div>
          </div>

          {/* Wave Height Slider */}
          <div>
            <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
              <span>Wave Heave Height (IMU)</span>
              <span className={`font-bold ${waveHeight > 3.5 ? 'text-amber-400' : waveHeight < 0.4 ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {waveHeight.toFixed(2)} m
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="5.0"
              step="0.1"
              value={waveHeight}
              onChange={e => handleUpdateStimulus(sst, parseFloat(e.target.value), waterlineWet, antennaWet)}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>0.1m (Calm)</span>
              <span>1.5m (Normal)</span>
              <span>3.5m+ (Storm)</span>
            </div>
          </div>

          {/* Wet Pads Dual Toggle */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-xs font-mono text-slate-400 block">Capacitive Wet Pads (Through 6 mm HDPE wall)</span>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleUpdateStimulus(sst, waveHeight, !waterlineWet, antennaWet)}
                className={`py-2 px-3 rounded-lg border text-xs font-mono flex items-center justify-between cursor-pointer ${
                  waterlineWet ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                <span>Waterline Pad</span>
                <span className="font-bold">{waterlineWet ? 'WET' : 'DRY'}</span>
              </button>

              <button
                onClick={() => handleUpdateStimulus(sst, waveHeight, waterlineWet, !antennaWet)}
                className={`py-2 px-3 rounded-lg border text-xs font-mono flex items-center justify-between cursor-pointer ${
                  antennaWet ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                <span>Antenna Pad</span>
                <span className="font-bold">{antennaWet ? 'WET (Submerged)' : 'DRY'}</span>
              </button>
            </div>
            {!waterlineWet && !antennaWet && (
              <div className="text-[11px] font-mono text-purple-400 bg-purple-950/30 border border-purple-500/30 p-2 rounded">
                Both pads dry: Unit detected as stranded ON SEA ICE FLOE.
              </div>
            )}
          </div>

          {/* Immediate Hardware Alerts Injector */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-xs font-mono text-slate-400 block">Hardware Fault Triggers (Act at Once)</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                onClick={() => {
                  setDrogueTensionNormal(false);
                  setActiveAlert('DROGUE_LOST (Tension dropped & drift following wind)');
                }}
                className="py-1.5 px-2 rounded bg-rose-950/30 border border-rose-500/30 text-rose-300 hover:bg-rose-900/40 text-left cursor-pointer"
              >
                Sever Drogue Tether
              </button>

              <button
                onClick={() => {
                  setWinchStall(true);
                  setActiveAlert('WINCH_JAM (Motor current > 450mA for > 200ms)');
                }}
                className="py-1.5 px-2 rounded bg-amber-950/30 border border-amber-500/30 text-amber-300 hover:bg-amber-900/40 text-left cursor-pointer"
              >
                Simulate Winch Jam
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Active State Machine Telemetry & Logic Rules */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Active State Card */}
          {(() => {
            const meta = stateDetails[currentState];
            const Icon = meta.icon;
            return (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-slate-800">
                      <Icon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-xs font-mono text-slate-400">Current Autonomous State</div>
                      <h3 className="text-lg font-bold text-white">{meta.title}</h3>
                    </div>
                  </div>

                  {/* Hysteresis Step Visualizer */}
                  <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono">
                    <div className="text-slate-400 text-[10px]">Hysteresis Buffer</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`w-3 h-3 rounded-sm ${hysteresisCount >= 1 ? 'bg-amber-400' : 'bg-slate-800'}`} />
                      <div className={`w-3 h-3 rounded-sm ${hysteresisCount >= 2 ? 'bg-amber-400' : 'bg-slate-800'}`} />
                      <div className={`w-3 h-3 rounded-sm ${hysteresisCount >= 3 ? 'bg-emerald-400' : 'bg-slate-800'}`} />
                      <span className="text-slate-300 ml-1">
                        {candidateState !== currentState ? `Target: ${candidateState} (${hysteresisCount}/3)` : 'Locked (0/3)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
                    <div className="text-slate-400 font-mono text-[10px] uppercase mb-1">State Action Behavior</div>
                    <p className="text-slate-200 leading-relaxed">{meta.action}</p>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
                    <div className="text-slate-400 font-mono text-[10px] uppercase mb-1">Energy Saving Impact</div>
                    <p className="text-cyan-300 leading-relaxed">{meta.energyImpact}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-xs font-mono text-slate-400 space-y-1">
                  <div><span className="text-slate-500">Entry Condition:</span> {meta.enterRule}</div>
                  <div><span className="text-slate-500">Exit Condition:</span> {meta.exitRule}</div>
                </div>

              </div>
            );
          })()}

          {/* Active Hardware Alert Box */}
          {activeAlert && (
            <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-mono text-rose-400 uppercase font-bold">
                    CRITICAL HARDWARE ALERT DISPATCHED
                  </div>
                  <div className="text-sm text-slate-200 mt-0.5">{activeAlert}</div>
                  <div className="text-xs text-slate-400 font-mono mt-1">
                    Queued into Argos transmit buffer with priority 0x04. Tagged onto all subsequent packets.
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveAlert(null);
                  setDrogueTensionNormal(true);
                  setWinchStall(false);
                }}
                className="text-xs font-mono text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded cursor-pointer"
              >
                Acknowledge
              </button>
            </div>
          )}

          {/* State Transition Table from §9 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 mb-3">
              Autonomous State Transition Specification
            </h4>
            <div className="overflow-x-auto text-xs font-mono">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2">State</th>
                    <th className="pb-2">Enter When</th>
                    <th className="pb-2">Leave When</th>
                    <th className="pb-2">What X Does</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-2 font-bold text-cyan-400">NORMAL</td>
                    <td className="py-2">Default</td>
                    <td className="py-2">—</td>
                    <td className="py-2">2 profiles/day, status every 6h, extras by gate</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-amber-400">STORM</td>
                    <td className="py-2">IMU wave &gt; 3.5m for ≥30s, 3 checks</td>
                    <td className="py-2">Below limit 3 checks</td>
                    <td className="py-2">Probe locked, profiles deferred, wave spectrum logged</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-emerald-400">CALM</td>
                    <td className="py-2">No T/S step over N profiles &amp; quiet IMU</td>
                    <td className="py-2">Any step or motion</td>
                    <td className="py-2">2nd daily profile skipped, status every 8–12h</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-blue-400">ICE_APPROACH</td>
                    <td className="py-2">2 of 3: SST ≤ 0°C &amp; falling, damped bumps</td>
                    <td className="py-2">Signs clear</td>
                    <td className="py-2">Probe docked early, 1 profile/day</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-indigo-400">ICE</td>
                    <td className="py-2">SST ≤ -1.5°C, or drift &lt;100m/6h, or wave ~0</td>
                    <td className="py-2">SST &gt; -1.0°C &amp; moving 3-4 heartbeats</td>
                    <td className="py-2">No profiling, probe docked, status daily</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-purple-400">ON_FLOE</td>
                    <td className="py-2">Both wet pads dry</td>
                    <td className="py-2">Wet again</td>
                    <td className="py-2">Position + status only. Transmit locked &lt; -20°C</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
