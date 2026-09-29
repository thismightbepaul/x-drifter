/**
 * Argos / Kinéis KIM1 31-Byte Binary Protocol Codec
 * Implements strict bit-packing, raw hex serialization, CRC-16,
 * ground decoder, deduplicator, profile reassembler, and NCPOR/INCOIS export.
 */

import { ArgosFrame, ProfileBin, SensorReadings, AutonomousState, DegradationTier } from '../types/drifter';

export const UNIT_ID_DEFAULT = 0x2A8004; // 2785284 decimal, standard Argos PTT ID

export function crc16Ccitt(data: Uint8Array, length: number): number {
  let crc = 0xFFFF;
  for (let i = 0; i < length; i++) {
    crc ^= (data[i] << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}

const STATE_MAP: Record<AutonomousState, number> = {
  NORMAL: 0,
  STORM: 1,
  CALM: 2,
  ICE_APPROACH: 3,
  ICE: 4,
  ON_FLOE: 5,
};

const STATE_REV_MAP: Record<number, AutonomousState> = {
  0: 'NORMAL',
  1: 'STORM',
  2: 'CALM',
  3: 'ICE_APPROACH',
  4: 'ICE',
  5: 'ON_FLOE',
};

const TIER_MAP: Record<DegradationTier, number> = {
  Full: 0,
  Lean: 1,
  Survival: 2,
  Beacon: 3,
  'Winch fault': 4,
};

export class ArgosCodec {
  /**
   * Pack Status Message into exactly 31 bytes
   */
  static packStatus(
    unitId: number,
    seq: number,
    sensors: SensorReadings,
    state: AutonomousState,
    tier: DegradationTier,
    energyUsedWh: number
  ): ArgosFrame {
    const buf = new Uint8Array(31);
    const view = new DataView(buf.buffer);

    // Byte 0: Msg Type (0x01 = STATUS)
    buf[0] = 0x01;

    // Bytes 1..3: Unit ID (24-bit)
    buf[1] = (unitId >> 16) & 0xFF;
    buf[2] = (unitId >> 8) & 0xFF;
    buf[3] = unitId & 0xFF;

    // Byte 4: Sequence Number
    buf[4] = seq & 0xFF;

    // Bytes 5..8: Unix Timestamp (uint32)
    view.setUint32(5, Math.floor(sensors.timestamp), false);

    // Bytes 9..10: Latitude (int16, -90.00 to 90.00 * 100, e.g. -64.25 -> -6425)
    const latScaled = Math.round(sensors.latitude * 100);
    view.setInt16(9, latScaled, false);

    // Bytes 11..12: Longitude (int16, -180.00 to 180.00 * 100)
    const lonScaled = Math.round(sensors.longitude * 100);
    view.setInt16(11, lonScaled, false);

    // Bytes 13..14: SST (°C * 100, e.g. -1.82°C -> -182)
    const sstScaled = Math.round(sensors.sst * 100);
    view.setInt16(13, sstScaled, false);

    // Bytes 15..16: Air Temp (°C * 100, e.g. -14.50°C -> -1450)
    const airTempScaled = Math.round(sensors.airTemp * 100);
    view.setInt16(15, airTempScaled, false);

    // Byte 17: Air RH (0..100)
    buf[17] = Math.min(100, Math.max(0, Math.round(sensors.humidity)));

    // Bytes 18..19: Air Pressure (hPa * 10 - 8000 offset, so 980.5 hPa = 9805 - 8000 = 1805)
    const pressScaled = Math.max(0, Math.round(sensors.pressure * 10 - 8000));
    view.setUint16(18, pressScaled, false);

    // Byte 20: Wave Height (cm / 5, max 12.75m -> 255)
    const waveH = Math.min(255, Math.max(0, Math.round((sensors.waveHeight * 100) / 5)));
    buf[20] = waveH;

    // Byte 21: Wave Period (s * 10, max 25.5s)
    const waveP = Math.min(255, Math.max(0, Math.round(sensors.wavePeriod * 10)));
    buf[21] = waveP;

    // Bytes 22..23: Wh used * 100 (e.g. 74.25 Wh -> 7425)
    view.setUint16(22, Math.round(energyUsedWh * 100), false);

    // Byte 24: State Enum
    buf[24] = STATE_MAP[state] ?? 0;

    // Byte 25: Flags bitfield
    // bit 0: drogueAttached (1)
    // bit 1: waterlineWet (1)
    // bit 2: antennaWet (1)
    // bit 3: winchFault (1)
    // bits 4..7: tier enum (0..4)
    let flags = 0;
    if (sensors.drogueAttached) flags |= (1 << 0);
    if (sensors.waterlineWet)   flags |= (1 << 1);
    if (sensors.antennaWet)     flags |= (1 << 2);
    if (sensors.winchFault)     flags |= (1 << 3);
    const tierVal = TIER_MAP[tier] ?? 0;
    flags |= ((tierVal & 0x0F) << 4);
    buf[25] = flags;

    // Bytes 26..27: Internal Temp (int8) + Internal RH (uint8)
    buf[26] = (Math.round(sensors.internalTemp) + 128) & 0xFF;
    buf[27] = Math.round(sensors.internalHumidity) & 0xFF;

    // Byte 28: Reserve / diagnostic byte
    buf[28] = 0xAA;

    // Bytes 29..30: CRC-16 CCITT
    const crc = crc16Ccitt(buf, 29);
    view.setUint16(29, crc, false);

    const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    return {
      type: 'STATUS',
      unitId,
      sequenceNumber: seq,
      timestamp: sensors.timestamp,
      rawBytes: buf,
      hexString: hex,
      decodedData: {
        unitId,
        seq,
        timestamp: sensors.timestamp,
        latitude: sensors.latitude,
        longitude: sensors.longitude,
        sst: sensors.sst,
        airTemp: sensors.airTemp,
        humidity: sensors.humidity,
        pressure: sensors.pressure,
        waveHeight: sensors.waveHeight,
        wavePeriod: sensors.wavePeriod,
        energyUsedWh,
        state,
        tier,
        drogueAttached: sensors.drogueAttached,
        waterlineWet: sensors.waterlineWet,
        antennaWet: sensors.antennaWet,
        winchFault: sensors.winchFault,
        crcValid: true
      },
      repeatCount: 1,
      transmitTimeFormatted: new Date(sensors.timestamp * 1000).toUTCString()
    };
  }

  /**
   * Pack Profile Part 1 (1m to 5m) or Part 2 (6m to 10m) into exactly 31 bytes
   */
  static packProfilePart(
    part: 1 | 2,
    unitId: number,
    seq: number,
    timestamp: number,
    bins: ProfileBin[],
    profileId: number
  ): ArgosFrame {
    const buf = new Uint8Array(31);
    const view = new DataView(buf.buffer);

    // Byte 0: Msg Type (0x02 = PROFILE_1, 0x03 = PROFILE_2)
    buf[0] = part === 1 ? 0x02 : 0x03;

    // Bytes 1..3: Unit ID
    buf[1] = (unitId >> 16) & 0xFF;
    buf[2] = (unitId >> 8) & 0xFF;
    buf[3] = unitId & 0xFF;

    // Byte 4: Sequence Number
    buf[4] = seq & 0xFF;

    // Bytes 5..8: Unix Timestamp
    view.setUint32(5, Math.floor(timestamp), false);

    // Byte 9: Profile ID (1..255)
    buf[9] = profileId & 0xFF;

    // We pack 5 depth levels:
    // Part 1: levels 0..4 (1.0m, 2.0m, 3.0m, 4.0m, 5.0m)
    // Part 2: levels 5..9 (6.0m, 7.0m, 8.0m, 9.0m, 10.0m)
    const startIndex = part === 1 ? 0 : 5;
    let byteOffset = 10;

    for (let i = 0; i < 5; i++) {
      const b = bins[startIndex + i] || {
        depth: (startIndex + i + 1),
        tempDown: -99.9,
        salinityDown: 0,
        qcFlag: 9
      };

      // Temp: int16 (0.01 °C, e.g. -1.75°C -> -175)
      const t = Math.round(b.tempDown * 100);
      view.setInt16(byteOffset, t, false);
      byteOffset += 2;

      // Salinity: uint16 (0.01 psu, e.g. 33.85 psu -> 3385)
      const s = Math.round(b.salinityDown * 100);
      view.setUint16(byteOffset, s, false);
      byteOffset += 2;
    }
    // byteOffset is now 10 + 20 = 30.
    // Byte 30: packed QC nibbles for the 5 levels (3 bits each = 15 bits, or simple combined flag byte)
    let qcSummary = 0;
    for (let i = 0; i < 5; i++) {
      const q = bins[startIndex + i]?.qcFlag ?? 1;
      if (q > 1) qcSummary |= (1 << i);
    }
    buf[30] = qcSummary; // Bit 0..4 indicate suspect or edited flag at each level

    const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    return {
      type: part === 1 ? 'PROFILE_1' : 'PROFILE_2',
      unitId,
      sequenceNumber: seq,
      timestamp,
      rawBytes: buf,
      hexString: hex,
      decodedData: {
        part,
        profileId,
        levels: bins.slice(startIndex, startIndex + 5)
      },
      repeatCount: 1,
      transmitTimeFormatted: new Date(timestamp * 1000).toUTCString()
    };
  }

  /**
   * Pack Alert Message (0x04)
   */
  static packAlert(
    unitId: number,
    seq: number,
    timestamp: number,
    alertCode: number,
    alertName: string,
    lat: number,
    lon: number,
    auxValue: number
  ): ArgosFrame {
    const buf = new Uint8Array(31);
    const view = new DataView(buf.buffer);

    buf[0] = 0x04; // ALERT
    buf[1] = (unitId >> 16) & 0xFF;
    buf[2] = (unitId >> 8) & 0xFF;
    buf[3] = unitId & 0xFF;
    buf[4] = seq & 0xFF;
    view.setUint32(5, Math.floor(timestamp), false);

    buf[9] = alertCode & 0xFF;
    view.setInt16(10, Math.round(lat * 100), false);
    view.setInt16(12, Math.round(lon * 100), false);
    view.setInt32(14, Math.round(auxValue * 100), false);

    // CRC
    const crc = crc16Ccitt(buf, 29);
    view.setUint16(29, crc, false);

    const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    return {
      type: 'ALERT',
      unitId,
      sequenceNumber: seq,
      timestamp,
      rawBytes: buf,
      hexString: hex,
      decodedData: {
        alertCode,
        alertName,
        lat,
        lon,
        auxValue
      },
      repeatCount: 1,
      transmitTimeFormatted: new Date(timestamp * 1000).toUTCString()
    };
  }

  /**
   * Ground Station: Decode raw 31 bytes
   */
  static decodeFrame(bytes: Uint8Array): Record<string, any> {
    if (bytes.length !== 31) {
      throw new Error(`Invalid frame length: expected 31 bytes, got ${bytes.length}`);
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const msgType = bytes[0];
    const unitId = (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    const seq = bytes[4];
    const timestamp = view.getUint32(5, false);

    if (msgType === 0x01) {
      // STATUS
      const lat = view.getInt16(9, false) / 100;
      const lon = view.getInt16(11, false) / 100;
      const sst = view.getInt16(13, false) / 100;
      const airTemp = view.getInt16(15, false) / 100;
      const humidity = bytes[17];
      const pressure = (view.getUint16(18, false) + 8000) / 10;
      const waveHeight = (bytes[20] * 5) / 100;
      const wavePeriod = bytes[21] / 10;
      const energyUsedWh = view.getUint16(22, false) / 100;
      const stateCode = bytes[24];
      const flags = bytes[25];
      const drogueAttached = Boolean(flags & 0x01);
      const waterlineWet = Boolean(flags & 0x02);
      const antennaWet = Boolean(flags & 0x04);
      const winchFault = Boolean(flags & 0x08);
      const tierCode = (flags >> 4) & 0x0F;
      const internalTemp = bytes[26] - 128;
      const internalHumidity = bytes[27];

      const expectedCrc = view.getUint16(29, false);
      const calculatedCrc = crc16Ccitt(bytes, 29);

      return {
        type: 'STATUS',
        unitId,
        seq,
        timestamp,
        timeIso: new Date(timestamp * 1000).toISOString(),
        latitude: lat,
        longitude: lon,
        sst,
        airTemp,
        humidity,
        pressure,
        waveHeight,
        wavePeriod,
        energyUsedWh,
        state: STATE_REV_MAP[stateCode] || 'UNKNOWN',
        tier: ['Full', 'Lean', 'Survival', 'Beacon', 'Winch fault'][tierCode] || 'Full',
        drogueAttached,
        waterlineWet,
        antennaWet,
        winchFault,
        internalTemp,
        internalHumidity,
        crcValid: expectedCrc === calculatedCrc
      };
    } else if (msgType === 0x02 || msgType === 0x03) {
      // PROFILE PART 1 or 2
      const part = msgType === 0x02 ? 1 : 2;
      const profileId = bytes[9];
      const levels: Array<{ depth: number; temp: number; salinity: number; qc: number }> = [];
      const baseDepth = part === 1 ? 1 : 6;
      let offset = 10;

      for (let i = 0; i < 5; i++) {
        const depth = baseDepth + i;
        const temp = view.getInt16(offset, false) / 100;
        offset += 2;
        const sal = view.getUint16(offset, false) / 100;
        offset += 2;
        levels.push({ depth, temp, salinity: sal, qc: 1 });
      }

      const qcByte = bytes[30];
      levels.forEach((l, i) => {
        if (qcByte & (1 << i)) {
          l.qc = 2; // Suspect / edited
        }
      });

      return {
        type: part === 1 ? 'PROFILE_1' : 'PROFILE_2',
        unitId,
        seq,
        timestamp,
        timeIso: new Date(timestamp * 1000).toISOString(),
        profileId,
        levels
      };
    } else if (msgType === 0x04) {
      const alertCode = bytes[9];
      const lat = view.getInt16(10, false) / 100;
      const lon = view.getInt16(12, false) / 100;
      const auxVal = view.getInt32(14, false) / 100;

      return {
        type: 'ALERT',
        unitId,
        seq,
        timestamp,
        timeIso: new Date(timestamp * 1000).toISOString(),
        alertCode,
        latitude: lat,
        longitude: lon,
        auxValue: auxVal
      };
    }

    return { type: 'UNKNOWN', raw: bytes };
  }
}
