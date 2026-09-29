import React, { useState } from 'react';
import { Layers, ShieldCheck, Anchor, Waves, ArrowDownCircle, Info, ChevronRight, Activity, Thermometer, Gauge } from 'lucide-react';

export const PhysicalDiagram: React.FC = () => {
  const [selectedSubsystem, setSelectedSubsystem] = useState<string>('float');

  const subsystems = [
    {
      id: 'float',
      title: '400 mm HDPE Float Sphere',
      depth: '0.0 m (Surface)',
      badge: 'SETTLED',
      specs: 'Rotomoulded UV-stabilised HDPE, 6 mm wall, double O-ring flange (LT-NBR rated -40°C), closed-cell foam in lower void.',
      why: 'SVP size class. Self-rights after wave slam; lowest surface-to-volume ratio slows heat loss in polar cold; white hull prevents 24h summer solar overheating; RF-transparent for internal antennas.',
      details: [
        'Electronics Bay: IP68 sealed container with silica gel desiccant',
        'Cold-protection: KIM1 and batteries mounted at lowest floor near water temp (-1.9°C), foam above',
        'Hull Penetrations: Only 3 openings (winch shaft, tether anchor, mast base)',
        'Wet Sensing: Dual capacitive pads read through 6 mm HDPE wall (no drill holes)'
      ]
    },
    {
      id: 'mast',
      title: 'Atmospheric Mast & Antennas',
      depth: '+0.25 m above hull',
      badge: 'BUILT',
      specs: 'Sensirion SHT45 in radiation shield (Air T ±0.1°C, RH ±1%), Bosch BMP390 (Air Pressure ±0.5 hPa), u-blox NEO-M9N GNSS patch inside dome.',
      why: 'Air pressure sensor moved to mast to eliminate hull port. Internal antennas in RF-transparent dome survive polar freeze-over.',
      details: [
        'Kinéis KIM1 400 MHz antenna located under top dome',
        'NEO-M9N multi-constellation GNSS (GPS, Galileo, BeiDou, GLONASS)',
        'Argos Doppler positioning acts as autonomous hardware backup if GNSS fails'
      ]
    },
    {
      id: 'winch',
      title: 'Zero-Power Winch & Docking Mechanism',
      depth: '0.0 to 0.3 m Dock',
      badge: 'ADD-HW',
      specs: '12V worm-gear DC motor (JGY-370 class), dry hull interior. POM-C spool drum in free-flooding dock. 316 stainless shaft with double lip seal.',
      why: 'Worm gear cannot back-drive: holds probe rigidly docked at 0.3 m with ZERO electrical power during long sleeps. Slip ring passes RS-485 data.',
      details: [
        'Hall encoder on motor shaft counts paying-out cable in hardware',
        'Dry dock reed switch confirms true physical home position with probe magnet',
        'Fast jam protection: motor current cut off within 200 ms if stall limit (>450 mA) exceeded',
        'Upgrade path: Magnetic coupling through hull wall to eliminate rotating seal'
      ]
    },
    {
      id: 'probe',
      title: 'Tapered Sensor Probe',
      depth: '0.3 m to 10.0 m (Profile Zone)',
      badge: 'FIXED v3',
      specs: 'POM-C tube (50 mm OD, 8 mm wall, 250 mm long), dual O-rings, streamlined nose. Blue Robotics TSYS01 (±0.1°C), Bar30 (2 mm res), Atlas EZO-EC (±2%).',
      why: 'DESCENT IS SCIENCE PASS: Free-falls nose-first at ~0.2 m/s. Sensors on leading tapered nose enter undisturbed water before wake. Winch pays out slight slack to decouple probe from float wave heave.',
      details: [
        'Two UHMWPE slider rings guide probe along Dyneema tether (cannot twist)',
        '4-core PUR aramid-reinforced cable delivers power and RS-485 at 1 Hz',
        'Probe MCU: STM32L031 minimalist front-end converts sensor telemetry',
        'Hard limit at 10.0 m by probe pressure, leaving 2 m safety clearance above drogue'
      ]
    },
    {
      id: 'drogue',
      title: '15 m Holey-Sock Drogue & Tether',
      depth: '12.0 m to 18.0 m',
      badge: 'RATIO ≥ 40:1',
      specs: '4 mm Dyneema line, 316 stainless swivel, calibrated weak link below float, 6 m ripstop nylon holey-sock drogue (HDPE hoops) centred at 15 m with epoxy-coated steel ballast.',
      why: 'Follows 15 m ocean circulation current rather than surface wind slip. Drag-area ratio ≥ 40:1 with probe drag counted.',
      details: [
        'Dry-side load cell at tether anchor measures tension continuously',
        'Ice snag protection: weak link breaks before float anchor, sacrificing drogue to save hull',
        'Drogue loss detection: tension drop + wind-aligned drift triggers CRITICAL flag'
      ]
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* 4 Key Figures Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-mono text-cyan-400">0.3 – 10.0 m</div>
          <div className="text-xl font-bold text-white mt-1">Continuous T + S</div>
          <div className="text-xs text-slate-400 mt-1">Free-fall descent science pass with loop-edit</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-mono text-cyan-400">2 / day</div>
          <div className="text-xl font-bold text-white mt-1">Baseline Profiles</div>
          <div className="text-xs text-slate-400 mt-1">Plus adaptive extras funded by energy gate</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-mono text-cyan-400">180 Days</div>
          <div className="text-xl font-bold text-white mt-1">180 Wh Usable</div>
          <div className="text-xs text-slate-400 mt-1">281 Wh nominal, 35% cold & ageing derating</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-mono text-emerald-400">≈ ₹1.3 Lakh</div>
          <div className="text-xl font-bold text-white mt-1">Made in India</div>
          <div className="text-xs text-slate-400 mt-1">vs ~$7,800 USD imported (~₹6.5L + duty)</div>
        </div>
      </div>

      {/* Main Layout: Cutaway CAD Image + Interactive Subsystems */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Visual Apparatus Model */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white tracking-wide">
                  X Drifter Mechanical Architecture (v3 Master Design)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  MoES / NCPOR · SIH 2026 Problem Statement 26065
                </p>
              </div>
              <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                <span>Scale: 20 px / m</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
            </div>

            {/* Generated Image Cutaway */}
            <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 aspect-video mb-4">
              <img
                src="/src/assets/images/x_drifter_cutaway_1790691382966.jpg"
                alt="X Drifter CAD cutaway showing HDPE float, winch, tapered probe, and 15m holey-sock drogue"
                className="w-full h-full object-cover object-center"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-2.5 left-3 text-xs font-mono text-slate-300">
                Figure 1: Full-system mechanical arrangement in Southern Ocean deployment
              </div>
            </div>

            {/* Vertical Scale Coordinate Bar */}
            <div className="space-y-2 bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-cyan-400 font-semibold">0.0 m</span>
                <span>400 mm White HDPE Sphere (Double O-ring, dry bay, batteries, KIM1 low)</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-cyan-400">0.3 m</span>
                <span>Dock Position (Worm gear zero-power hold, reed switch confirm)</span>
              </div>
              <div className="flex items-center justify-between text-emerald-400">
                <span className="font-semibold">0.3 – 10.0 m</span>
                <span className="text-slate-300">PROFILING ZONE: Descent Science (0.2 m/s), Ascent Recovery QC</span>
              </div>
              <div className="flex items-center justify-between text-amber-400">
                <span>10.0 m</span>
                <span>Hard Stop by Probe Pressure (2 m clearance above drogue top)</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-cyan-400">12.0 m</span>
                <span>Drogue Top & Tether Swivel (4 mm Dyneema line)</span>
              </div>
              <div className="flex items-center justify-between text-cyan-400">
                <span className="font-semibold">12 – 18 m</span>
                <span className="text-slate-300">6 m Holey-Sock Drogue (Centred at 15 m, Area Ratio ≥ 40:1)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Critical v3 Fix: Descent is science pass (free-fall decouples wave heave)</span>
            <span className="font-mono text-cyan-400">1 Hz Probe Logging</span>
          </div>
        </div>

        {/* Right Column: Interactive Subsystem Inspector */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Subsystem Selector Buttons */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            {subsystems.map(sub => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubsystem(sub.id)}
                className={`flex-1 py-1.5 px-2.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap text-center ${
                  selectedSubsystem === sub.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sub.title.split(' ')[0]} {sub.title.split(' ')[1]}
              </button>
            ))}
          </div>

          {/* Active Subsystem Detail Card */}
          {(() => {
            const active = subsystems.find(s => s.id === selectedSubsystem) || subsystems[0];
            return (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">{active.title}</h3>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-1">
                      <span>Depth: {active.depth}</span>
                      <span>·</span>
                      <span className="text-cyan-400">{active.badge}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
                  <div className="text-xs uppercase font-mono text-slate-400 mb-1">Specification & Materials</div>
                  <p className="text-xs text-slate-200 leading-relaxed">{active.specs}</p>
                </div>

                <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
                  <div className="text-xs uppercase font-mono text-slate-400 mb-1">Engineering Rationale (Why)</div>
                  <p className="text-xs text-slate-300 leading-relaxed">{active.why}</p>
                </div>

                <div>
                  <div className="text-xs uppercase font-mono text-slate-400 mb-2">Key Implementation Invariants</div>
                  <ul className="space-y-1.5">
                    {active.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                        <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            );
          })()}

          {/* Environmental Operating Envelope Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-semibold uppercase font-mono text-slate-400 mb-2.5">
              Operating Temperature Thermal Design
            </h4>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Ambient Air (Winter/Summer)</span>
                <span className="text-slate-200">-40 °C to +5 °C</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Sea Surface (Polar Ocean)</span>
                <span className="text-slate-200">-1.9 °C to +2.0 °C</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Inside Hull (Floating)</span>
                <span className="text-cyan-400">-5 °C to +25 °C</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Inside Hull (Stranded on Floe)</span>
                <span className="text-amber-400">Towards -30 °C</span>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-400">
              Low mounting keeps KIM1 and batteries buffered by seawater thermal inertia (-1.9°C). Transmit locked below -20°C.
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
