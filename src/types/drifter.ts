/**
 * X Drifter Master Design (v3) - SIH 2026 PS 26065
 * Ministry of Earth Sciences / NCPOR
 * Type definitions for MCU Firmware, Autonomous Logic, Telemetry, and Energy Ledger.
 */

export type AutonomousState =
  | 'NORMAL'
  | 'STORM'
  | 'CALM'
  | 'ICE_APPROACH'
  | 'ICE'
  | 'ON_FLOE';

export type DegradationTier =
  | 'Full'
  | 'Lean'
  | 'Survival'
  | 'Beacon'
  | 'Winch fault';

export type AlertEventCode =
  | 'IMPACT_HIGH_G'
  | 'DROGUE_LOST'
  | 'ICE_SNAG_TENSION_SPIKE'
  | 'WINCH_STALL_JAM'
  | 'HULL_LEAK_HUMIDITY'
  | 'ENERGY_CRITICAL_SURVIVAL'
  | 'ANOMALY_SALINITY_STEP'
  | 'ANOMALY_TEMP_STEP'
  | 'COLD_LOCK_KIM1';

export interface SensorReadings {
  timestamp: number; // Unix seconds
  latitude: number;  // Southern Ocean deg N (negative)
  longitude: number; // deg E
  sst: number;       // °C (TSYS01 at float base)
  airTemp: number;   // °C (SHT45 at mast)
  humidity: number;  // % RH
  pressure: number;  // hPa (BMP390)
  waveHeight: number;// m (IMU OpenMetBuoy FFT)
  wavePeriod: number;// s
  tetherTension: number; // N (Load cell)
  internalTemp: number; // °C (Electronics bay SHT45)
  internalHumidity: number; // % RH
  waterlineWet: boolean; // Capacitive pad 1 (TSC)
  antennaWet: boolean;   // Capacitive pad 2 (TSC)
  drogueAttached: boolean;
  winchFault: boolean;
}

export interface ProfileBin {
  depth: number;      // 0.5m to 10.0m
  tempDown: number;   // °C (Science descent)
  salinityDown: number; // psu (Science descent)
  tempUp?: number;    // °C (Recovery QC)
  salinityUp?: number;// psu (Recovery QC)
  qcFlag: number;     // 1 = Good, 2 = Suspect (top 0.5m), 3 = Loop-edited, 4 = Mismatch, 9 = Missing
}

export interface CastSample {
  timeMs: number;
  depthM: number;
  cableOutM: number;
  slackM: number;
  temp: number;
  salinity: number;
  motorCurrentMa: number;
  isDescent: boolean;
  loopEdited: boolean;
}

export interface ArgosFrame {
  type: 'STATUS' | 'PROFILE_1' | 'PROFILE_2' | 'ALERT';
  unitId: number;       // 24-bit Argos transmitter ID (e.g. 0x2A8004)
  sequenceNumber: number; // 8-bit wrap 0-255
  timestamp: number;    // 32-bit epoch
  rawBytes: Uint8Array; // Exactly 31 bytes
  hexString: string;
  decodedData: Record<string, any>;
  repeatCount: number;
  transmitTimeFormatted: string;
}

export interface EnergyLedgerDay {
  day: number;
  baselineWh: number;     // 0.687 Wh/day cumulative (124 Wh at day 180)
  allowedWh: number;      // (180 - 15) * day / 180 = 0.917 Wh/day
  actualUsedWh: number;   // Simulated or measured ledger
  reserveWh: number;      // 15 Wh
  tier: DegradationTier;
  extraProfilesRun: number;
  calmDaysSkipped: number;
  stormDaysDeferred: number;
  iceDaysDeferred: number;
}

export interface ProblemFixItem {
  id: number;
  category: 'Satellite & Location' | 'Power & Energy' | 'Winch & Mechanics' | 'Probe & Data Quality' | 'Cold, Heat & Hull' | 'Logic & Firmware';
  problem: string;
  fix: string;
  status: 'DONE' | 'FIXED v3' | 'NEW v3' | 'OPEN' | 'SIZE' | 'TORQUE' | 'RATIO CALC' | 'CAP SIZE';
}

export interface BomItem {
  block: string;
  subsystem: string;
  part: string;
  supplierOrigin: 'India' | 'Imported (USA/France/Switzerland)';
  purpose: string;
  approxCostInr: number;
  status: 'PROTOTYPE TESTED' | 'BUILT' | 'ADD-HW' | 'NEW v3';
}

export interface SlideItem {
  slideNumber: number;
  title: string;
  keyPoints: string[];
  referenceSection: string;
  defenseFocus: string;
}
