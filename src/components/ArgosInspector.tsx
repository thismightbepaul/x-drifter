import React, { useState, useMemo } from 'react';
import { Radio, Download, Copy, Check, Filter, Layers, ArrowRight, ShieldCheck, Terminal } from 'lucide-react';
import { ArgosCodec, UNIT_ID_DEFAULT } from '../services/argosCodec';
import { ArgosFrame, SensorReadings, AutonomousState, DegradationTier, ProfileBin } from '../types/drifter';

export const ArgosInspector: React.FC = () => {
  const [selectedType, setSelectedType] = useState<'STATUS' | 'PROFILE_1' | 'PROFILE_2' | 'ALERT'>('STATUS');
  const [selectedByteIndex, setSelectedByteIndex] = useState<number | null>(0);
  const [copied, setCopied] = useState<boolean>(false);

  // Status message editable parameters
  const [lat, setLat] = useState<number>(-62.45);
  const [lon, setLon] = useState<number>(58.32);
  const [sst, setSst] = useState<number>(-1.24);
  const [airTemp, setAirTemp] = useState<number>(-8.60);
  const [pressure, setPressure] = useState<number>(982.4);
  const [humidity, setHumidity] = useState<number>(88);
  const [waveHeight, setWaveHeight] = useState<number>(2.4);
  const [wavePeriod, setWavePeriod] = useState<number>(7.8);
  const [energyUsedWh, setEnergyUsedWh] = useState<number>(64.82);
  const [state, setState] = useState<AutonomousState>('NORMAL');
  const [seqNo, setSeqNo] = useState<number>(42);

  // Generate simulated 10-level CTD profile data
  const sampleBins: ProfileBin[] = useMemo(() => {
    return Array.from({ length: 10 }).map((_, i) => ({
      depth: i + 1,
      tempDown: Number((-0.8 - i * 0.12).toFixed(2)),
      salinityDown: Number((33.2 + i * 0.1).toFixed(2)),
      tempUp: Number((-0.8 - i * 0.12 + 0.02).toFixed(2)),
      salinityUp: Number((33.2 + i * 0.1 + 0.03).toFixed(2)),
      qcFlag: i === 0 ? 2 : 1
    }));
  }, []);

  // Encode the frame into 31 bytes
  const encodedFrame: ArgosFrame = useMemo(() => {
    const sensors: SensorReadings = {
      timestamp: 1790691500, // Unix timestamp in seconds
      latitude: lat,
      longitude: lon,
      sst,
      airTemp,
      humidity,
      pressure,
      waveHeight,
      wavePeriod,
      tetherTension: 45.2,
      internalTemp: 2.5,
      internalHumidity: 32,
      waterlineWet: true,
      antennaWet: false,
      drogueAttached: true,
      winchFault: false
    };

    if (selectedType === 'STATUS') {
      return ArgosCodec.packStatus(UNIT_ID_DEFAULT, seqNo, sensors, state, 'Full', energyUsedWh);
    } else if (selectedType === 'PROFILE_1') {
      return ArgosCodec.packProfilePart(1, UNIT_ID_DEFAULT, seqNo, sensors.timestamp, sampleBins, 14);
    } else if (selectedType === 'PROFILE_2') {
      return ArgosCodec.packProfilePart(2, UNIT_ID_DEFAULT, seqNo, sensors.timestamp, sampleBins, 14);
    } else {
      return ArgosCodec.packAlert(UNIT_ID_DEFAULT, seqNo, sensors.timestamp, 1, 'IMPACT_HIGH_G', lat, lon, 3.8);
    }
  }, [selectedType, lat, lon, sst, airTemp, pressure, humidity, waveHeight, wavePeriod, energyUsedWh, state, seqNo, sampleBins]);

  // Decode the raw 31 bytes back using the ground decoder
  const decodedRecord = useMemo(() => {
    try {
      return ArgosCodec.decodeFrame(encodedFrame.rawBytes);
    } catch (e: any) {
      return { error: e.message };
    }
  }, [encodedFrame]);

  // Byte definition map for Status message
  const byteAnnotations: Record<number, { field: string; desc: string; formula: string }> = {
    0: { field: 'Message Type', desc: '0x01 = STATUS, 0x02 = PROFILE_1, 0x03 = PROFILE_2, 0x04 = ALERT', formula: 'Fixed uint8 ID' },
    1: { field: 'Unit ID [MSB]', desc: 'Argos 24-bit transmitter PTT address', formula: 'PTT >> 16' },
    2: { field: 'Unit ID [MID]', desc: 'Argos 24-bit transmitter PTT address', formula: '(PTT >> 8) & 0xFF' },
    3: { field: 'Unit ID [LSB]', desc: 'Argos 24-bit transmitter PTT address', formula: 'PTT & 0xFF' },
    4: { field: 'Sequence Counter', desc: 'Rolling 8-bit counter for ground deduplication', formula: '0 to 255' },
    5: { field: 'Timestamp [B0]', desc: 'Epoch seconds MSB (Big Endian uint32)', formula: 'Unix Time' },
    6: { field: 'Timestamp [B1]', desc: 'Epoch seconds byte 1', formula: 'Unix Time' },
    7: { field: 'Timestamp [B2]', desc: 'Epoch seconds byte 2', formula: 'Unix Time' },
    8: { field: 'Timestamp [B3]', desc: 'Epoch seconds LSB', formula: 'Unix Time' },
    9: { field: 'Latitude [MSB]', desc: 'Geodetic Latitude scaled by 100 (int16)', formula: 'Deg * 100' },
    10: { field: 'Latitude [LSB]', desc: 'Latitude lower byte', formula: 'Deg * 100' },
    11: { field: 'Longitude [MSB]', desc: 'Geodetic Longitude scaled by 100 (int16)', formula: 'Deg * 100' },
    12: { field: 'Longitude [LSB]', desc: 'Longitude lower byte', formula: 'Deg * 100' },
    13: { field: 'SST [MSB]', desc: 'Sea Surface Temp (°C * 100, int16)', formula: '°C * 100' },
    14: { field: 'SST [LSB]', desc: 'Sea Surface Temp lower byte', formula: '°C * 100' },
    15: { field: 'Air Temp [MSB]', desc: 'Mast Air Temp (°C * 100, int16)', formula: '°C * 100' },
    16: { field: 'Air Temp [LSB]', desc: 'Mast Air Temp lower byte', formula: '°C * 100' },
    17: { field: 'Air Humidity', desc: 'Relative Humidity percentage (uint8)', formula: '0..100 %' },
    18: { field: 'Pressure [MSB]', desc: 'Barometric pressure offset (hPa * 10 - 8000)', formula: '(hPa*10)-8000' },
    19: { field: 'Pressure [LSB]', desc: 'Barometric pressure lower byte', formula: '(hPa*10)-8000' },
    20: { field: 'Wave Height', desc: 'Significant wave height (cm / 5)', formula: 'cm / 5' },
    21: { field: 'Wave Period', desc: 'Dominant wave period (s * 10)', formula: 's * 10' },
    22: { field: 'Wh Used [MSB]', desc: 'Shunt measured ledger accumulated (Wh * 100)', formula: 'Wh * 100' },
    23: { field: 'Wh Used [LSB]', desc: 'Shunt measured ledger lower byte', formula: 'Wh * 100' },
    24: { field: 'Autonomous State', desc: 'State machine enum (0..5)', formula: 'NORMAL..ON_FLOE' },
    25: { field: 'Status Flags', desc: 'Bitfield: drogue, wet pads, winch jam, tier', formula: 'Bit 0..7 flags' },
    26: { field: 'Bay Temp', desc: 'Internal electronics bay temp (°C + 128)', formula: '°C + 128' },
    27: { field: 'Bay Humidity', desc: 'Internal electronics bay RH %', formula: 'Leak warning' },
    28: { field: 'Diagnostic', desc: 'Reserved diagnostic code', formula: 'Fixed 0xAA' },
    29: { field: 'CRC-16 [MSB]', desc: 'CRC-16 CCITT over bytes 0..28', formula: 'Polynomial 0x1021' },
    30: { field: 'CRC-16 [LSB]', desc: 'CRC-16 CCITT checksum lower byte', formula: 'Polynomial 0x1021' }
  };

  const activeByteMeta = selectedByteIndex !== null ? byteAnnotations[selectedByteIndex] : null;

  const handleCopyHex = () => {
    navigator.clipboard.writeText(encodedFrame.hexString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export to NCPOR/INCOIS JSON format
  const handleExportNCPOR = () => {
    const ncporRecord = {
      project: "SIH 2026 PS 26065",
      organisation: "Ministry of Earth Sciences / NCPOR / INCOIS",
      platform: "X-Drifter Autonomous Upper-Ocean Profiler",
      unit_id: `0x${UNIT_ID_DEFAULT.toString(16).toUpperCase()}`,
      transmission: {
        raw_hex: encodedFrame.hexString,
        byte_length: 31,
        satellite_channel: "Kinéis ARGOS-4 / Oceansat-3",
        frequency_mhz: 401.65
      },
      decoded_telemetry: decodedRecord,
      profile_data_10m: sampleBins
    };

    const blob = new Blob([JSON.stringify(ncporRecord, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NCPOR_X_DRIFTER_TELEMETRY_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: One-Way Argos Constraints & Message Architecture */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Argos / Kinéis KIM1 31-Byte Codec Suite</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Argos-4 / Oceansat-3 Compatible
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Strict 31-byte frame payload, 400 bps one-way transmission, CRC-16 CCITT, and ground station deduplication pipeline.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportNCPOR}
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export NCPOR/INCOIS Record</span>
            </button>
          </div>
        </div>

        {/* Message Type Selector Tabs */}
        <div className="flex items-center gap-2 mt-5 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono">
          {(['STATUS', 'PROFILE_1', 'PROFILE_2', 'ALERT'] as const).map(t => (
            <button
              key={t}
              onClick={() => {
                setSelectedType(t);
                setSelectedByteIndex(0);
              }}
              className={`flex-1 py-1.5 rounded transition-colors cursor-pointer ${
                selectedType === t
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'STATUS' && 'STATUS (0x01)'}
              {t === 'PROFILE_1' && 'PROFILE PART 1 (0x02, 1-5m)'}
              {t === 'PROFILE_2' && 'PROFILE PART 2 (0x03, 6-10m)'}
              {t === 'ALERT' && 'CRITICAL ALERT (0x04)'}
            </button>
          ))}
        </div>
      </div>

      {/* Raw 31-Byte Hex Dump & Interactive Byte Inspector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
              Raw 31-Byte Binary Frame (Bit-Level Layout)
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Kinéis KIM1 Payload · Length: {encodedFrame.rawBytes.length} bytes (248 bits)
            </span>
          </div>

          <button
            onClick={handleCopyHex}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Hex'}</span>
          </button>
        </div>

        {/* 31 Hex Bytes Interactive Grid */}
        <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 mt-4">
          {Array.from(encodedFrame.rawBytes).map((b, idx) => {
            const isSelected = selectedByteIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedByteIndex(idx)}
                className={`flex flex-col items-center justify-center p-2 rounded border font-mono transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg scale-105 z-10'
                    : idx === 0
                    ? 'bg-purple-950/40 border-purple-500/40 text-purple-300 hover:border-purple-400'
                    : idx >= 1 && idx <= 3
                    ? 'bg-blue-950/40 border-blue-500/40 text-blue-300 hover:border-blue-400'
                    : idx >= 29
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:border-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="text-[9px] opacity-60">[{idx}]</span>
                <span className="text-xs font-bold">{b.toString(16).padStart(2, '0').toUpperCase()}</span>
              </button>
            );
          })}
        </div>

        {/* Active Selected Byte Detailed Annotation */}
        {activeByteMeta && (
          <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono gap-2">
            <div>
              <span className="text-cyan-400 font-bold">Byte [{selectedByteIndex}]: {activeByteMeta.field}</span>
              <p className="text-slate-400 text-[11px] mt-0.5">{activeByteMeta.desc}</p>
            </div>
            <div className="text-slate-300 text-right sm:border-l sm:border-slate-800 sm:pl-4">
              <span className="text-slate-500 text-[10px] block">Encoding Formula:</span>
              <span className="text-amber-400">{activeByteMeta.formula}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Grid: Ground Station Decoded Pipeline & Live Parameter Adjuster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Real-Time Parameter Injector */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Live Frame Input Simulator
            </h3>
            <p className="text-xs text-slate-400">Modify values to verify on-the-fly binary packing</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">Latitude (°N)</label>
              <input
                type="number"
                step="0.01"
                value={lat}
                onChange={e => setLat(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Longitude (°E)</label>
              <input
                type="number"
                step="0.01"
                value={lon}
                onChange={e => setLon(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">SST (°C)</label>
              <input
                type="number"
                step="0.01"
                value={sst}
                onChange={e => setSst(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Barometer (hPa)</label>
              <input
                type="number"
                step="0.1"
                value={pressure}
                onChange={e => setPressure(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Wave Height (m)</label>
              <input
                type="number"
                step="0.1"
                value={waveHeight}
                onChange={e => setWaveHeight(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Energy Wh Used</label>
              <input
                type="number"
                step="0.1"
                value={energyUsedWh}
                onChange={e => setEnergyUsedWh(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-amber-400"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <label className="text-xs font-mono text-slate-400 block mb-1">Autonomous State Enum</label>
            <select
              value={state}
              onChange={e => setState(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-white"
            >
              <option value="NORMAL">NORMAL (0x00)</option>
              <option value="STORM">STORM (0x01)</option>
              <option value="CALM">CALM (0x02)</option>
              <option value="ICE_APPROACH">ICE_APPROACH (0x03)</option>
              <option value="ICE">ICE (0x04)</option>
              <option value="ON_FLOE">ON_FLOE (0x05)</option>
            </select>
          </div>
        </div>

        {/* Right Column: Ground Station Python Decoder Output */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
                Ground Decoder Output (<code className="text-cyan-400">decode.py</code>)
              </h3>
              <p className="text-xs text-slate-500">Unpacks 31 bytes, verifies CRC-16 CCITT, deduplicates</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>CRC-16 OK</span>
            </span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-80">
            <pre className="text-slate-300 leading-relaxed">
              {JSON.stringify(decodedRecord, null, 2)}
            </pre>
          </div>

          <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800 flex items-center justify-between">
            <span>Deduplication: Sequence #{seqNo}</span>
            <span className="text-cyan-400">Ground Server: NCPOR Goa / INCOIS Hyderabad</span>
          </div>

        </div>

      </div>

    </div>
  );
};
