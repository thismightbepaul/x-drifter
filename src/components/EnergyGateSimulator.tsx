import React, { useState, useMemo } from 'react';
import { BatteryCharging, Shield, AlertTriangle, ArrowRight, Zap, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { DegradationTier, EnergyLedgerDay } from '../types/drifter';

export const EnergyGateSimulator: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState<number>(90);
  const [scenario, setScenario] = useState<'standard' | 'stormy' | 'calm_summer' | 'ice_trapped'>('standard');
  const [testCostWh, setTestCostWh] = useState<number>(0.295); // 0.295 Wh for extra profile

  // Generate 180 days of energy ledger data based on scenario
  const simulationDays = useMemo(() => {
    const days: EnergyLedgerDay[] = [];
    let usedWh = 0;
    let extraCount = 0;
    let calmCount = 0;
    let stormCount = 0;
    let iceCount = 0;

    const USABLE_BATTERY_WH = 180.0;
    const RESERVE_WH = 15.0;
    const TOTAL_DAYS = 180;
    const BASELINE_DAILY = 0.687; // Wh/day

    for (let d = 1; d <= TOTAL_DAYS; d++) {
      const allowedWh = ((USABLE_BATTERY_WH - RESERVE_WH) * d) / TOTAL_DAYS;
      const baselineCumulativeWh = BASELINE_DAILY * d;

      let dailyWh = BASELINE_DAILY;

      // Scenario variations
      if (scenario === 'calm_summer' && (d >= 20 && d <= 100)) {
        // Calm season: Skip 2nd daily profile saving 0.295 Wh
        dailyWh -= 0.295;
        calmCount++;
      } else if (scenario === 'stormy' && ((d >= 40 && d <= 50) || (d >= 90 && d <= 105))) {
        // Storm period: Defer profiles
        dailyWh -= 0.590;
        stormCount++;
      } else if (scenario === 'ice_trapped' && d >= 80) {
        // Locked in pack ice: 0 profiles, beacon only
        dailyWh = 0.04;
        iceCount++;
      }

      // Check if adaptive extra profile can run today (e.g. salinity gradient trigger)
      const wantsExtraProfile = (d % 3 === 0);
      if (wantsExtraProfile && (usedWh + dailyWh + 0.295 <= allowedWh)) {
        dailyWh += 0.295;
        extraCount++;
      }

      usedWh += dailyWh;

      // Determine Tier
      let tier: DegradationTier = 'Full';
      if (usedWh > allowedWh + 10.0) {
        tier = 'Survival';
      } else if (usedWh > allowedWh) {
        tier = 'Lean';
      }
      if (USABLE_BATTERY_WH - usedWh < 5.0) {
        tier = 'Beacon';
      }

      days.push({
        day: d,
        baselineWh: Number(baselineCumulativeWh.toFixed(2)),
        allowedWh: Number(allowedWh.toFixed(2)),
        actualUsedWh: Number(usedWh.toFixed(2)),
        reserveWh: RESERVE_WH,
        tier,
        extraProfilesRun: extraCount,
        calmDaysSkipped: calmCount,
        stormDaysDeferred: stormCount,
        iceDaysDeferred: iceCount
      });
    }

    return days;
  }, [scenario]);

  const activeDayData = simulationDays[selectedDay - 1] || simulationDays[89];

  // Test action gate decision on selected day
  const testTotalCandidate = activeDayData.actualUsedWh + testCostWh;
  const isActionAllowed = testTotalCandidate <= activeDayData.allowedWh;
  const marginAtDay = activeDayData.allowedWh - activeDayData.actualUsedWh;

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Battery Capacity & Mathematical Gate Rule */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Energy Ledger &amp; Allowed-Curve Gate</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                v3 Fixed Allowed Curve
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Spreads 180 Wh usable capacity (minus 15 Wh reserve) at exactly 0.917 Wh/day to fund ~140 adaptive extra profiles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Simulation Scenario:</span>
            <select
              value={scenario}
              onChange={e => setScenario(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-400 outline-none"
            >
              <option value="standard">Standard Southern Ocean Mission</option>
              <option value="stormy">Heavy Storm Season (Winter Heave)</option>
              <option value="calm_summer">Extended Summer Calm (Max Savings)</option>
              <option value="ice_trapped">Pack Ice Trapped at Day 80</option>
            </select>
          </div>
        </div>

        {/* 4 Core Gate Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
            <div className="text-[10px] font-mono uppercase text-slate-400">Usable Battery (Derated)</div>
            <div className="text-xl font-bold font-mono text-white mt-0.5">180.0 <span className="text-xs text-slate-400 font-normal">Wh</span></div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">281 Wh nominal × 65% (cold)</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
            <div className="text-[10px] font-mono uppercase text-slate-400">Protected Reserve</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">15.0 <span className="text-xs text-slate-400 font-normal">Wh</span></div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">~3 weeks baseline survival</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
            <div className="text-[10px] font-mono uppercase text-slate-400">Allowed Rate (Slope)</div>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">0.917 <span className="text-xs text-slate-400 font-normal">Wh/day</span></div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">(180 Wh - 15 Wh) / 180 d</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
            <div className="text-[10px] font-mono uppercase text-slate-400">Total Extras Run</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
              {simulationDays[179].extraProfilesRun} <span className="text-xs text-slate-400 font-normal">profiles</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">Funded by 55 Wh margin</div>
          </div>
        </div>
      </div>

      {/* Interactive 180-Day Curve Visualizer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">180-Day Cumulative Energy Trajectory</h3>
            <p className="text-xs text-slate-400">Comparing Allowed Curve vs Actual Shunt Ledger vs Baseline</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
              <span className="text-cyan-400">Allowed Curve (0.917 Wh/d)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-400 inline-block" />
              <span className="text-amber-400">Actual Ledger Used</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-slate-500 inline-block" />
              <span className="text-slate-400">Baseline (0.687 Wh/d)</span>
            </div>
          </div>
        </div>

        {/* SVG Energy Curve Graph */}
        <div className="relative h-64 mt-4 w-full">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 900 240" preserveAspectRatio="none">
            {/* Grid lines */}
            {[0, 45, 90, 135, 180].map(val => {
              const y = 220 - (val / 180) * 200;
              return (
                <g key={val}>
                  <line x1="40" y1={y} x2="880" y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                  <text x="32" y={y + 4} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                    {val} Wh
                  </text>
                </g>
              );
            })}

            {/* X-axis days */}
            {[1, 45, 90, 135, 180].map(d => {
              const x = 40 + ((d - 1) / 179) * 840;
              return (
                <g key={d}>
                  <line x1={x} y1="20" x2={x} y2="220" stroke="#1e293b" strokeDasharray="3 3" />
                  <text x={x} y="235" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="monospace">
                    Day {d}
                  </text>
                </g>
              );
            })}

            {/* Baseline Path (0.687 Wh/d -> 123.66 Wh) */}
            <path
              d={`M 40 220 L 880 ${220 - (123.66 / 180) * 200}`}
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* Allowed Curve Path (0.917 Wh/d -> 165 Wh) */}
            <path
              d={`M 40 220 L 880 ${220 - (165.0 / 180) * 200}`}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.5"
            />

            {/* Actual Used Shunt Ledger Path */}
            <path
              d={simulationDays.reduce((acc, pt, idx) => {
                const x = 40 + (idx / 179) * 840;
                const y = 220 - (pt.actualUsedWh / 180) * 200;
                return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
              }, '')}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
            />

            {/* Active Selected Day Vertical Indicator Line */}
            {(() => {
              const x = 40 + ((selectedDay - 1) / 179) * 840;
              const yActual = 220 - (activeDayData.actualUsedWh / 180) * 200;
              const yAllowed = 220 - (activeDayData.allowedWh / 180) * 200;
              return (
                <g>
                  <line x1={x} y1="20" x2={x} y2="220" stroke="#38bdf8" strokeWidth="1.5" />
                  <circle cx={x} cy={yActual} r="5" fill="#f59e0b" stroke="#0f172a" strokeWidth="2" />
                  <circle cx={x} cy={yAllowed} r="5" fill="#06b6d4" stroke="#0f172a" strokeWidth="2" />
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Timeline Day Scrubber */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
            <span>Scrub Timeline: <strong className="text-white">Day {selectedDay}</strong> of 180</span>
            <span className="text-cyan-400">Tier: {activeDayData.tier}</span>
          </div>
          <input
            type="range"
            min="1"
            max="180"
            value={selectedDay}
            onChange={e => setSelectedDay(parseInt(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

      </div>

      {/* Interactive Gate Decision Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Action Gate Evaluator */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Live Gate Evaluation (Day {selectedDay})
            </h3>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              isActionAllowed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {isActionAllowed ? 'GATE APPROVED' : 'GATE REJECTED'}
            </span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Cumulative Used So Far (Ledger):</span>
              <span className="text-amber-400 font-bold">{activeDayData.actualUsedWh.toFixed(3)} Wh</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Allowed Ceiling at Day {selectedDay}:</span>
              <span className="text-cyan-400 font-bold">{activeDayData.allowedWh.toFixed(3)} Wh</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Unspent Energy Margin:</span>
              <span className={`font-bold ${marginAtDay >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {marginAtDay.toFixed(3)} Wh
              </span>
            </div>
          </div>

          {/* Test Action Buttons */}
          <div className="pt-2">
            <span className="text-xs font-mono text-slate-400 block mb-2">Test Candidate Optional Action:</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                onClick={() => setTestCostWh(0.295)}
                className={`p-2 rounded border text-left cursor-pointer ${
                  testCostWh === 0.295 ? 'bg-cyan-950/40 border-cyan-400 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-semibold text-white">Extra Profile Cast</div>
                <div className="text-[10px] text-slate-500">Cost: 0.295 Wh</div>
              </button>

              <button
                onClick={() => setTestCostWh(0.010)}
                className={`p-2 rounded border text-left cursor-pointer ${
                  testCostWh === 0.010 ? 'bg-cyan-950/40 border-cyan-400 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-semibold text-white">Storm High-Rate Argos</div>
                <div className="text-[10px] text-slate-500">Cost: 0.010 Wh</div>
              </button>

              <button
                onClick={() => setTestCostWh(0.0015)}
                className={`p-2 rounded border text-left cursor-pointer ${
                  testCostWh === 0.0015 ? 'bg-cyan-950/40 border-cyan-400 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-semibold text-white">Extra GNSS Fix</div>
                <div className="text-[10px] text-slate-500">Cost: 0.0015 Wh</div>
              </button>

              <button
                onClick={() => setTestCostWh(0.590)}
                className={`p-2 rounded border text-left cursor-pointer ${
                  testCostWh === 0.590 ? 'bg-cyan-950/40 border-cyan-400 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-semibold text-white">Double Cast Trial</div>
                <div className="text-[10px] text-slate-500">Cost: 0.590 Wh</div>
              </button>
            </div>
          </div>

          <div className={`p-3 rounded-lg border text-xs font-mono ${
            isActionAllowed ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
          }`}>
            <div className="font-bold flex items-center gap-1.5">
              {isActionAllowed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>Formula: used_Wh ({activeDayData.actualUsedWh.toFixed(2)}) + cost ({testCostWh.toFixed(3)}) &le; allowed ({activeDayData.allowedWh.toFixed(2)})</span>
            </div>
            <div className="text-[11px] mt-1 text-slate-300">
              {isActionAllowed
                ? 'Action fits safely within mission allowed curve! MCU executes cast.'
                : 'Action exceeds allowed curve for Day ' + selectedDay + '. Action suppressed to protect 180-day lifetime.'}
            </div>
          </div>

        </div>

        {/* Right: Degradation Ladder (§7 & §10) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Degradation Ladder: Slows Down Instead of Dying
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Autonomous fallback tiers triggered by ledger thresholds</p>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {[
              {
                tier: 'Full',
                when: 'used + cost ≤ allowed',
                action: '2 baseline profiles / day + adaptive extra profiles',
                active: activeDayData.tier === 'Full',
                color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20'
              },
              {
                tier: 'Lean',
                when: 'used > allowed',
                action: 'Baseline only (2 profiles / day), zero adaptive extras',
                active: activeDayData.tier === 'Lean',
                color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20'
              },
              {
                tier: 'Survival',
                when: 'used > allowed + 10 Wh',
                action: '1 profile / day, status 2× / day. Tagged CRITICAL once.',
                active: activeDayData.tier === 'Survival',
                color: 'text-amber-400 border-amber-500/30 bg-amber-950/20'
              },
              {
                tier: 'Beacon',
                when: '< 5 Wh usable left',
                action: 'Position + status once a day until battery exhaustion',
                active: activeDayData.tier === 'Beacon',
                color: 'text-rose-400 border-rose-500/30 bg-rose-950/20'
              },
              {
                tier: 'Winch fault (any tier)',
                when: 'Winch stall jam not cleared after retries',
                action: 'Becomes surface drifter (like SVP-S). Probe logs at resting depth.',
                active: false,
                color: 'text-purple-400 border-purple-500/30 bg-purple-950/20'
              }
            ].map(item => (
              <div
                key={item.tier}
                className={`p-3 rounded-lg border transition-all ${
                  item.active ? `${item.color} ring-1 ring-cyan-400` : 'border-slate-800 bg-slate-950/60 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white text-[12px]">{item.tier}</div>
                  <div className="text-[10px] text-slate-500">{item.when}</div>
                </div>
                <div className="text-[11px] text-slate-300 mt-1">{item.action}</div>
              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
};
