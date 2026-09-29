import React, { useState } from 'react';
import { Award, HelpCircle, CheckCircle, Search, Layers, ChevronDown, ChevronRight, DollarSign, ShieldAlert, Sparkles } from 'lucide-react';
import { ProblemFixItem, SlideItem, BomItem } from '../types/drifter';

export const DefenseDeck: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'slides' | 'problems' | 'qa' | 'bom'>('slides');
  const [selectedSlide, setSelectedSlide] = useState<number>(1);
  const [problemSearch, setProblemSearch] = useState<string>('');
  const [problemFilter, setProblemFilter] = useState<string>('all');
  const [expandedQa, setExpandedQa] = useState<number | null>(null);

  // 12 Slides from §16
  const slides: SlideItem[] = [
    {
      slideNumber: 1,
      title: "Title & Mission Context",
      referenceSection: "§1, §13",
      keyPoints: [
        "X Drifter: Autonomous 0.3–10 m Upper-Ocean Profiling Drifter",
        "Problem Statement 26065 · Ministry of Earth Sciences / NCPOR · Hardware · Robotics & Drones",
        "Target Mission: Continuous temperature and salinity profiling of the top 10 m of the Southern Ocean twice daily for 6 months"
      ],
      defenseFocus: "Clear institutional alignment with Indian Antarctic programme (NCPOR) and INCOIS."
    },
    {
      slideNumber: 2,
      title: "The Problem & The Gap",
      referenceSection: "§1, §13",
      keyPoints: [
        "The top 10 m of the Southern Ocean (fresh meltwater lenses, rain lenses, mixed layer dynamics) is severely under-sampled",
        "SVP drifters measure only 1 single depth; Argo floats switch pumps off at 2–5 dbar and surface only every 10 days",
        "Ice-Tethered Profilers (ITP) require thick sea ice; Wirewalkers run for weeks, not 6 months",
        "Current imported profiling drifters cost ~$7,800 USD before shipping and customs duty (~₹6.5+ Lakhs)"
      ],
      defenseFocus: "Proves urgent scientific need and explains why existing oceanographic platforms fail this specific regime."
    },
    {
      slideNumber: 3,
      title: "The Idea in One Picture",
      referenceSection: "§2",
      keyPoints: [
        "400 mm rotomoulded HDPE white float sphere at surface with internal antennas",
        "Holey-sock drogue centred at 15 m (drag-area ratio ≥ 40:1) following current, not wind",
        "Compact sensor probe winched up and down the drogue tether between 0.3 m and 10 m",
        "4 Key Numbers: 0.3–10 m profile, 2/day baseline, 180 days on 180 Wh usable, ≈ ₹1.3 lakh unit cost"
      ],
      defenseFocus: "Visual simplicity: single moving probe riding a standard drogue line."
    },
    {
      slideNumber: 4,
      title: "Technical Approach & 8-Step Superloop",
      referenceSection: "§2, §9",
      keyPoints: [
        "Event-driven bare-metal superloop on STM32L476 with zero RTOS overhead",
        "1. Wake on RTC/sensor interrupt -> 2. Read cheap sensors -> 3. Check critical triggers",
        "4. Update autonomous state with 3-check hysteresis -> 5. Mandatory actions run -> 6. Optional actions pass energy gate",
        "7. Save ledger to RTC backup registers -> 8. Re-enter ultra-low-power Stop 2 sleep (1–2 µA)"
      ],
      defenseFocus: "Demonstrates proven deterministic embedded architecture without scheduler jitter or heap fragmentation."
    },
    {
      slideNumber: 5,
      title: "Settled Engineering Decisions",
      referenceSection: "§3, §4",
      keyPoints: [
        "Follow Current or Wind? Current at 15 m (NOAA GDP standard 40:1 ratio holey-sock drogue)",
        "Why Descent is Science Pass? Free-fall descent (~0.2 m/s) with slack cable decouples float wave heave; sensors lead into undisturbed water first",
        "Hard Limit at 10.0 m: 2 m safety clearance above drogue top to eliminate entanglement risk",
        "Argos over Iridium: Legal in India without DoT restrictions; India's Oceansat-3 carries ARGOS-4; polar orbits give maximum pass frequency near Antarctica"
      ],
      defenseFocus: "Every decision has a definitive physics and operational rationale."
    },
    {
      slideNumber: 6,
      title: "Hardware Specifications & Thermal Design",
      referenceSection: "§5, §6",
      keyPoints: [
        "Science Sensors: Blue Robotics Celsius TSYS01 (±0.1°C), Bar30 (2 mm res), Atlas EZO-EC (±2%), Bosch BMP390, Sensirion SHT45",
        "6x Saft LSH20 Li-SOCl2 (3S2P, 10.8V 26Ah 281Wh nominal, -60°C rated) + supercapacitor pulse buffer",
        "Double O-ring flange (LT-NBR rated -40°C), IP68 internal electronics bay with silica gel",
        "Low mounting of KIM1 and batteries buffers them against seawater temperature (-1.9°C) rather than -40°C air"
      ],
      defenseFocus: "Thermal and structural survivability validated component by component."
    },
    {
      slideNumber: 7,
      title: "The Brain: STM32L476 & Autonomous Logic",
      referenceSection: "§8, §9",
      keyPoints: [
        "Cortex-M4 with FPU running on-chip OpenMetBuoy IMU wave spectrum FFT",
        "6 Autonomous States: NORMAL, STORM, CALM, ICE_APPROACH, ICE, ON_FLOE",
        "Strict 3-Check Hysteresis Rule: Eliminates false mode oscillations in volatile Antarctic conditions",
        "Dual capacitive wet pads read through 6 mm hull wall: both dry immediately detects stranding on ice floe"
      ],
      defenseFocus: "Sophisticated autonomy implemented with micro-watt firmware efficiency."
    },
    {
      slideNumber: 8,
      title: "Energy Ledger & Allowed-Curve Gate",
      referenceSection: "§7",
      keyPoints: [
        "Profiling consumes 85.5% of energy budget (0.590 Wh/day for 2 profiles). Every decision is about profiles",
        "Li-SOCl2 has a flat discharge curve: Battery % cannot be read by voltage. True shunt-measured energy ledger while awake",
        "v3 Allowed-Curve Gate: allowed(day) = (180 Wh - 15 Wh reserve) * day / 180 = 0.917 Wh/day",
        "Funds ~140 adaptive extra profiles (0.75 extras/day) while preserving a 15 Wh (~3 week) survival reserve"
      ],
      defenseFocus: "Proves mathematical certainty of the 180-day mission lifetime."
    },
    {
      slideNumber: 9,
      title: "Edge Cases & Headline Fixes",
      referenceSection: "§11",
      keyPoints: [
        "Winch Jam: Fast 200 ms motor current cutoff + slow encoder mismatch; reverse 1-2s, retry twice, fallback to surface drifter",
        "Cold Grease: Temperature-corrected stall limit + slow warm-up run prevents false jam detection",
        "Ice Snag: Calibrated weak link below float breaks before hull anchor; sacrifices drogue to save the drifter",
        "Antenna Covered Hold: Wet pads + GNSS fix status holds Argos transmit buffer when washed by heavy seas or snow"
      ],
      defenseFocus: "The system degrades gracefully instead of failing silently."
    },
    {
      slideNumber: 10,
      title: "Honest Prior Art & Scope Boundaries",
      referenceSection: "§12",
      keyPoints: [
        "What X Claims: Continuous 0.3–10 m T+S profiling from an open-ocean drifter at drifter cost (~₹1.3L); energy-gated 6-month autonomy; Indian data chain",
        "What X Does NOT Claim: Did not invent drifters, drogues, or satellite telemetry; does not claim climate-grade salinity on day 1 (±0.7–1 psu resolves 1–2 psu meltwater lenses)",
        "Comparative Table: SVP-S ($6,000, 2 depths only), Argo (misses top 2–5 dbar, surfaces every 10 days), Wirewalker (weeks, not months)"
      ],
      defenseFocus: "Intellectual honesty and exact scientific differentiation."
    },
    {
      slideNumber: 11,
      title: "Made in India & Cost Analysis",
      referenceSection: "§13",
      keyPoints: [
        "Total deployable unit cost: ₹1.25 – 1.35 Lakh (~$1,560 USD) vs ~$7,800 USD imported before duty",
        "Local Indian Manufacturing: HDPE rotomoulded float, CNC POM-C winch drum/probe, drogue stitching, PCB assembly, firmware, NCPOR ground server",
        "Oceansat-3 Alignment: Carries ARGOS-4 payload launched under ISRO-CNES agreement; full data sovereignty"
      ],
      defenseFocus: "Massive cost reduction (80% cheaper) and strategic national self-reliance for Polar research."
    },
    {
      slideNumber: 12,
      title: "Validation Roadmap & Future Upgrades",
      referenceSection: "§15",
      keyPoints: [
        "Priority 1 Bench Tests: Winch motor energy per profile (0.295 Wh figure), KIM1 cold-chamber transmit test (-20°C / -30°C), conductivity cell in -2°C seawater",
        "Priority 2 Dynamic Tests: Tank test for free-fall descent with slack control and wave heave, drag ratio calculation (≥40:1), weak-link pull test",
        "Future Upgrades: Magnetic coupling through hull (no rotating seal), summer solar harvesting upgrade, two-way satellite commanding"
      ],
      defenseFocus: "Rigorous empirical validation plan addressing remaining engineering risks."
    }
  ];

  // 43 Problems and Fixes from §11
  const problems: ProblemFixItem[] = [
    { id: 1, category: "Satellite & Location", problem: "Iridium not permitted in India without DoT authorisation; import restricted", fix: "Argos via Kinéis KIM1. India's Oceansat-3 carries ARGOS-4 under ISRO-CNES cooperation.", status: "DONE" },
    { id: 2, category: "Satellite & Location", problem: "One-way link: no shore commands", fix: "Fully autonomous, configured before deployment. Two-way module as upgrade.", status: "FIXED v3" },
    { id: 3, category: "Satellite & Location", problem: "No acknowledgement: 'failed 3 tries' cannot be detected", fix: "Antenna check from wet pads + GNSS fix + IMU tilt before transmit.", status: "FIXED v3" },
    { id: 4, category: "Satellite & Location", problem: "Delta encoding breaks after one lost message", fix: "Self-contained messages with sequence numbers, repeated across satellite passes.", status: "FIXED v3" },
    { id: 5, category: "Satellite & Location", problem: "31-byte message limit on Kinéis KIM1", fix: "1 m bins as scaled integers, 2 messages per profile, full high-res data kept in flash.", status: "FIXED v3" },
    { id: 6, category: "Satellite & Location", problem: "NavIC does not reach the Southern Ocean (~1,500 km range from India)", fix: "Multi-GNSS receiver (u-blox NEO-M9N); Argos Doppler positioning as backup.", status: "DONE" },
    { id: 7, category: "Satellite & Location", problem: "Geostationary GSAT sits low or below horizon near Antarctica", fix: "Polar-orbiting Argos / Kinéis satellites: most passes happen near the poles.", status: "DONE" },
    { id: 8, category: "Satellite & Location", problem: "KIM1 rated only to -20 °C (ambient can reach -40 °C)", fix: "Low mounting, foam insulation, transmit locked below -20 °C internal temp.", status: "NEW v3" },
    { id: 9, category: "Satellite & Location", problem: "Signal loss through 6 mm HDPE hull unmeasured", fix: "Measure GNSS and 401 MHz RF loss through 6 mm sample in RF chamber.", status: "OPEN" },
    { id: 10, category: "Satellite & Location", problem: "KIM1 needs WPC radio clearance in India", fix: "Apply early with MoES / NCPOR institutional support.", status: "OPEN" },
    { id: 11, category: "Power & Energy", problem: "Li-SOCl2 voltage curve is completely flat, so battery % cannot be read", fix: "True accumulated energy ledger from main-line shunt.", status: "DONE" },
    { id: 12, category: "Power & Energy", problem: "Ledger originally built only on static cost-table guesses", fix: "Main-line shunt sampled while awake (98% of power); sleep modelled (2%).", status: "FIXED v3" },
    { id: 13, category: "Power & Energy", problem: "Gating against baseline curve meant the 55 Wh margin was never spent", fix: "Allowed curve formula with a 15 Wh reserve: allowed(day) = (180-15)*day/180.", status: "FIXED v3" },
    { id: 14, category: "Power & Energy", problem: "Pulse loads and passivation cause voltage dips and MCU brown-outs", fix: "Supercapacitor pulse buffer on motor and 5 V rails.", status: "SIZE" },
    { id: 15, category: "Power & Energy", problem: "Alkaline cells lose excessive capacity in polar cold", fix: "Saft LSH20 Li-SOCl2 primary cells, operational to -60 °C.", status: "DONE" },
    { id: 16, category: "Power & Energy", problem: "Older design used a stale 68 Wh battery pack", fix: "Upgraded to 281 Wh nominal (6x D-cells 3S2P), 180 Wh usable after 35% derating.", status: "DONE" },
    { id: 17, category: "Power & Energy", problem: "Turbine harvesting proposed for drifter", fix: "Rejected: float moves with water (no relative flow); probe too slow (0.2 m/s).", status: "DONE" },
    { id: 18, category: "Power & Energy", problem: "Running out of energy early in cold winter", fix: "Autonomous degradation ladder: Full -> Lean -> Survival -> Beacon.", status: "FIXED v3" },
    { id: 19, category: "Power & Energy", problem: "CALM state energy saving had no clear mechanism", fix: "Skip the 2nd daily profile while calm (saves ~0.3 Wh/day, ~20 Wh total).", status: "FIXED v3" },
    { id: 20, category: "Winch & Mechanics", problem: "Winch motor jam", fix: "Two-speed detection (fast current + slow encoder), reverse 1-2s and retry, surface drifter fallback.", status: "DONE" },
    { id: 21, category: "Winch & Mechanics", problem: "Cold grease stiffens and fakes a jam", fix: "Low-temp synthetic grease, temperature-corrected stall limit, slow warm-up run.", status: "DONE" },
    { id: 22, category: "Winch & Mechanics", problem: "Probe not really docked (reed switch missing)", fix: "Encoder counts home position, dry dock reed switch confirms true mechanical seating.", status: "DONE" },
    { id: 23, category: "Winch & Mechanics", problem: "Holding probe docked costs electrical power", fix: "Worm-gear motor cannot back-drive: holds probe at 0.3 m with ZERO power.", status: "DONE" },
    { id: 24, category: "Winch & Mechanics", problem: "Shaft seal wears over thousands of cycles", fix: "Double lip seal; magnetic coupling upgrade path through hull wall.", status: "TORQUE" },
    { id: 25, category: "Winch & Mechanics", problem: "Probe snags on the way down", fix: "Slack monitor stops pay-out immediately before line piles up.", status: "NEW v3" },
    { id: 26, category: "Winch & Mechanics", problem: "Probe tangles with the drogue tether", fix: "Hard 10 m depth limit by pressure (2 m clearance above 12 m drogue top); deep profile dropped.", status: "FIXED v3" },
    { id: 27, category: "Winch & Mechanics", problem: "Sea ice grabs float or drogue", fix: "Tension spike docks probe; weak link breaks below float to sacrifice drogue and save float.", status: "DONE" },
    { id: 28, category: "Winch & Mechanics", problem: "Drogue lost in rough seas", fix: "Tension drop + wind-following drift detected; flags all subsequent data as wind-biased.", status: "DONE" },
    { id: 29, category: "Probe & Data Quality", problem: "Wave heave makes probe yo-yo through its own wake on taut line", fix: "Free-fall descent with controlled slack sized from IMU wave height; loop-edit filter.", status: "NEW v3" },
    { id: 30, category: "Probe & Data Quality", problem: "Which pass is clean (ascent vs descent)?", fix: "Descent = science pass (decoupled from waves); Ascent = recovery plus QC cross-check.", status: "FIXED v3" },
    { id: 31, category: "Probe & Data Quality", problem: "Probe body stirs water ahead of its sensors", fix: "Tapered tube, sensors mounted at leading nose bottom.", status: "FIXED v3" },
    { id: 32, category: "Probe & Data Quality", problem: "Top 0.5 m disturbed by float hull motion", fix: "Flagged suspect (QC=2); true surface SST taken from float's own bottom sensor.", status: "DONE" },
    { id: 33, category: "Probe & Data Quality", problem: "Salinity only ±0.7–1 psu absolute accuracy", fix: "2-point standard seawater calibration; salinity steps evaluated by sensor precision.", status: "DONE" },
    { id: 34, category: "Probe & Data Quality", problem: "Conductivity cell may not be rated below +1 °C", fix: "Verify with supplier, test in -2 °C saltwater bath, keep named upgrade cell.", status: "OPEN" },
    { id: 35, category: "Probe & Data Quality", problem: "Surface wind contaminates current data", fix: "Holey-sock drogue centred at 15 m, small float, drag-area ratio ≥ 40:1 with probe.", status: "DONE" },
    { id: 36, category: "Cold, Heat & Hull", problem: "O-rings stiffen and leak in polar cold", fix: "Low-temperature LT-NBR (rated -40 °C) or fluorosilicone (FVMQ -60 °C), double O-ring.", status: "DONE" },
    { id: 37, category: "Cold, Heat & Hull", problem: "Sealed hull overheats in 24 h polar summer sun", fix: "Pristine white HDPE hull limits solar thermal absorption.", status: "DONE" },
    { id: 38, category: "Cold, Heat & Hull", problem: "Hull leakage into electronics", fix: "IP68 inner enclosure, silica gel desiccant, internal SHT45 humidity alert, reserve foam.", status: "DONE" },
    { id: 39, category: "Cold, Heat & Hull", problem: "Extra hull drill holes for wet pins create leak paths", fix: "Capacitive pads read through intact 6 mm HDPE wall via STM32 Touch Sensing Controller (TSC).", status: "FIXED v3" },
    { id: 40, category: "Cold, Heat & Hull", problem: "Drifter stranded on sea ice floe", fix: "New ON_FLOE state triggered when both pads are dry; acts as low-power position beacon.", status: "NEW v3" },
    { id: 41, category: "Logic & Firmware", problem: "False autonomous state switches due to single wave spikes", fix: "3-check hysteresis, 30 s sustained motion check, 10 min debounce, wake caps.", status: "DONE" },
    { id: 42, category: "Logic & Firmware", problem: "MCU hang or brownout loses accumulated ledger state", fix: "Independent watchdog + RTC backup registers persist state and ledger through resets.", status: "DONE" },
    { id: 43, category: "Logic & Firmware", problem: "Two SHT45 sensors (mast & bay) share hardcoded I2C address 0x44", fix: "Separated across I2C1 (mast + BMP390 + IMU) and I2C2 (bay SHT45 + SST TSYS01).", status: "DONE" }
  ];

  // Judge Q&A from §14
  const judgeQa = [
    {
      q: "Profiling drifters already exist. Why build X?",
      a: "Existing profiling platforms do not address this specific regime. Ice-Tethered Profilers (ITP) cost over $40,000 and require thick sea ice floes. Del Mar Wirewalkers run for only a few weeks due to mechanical fatigue. Standard Argo floats switch off their pump near 2–5 dbar to prevent surface contamination, missing the meltwater lens, and surface only every 10 days. X targets the open-water upper 10 m continuously, twice daily, for 6 months, at true drifter cost (~₹1.3 Lakh)."
    },
    {
      q: "Why not place fixed sensors along the line instead of a winch?",
      a: "Conductivity cells are by far the most expensive sensor component (~₹14,500 each). Ten fixed CTD nodes would increase sensor costs tenfold to over ₹1.5 Lakh alone, add drag and entanglement points, and introduce severe cross-sensor calibration offsets. One moving sensor eliminates intercalibration offsets and provides continuous 10 cm vertical resolution."
    },
    {
      q: "Why use Argos / Kinéis instead of Iridium?",
      a: "Iridium satellite equipment requires strict Ministry of Telecommunications (DoT) authorisation in India and faces import delays. Argos is fully approved and legal in India. Crucially, India's Oceansat-3 (EOS-06, launched in 2022) carries an operational ARGOS-4 payload under ISRO–CNES cooperation. Furthermore, polar-orbiting satellites provide up to 14–16 passes per day over the Southern Ocean, offering maximum coverage where geostationary systems fail."
    },
    {
      q: "Why is the science pass done on the descent rather than ascent?",
      a: "When a drifter bobs on 2–4 m Southern Ocean swell, a taut winch line on the ascent couples float heave directly to the probe, causing it to yo-yo by up to a metre every wave cycle through its own disturbed wake. On the descent, the winch pays out cable slightly faster than the probe free-falls (~0.2 m/s). The resulting slack completely decouples the probe from surface wave heave, allowing the tapered nose to enter undisturbed water first. Ascent is logged purely for recovery and QC cross-checking."
    },
    {
      q: "Will the moving probe spoil current tracking?",
      a: "No. The frontal area of the 50 mm probe is minuscule compared to the 6 m holey-sock drogue centred at 15 m. We strictly maintain a drag-area ratio ≥ 40:1 (NOAA Global Drifter Program standard) with the probe included in the drag budget, ensuring slippage remains under 1 cm/s."
    },
    {
      q: "How do you know how much battery is remaining if Li-SOCl2 voltage is flat?",
      a: "Lithium thionyl chloride cells maintain an almost perfectly flat 3.6 V discharge plateau until 95% depleted, rendering voltage-based fuel gauging useless. X uses a dedicated high-precision current shunt on the battery rail to measure and integrate actual Wh consumed during every wake cycle into an RTC backup register. The allowed-curve gate compares this measured ledger against the mission lifetime curve before executing any optional profile."
    },
    {
      q: "What happens when sea ice surrounds or traps the float?",
      a: "The autonomous state machine detects approaching ice via falling SST (≤ 0°C), slowing drift velocity, and damped wave heave, automatically docking the probe early. In sea ice, profiling ceases completely. If ice grabs the drogue, a weak link below the float severs to sacrifice the drogue and preserve the float. If stranded atop an ice floe, dual capacitive pads detect air dryness, switching the MCU into ON_FLOE beacon mode."
    },
    {
      q: "What if the winch jams in the field?",
      a: "X incorporates a two-tier jam recovery algorithm. If motor current exceeds the stall limit (>450 mA) for >200 ms, the hardware comparator cuts power instantly. The firmware reverses the winch for 1–2 seconds and retries twice at low speed. If still jammed, it locks the spool and switches to 'surface drifter' mode (like an SVP-S), continuing to broadcast surface SST, air telemetry, and drift position for the rest of its 180-day life."
    }
  ];

  const filteredProblems = problems.filter(p => {
    const matchesSearch = p.problem.toLowerCase().includes(problemSearch.toLowerCase()) ||
                          p.fix.toLowerCase().includes(problemSearch.toLowerCase()) ||
                          p.category.toLowerCase().includes(problemSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (problemFilter === 'all') return true;
    return p.status === problemFilter;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Section Nav Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">SIH 2026 Defense Deck &amp; System Matrix</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                MoES / NCPOR · PS 26065
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Complete 12-slide presentation architecture, the 43 problem-fix registry, and judge defense playbook.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setActiveSection('slides')}
              className={`py-1.5 px-3 rounded transition-colors cursor-pointer ${
                activeSection === 'slides' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              12 Slide Map
            </button>
            <button
              onClick={() => setActiveSection('problems')}
              className={`py-1.5 px-3 rounded transition-colors cursor-pointer ${
                activeSection === 'problems' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              43 Problems &amp; Fixes
            </button>
            <button
              onClick={() => setActiveSection('qa')}
              className={`py-1.5 px-3 rounded transition-colors cursor-pointer ${
                activeSection === 'qa' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Judge Q&amp;A Defense
            </button>
          </div>
        </div>
      </div>

      {/* View 1: 12 Slide Map */}
      {activeSection === 'slides' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Slide Carousel / List */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1.5 max-h-[640px] overflow-y-auto">
            <div className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 pb-2 mb-2 border-b border-slate-800 flex justify-between">
              <span>MoES Presentation Deck</span>
              <span>12 Slides</span>
            </div>
            {slides.map(slide => (
              <button
                key={slide.slideNumber}
                onClick={() => setSelectedSlide(slide.slideNumber)}
                className={`w-full text-left p-2.5 rounded-lg font-mono text-xs transition-colors cursor-pointer flex items-center justify-between ${
                  selectedSlide === slide.slideNumber
                    ? 'bg-cyan-950/60 border border-cyan-500/40 text-cyan-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 text-slate-500 font-bold">{slide.slideNumber.toString().padStart(2, '0')}.</span>
                  <span className="font-semibold text-white truncate">{slide.title}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>
            ))}
          </div>

          {/* Right: Slide Content & Defense Script */}
          {(() => {
            const current = slides.find(s => s.slideNumber === selectedSlide) || slides[0];
            return (
              <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div>
                      <div className="text-xs font-mono text-cyan-400">SLIDE {current.slideNumber} OF 12 · {current.referenceSection}</div>
                      <h3 className="text-xl font-bold text-white mt-0.5">{current.title}</h3>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-xs uppercase font-mono text-slate-400 mb-2">Key Arguments &amp; Bullet Points</div>
                      <ul className="space-y-2.5">
                        {current.keyPoints.map((pt, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 mt-6">
                      <div className="text-xs uppercase font-mono text-amber-400 flex items-center gap-1.5 mb-1.5">
                        <Award className="w-3.5 h-3.5" />
                        <span>Judge Defense Objective</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-mono">
                        {current.defenseFocus}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400 mt-6">
                  <span>Replaces Dossier v2 &amp; 'MCU Logic Final'</span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={selectedSlide <= 1}
                      onClick={() => setSelectedSlide(s => Math.max(1, s - 1))}
                      className="px-2.5 py-1 bg-slate-800 rounded text-slate-300 disabled:opacity-40 cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      disabled={selectedSlide >= 12}
                      onClick={() => setSelectedSlide(s => Math.min(12, s + 1))}
                      className="px-2.5 py-1 bg-slate-800 rounded text-slate-300 disabled:opacity-40 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* View 2: 43 Problems & Fixes Matrix */}
      {activeSection === 'problems' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">43 Design Invariants &amp; Headline Fixes (§11)</h3>
              <p className="text-xs text-slate-400">Complete audit trail of every operational failure mode identified and solved</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search failure mode or fix..."
                value={problemSearch}
                onChange={e => setProblemSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono outline-none"
              />

              <select
                value={problemFilter}
                onChange={e => setProblemFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="DONE">DONE</option>
                <option value="FIXED v3">FIXED v3</option>
                <option value="NEW v3">NEW v3</option>
                <option value="OPEN">OPEN</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-slate-950 z-10 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2.5 px-3 w-10">#</th>
                  <th className="py-2.5 px-3 w-36">Category</th>
                  <th className="py-2.5 px-3">Problem Identified</th>
                  <th className="py-2.5 px-3">Engineering Fix Implemented</th>
                  <th className="py-2.5 px-3 w-28 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProblems.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 text-slate-500">{p.id}</td>
                    <td className="py-2 px-3 text-slate-400">{p.category}</td>
                    <td className="py-2 px-3 text-slate-200 font-sans">{p.problem}</td>
                    <td className="py-2 px-3 text-cyan-300 font-sans">{p.fix}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'DONE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        p.status === 'FIXED v3' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                        p.status === 'NEW v3' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                        'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 3: Judge Q&A Defense */}
      {activeSection === 'qa' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">Judge Question &amp; Answer Defense Protocol (§14)</h3>
            <p className="text-xs text-slate-400">Pre-computed technical responses for tough jury inquiries during the Grand Finale</p>
          </div>

          <div className="space-y-3">
            {judgeQa.map((item, idx) => {
              const isExpanded = expandedQa === idx;
              return (
                <div
                  key={idx}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setExpandedQa(isExpanded ? null : idx)}
                    className="w-full text-left p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3">
                      <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="text-sm font-semibold text-white">"{item.q}"</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 text-xs text-slate-300 leading-relaxed font-mono">
                      <div className="text-cyan-400 uppercase text-[10px] mb-1 font-bold">Defense Statement:</div>
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
