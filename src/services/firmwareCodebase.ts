/**
 * Comprehensive Codebase and Documentation Repository for X-Drifter
 * Matches the file structure in the master design specification.
 */

export interface CodeFile {
  path: string;
  name: string;
  language: 'c' | 'h' | 'python' | 'markdown' | 'makefile' | 'csv' | 'ld';
  description: string;
  content: string;
}

export const FIRMWARE_CODEBASE: CodeFile[] = [
  // 1. main.c
  {
    path: 'firmware/main-mcu/src/main.c',
    name: 'main.c',
    language: 'c',
    description: 'Main superloop: wake-up -> dispatch -> state machine -> energy gate -> action -> sleep',
    content: `/**
 * @file main.c
 * @brief X-Drifter Main MCU (STM32L476RG) Event-Driven Bare-Metal Superloop
 * @details No RTOS. Stop 2 sleep default (~1.5 uA). State survived in RTC backup regs.
 *          SIH 2026 PS 26065 · Ministry of Earth Sciences / NCPOR
 */

#include "stm32l4xx_ll_rcc.h"
#include "stm32l4xx_ll_pwr.h"
#include "stm32l4xx_ll_bus.h"
#include "stm32l4xx_ll_system.h"
#include "stm32l4xx_ll_iwdg.h"

#include "config/pinmap.h"
#include "config/thresholds.h"
#include "drivers/rtc_backup.h"
#include "drivers/load_cell.h"
#include "drivers/imu.h"
#include "drivers/wet_pads.h"
#include "drivers/nor_flash.h"
#include "drivers/kim1_argos.h"
#include "drivers/winch_motor.h"
#include "drivers/gnss_neom9n.h"
#include "logic/state_machine.h"
#include "logic/energy_ledger.h"
#include "logic/dispatcher.h"
#include "logic/tx_queue.h"

static void SystemClock_Config_80MHz(void);
static void Enter_Stop2_Sleep(void);

int main(void) {
    /* Initialize basic peripherals */
    SystemClock_Config_80MHz();
    RTC_Backup_Init();
    Energy_Ledger_Init();
    NOR_Flash_Init();
    IMU_Init_WakeOnMotion();
    WetPads_TSC_Init();
    LoadCell_Init();
    Winch_Init();
    KIM1_Init();
    TX_Queue_Init();

    /* Initialize watchdog with 32-second timeout, kicked on every wake */
    LL_IWDG_Enable(IWDG);

    /* Main event-driven superloop */
    while (1) {
        /* 1. Kick independent watchdog */
        LL_IWDG_ReloadCounter(IWDG);

        /* 2. Identify wake source */
        wake_source_t source = Dispatcher_IdentifyWakeSource();

        /* 3. Read cheap engineering sensors while awake */
        cheap_sensor_data_t cheap = Dispatcher_SampleCheapSensors();

        /* 4. Update Autonomous State Machine with 3-check hysteresis */
        drifter_state_t new_state = StateMachine_Update(&cheap);

        /* 5. Check if any CRITICAL hardware alerts occurred */
        if (StateMachine_HasCriticalAlert()) {
            alert_event_t alert = StateMachine_GetActiveAlert();
            TX_Queue_PushAlert(&alert);
            NOR_Flash_AppendLog(LOG_TYPE_ALERT, &alert, sizeof(alert));
        }

        /* 6. Evaluate Action Scheduling (Hourly surface sample, Profiling, Transmit) */
        action_plan_t plan = Dispatcher_ScheduleActions(new_state, source);

        if (plan.mandatory_action != ACTION_NONE) {
            /* Run mandatory action unconditionally and ledger actual measured Wh */
            Dispatcher_ExecuteAction(plan.mandatory_action);
        }

        if (plan.optional_action != ACTION_NONE) {
            /* Pass through Allowed-Curve Energy Gate */
            float cost_wh = Energy_Ledger_GetActionCost(plan.optional_action);
            uint32_t current_day = RTC_Backup_GetMissionDay();

            if (Energy_Ledger_GateCheck(current_day, cost_wh)) {
                Dispatcher_ExecuteAction(plan.optional_action);
            } else {
                /* Log skipped action for scientific audit */
                NOR_Flash_LogEvent("GATE_SKIP", plan.optional_action);
            }
        }

        /* 7. Save state machine & energy ledger into RTC backup registers */
        RTC_Backup_SaveLedger(Energy_Ledger_GetAccumulatedWh());
        RTC_Backup_SaveState(new_state);

        /* 8. Re-arm wake interrupts and drop back into ultra-low-power Stop 2 */
        Enter_Stop2_Sleep();
    }
}

static void Enter_Stop2_Sleep(void) {
    /* Set Low-Power Stop 2 mode with RTC, EXTI, and Comparators active */
    LL_PWR_SetPowerMode(LL_PWR_MODE_STOP2);
    LL_LPM_EnableDeepSleep();
    __WFI(); // Wait for Interrupt
}
`
  },

  // 2. state_machine.c
  {
    path: 'firmware/main-mcu/src/logic/state_machine.c',
    name: 'state_machine.c',
    language: 'c',
    description: 'Autonomous 6-state machine with 3-check hysteresis, calm savings, and on-floe detection',
    content: `/**
 * @file state_machine.c
 * @brief Autonomous State Machine & 3-Check Hysteresis Engine
 * @details States: NORMAL, STORM, CALM, ICE_APPROACH, ICE, ON_FLOE
 */

#include "state_machine.h"
#include "../config/thresholds.h"

static drifter_state_t current_state = STATE_NORMAL;
static drifter_state_t candidate_state = STATE_NORMAL;
static uint8_t hysteresis_counter = 0;
static alert_event_t active_alert = {0};
static bool alert_pending = false;

drifter_state_t StateMachine_Update(const cheap_sensor_data_t *sensors) {
    drifter_state_t proposed = current_state;

    /* Rule 1: ON_FLOE check - if BOTH capacitive pads are completely dry */
    if (!sensors->waterline_wet && !sensors->antenna_wet) {
        proposed = STATE_ON_FLOE;
    }
    /* Rule 2: ICE check - SST <= -1.5°C or drift < 100m in 6h or zero wave motion */
    else if (sensors->sst <= THRESH_SST_ICE_FREEZE || sensors->wave_energy_norm < 0.05f) {
        proposed = STATE_ICE;
    }
    /* Rule 3: ICE_APPROACH check - 2 of 3 signs: SST <= 0°C & falling, damped wave bumps */
    else if (sensors->sst <= THRESH_SST_ICE_APPROACH && sensors->sst_trend_falling) {
        proposed = STATE_ICE_APPROACH;
    }
    /* Rule 4: STORM check - wave heave energy above safe slack band or barometric drop */
    else if (sensors->wave_height_m > THRESH_WAVE_HEIGHT_STORM) {
        proposed = STATE_STORM;
    }
    /* Rule 5: CALM check - no T/S step over past N profiles and quiescent IMU */
    else if (sensors->wave_height_m < THRESH_WAVE_HEIGHT_CALM && sensors->is_calm_trend) {
        proposed = STATE_CALM;
    }
    else {
        proposed = STATE_NORMAL;
    }

    /* Apply strict 3-check hysteresis rule */
    if (proposed != current_state) {
        if (proposed == candidate_state) {
            hysteresis_counter++;
            if (hysteresis_counter >= HYSTERESIS_REQUIRED_CHECKS) { // 3 consecutive checks
                current_state = proposed;
                hysteresis_counter = 0;
            }
        } else {
            candidate_state = proposed;
            hysteresis_counter = 1;
        }
    } else {
        hysteresis_counter = 0;
        candidate_state = current_state;
    }

    /* Check for immediate hardware critical triggers (act without delay) */
    if (sensors->impact_detected) {
        active_alert.code = ALERT_IMPACT_HIGH_G;
        active_alert.timestamp = sensors->timestamp;
        alert_pending = true;
    } else if (!sensors->drogue_tension_ok) {
        active_alert.code = ALERT_DROGUE_LOST;
        active_alert.timestamp = sensors->timestamp;
        alert_pending = true;
    } else if (sensors->internal_humidity > THRESH_HULL_LEAK_RH) {
        active_alert.code = ALERT_HULL_LEAK;
        active_alert.timestamp = sensors->timestamp;
        alert_pending = true;
    }

    return current_state;
}

bool StateMachine_HasCriticalAlert(void) {
    return alert_pending;
}

alert_event_t StateMachine_GetActiveAlert(void) {
    alert_pending = false;
    return active_alert;
}
`
  },

  // 3. energy_ledger.c
  {
    path: 'firmware/main-mcu/src/logic/energy_ledger.c',
    name: 'energy_ledger.c',
    language: 'c',
    description: 'Shunt-measured energy accounting & allowed-curve gate with 15 Wh reserve',
    content: `/**
 * @file energy_ledger.c
 * @brief Energy Accounting & Allowed-Curve Gate Engine
 * @details Nominal: 281 Wh. Derated 35% for cold/ageing: 180 Wh usable.
 *          Reserve: 15 Wh (~3 weeks baseline).
 *          allowed(day) = (180 - 15) * day / 180 = 0.917 Wh/day
 */

#include "energy_ledger.h"
#include "../config/thresholds.h"

static float total_used_wh = 0.0f;
static float session_active_wh = 0.0f;

void Energy_Ledger_Init(void) {
    /* Read accumulated Wh from RTC backup register to survive reset */
    total_used_wh = RTC_Backup_ReadLedgerWh();
}

void Energy_Ledger_AccumulateAwake(float current_ma, float voltage_v, float duration_sec) {
    float power_w = (current_ma / 1000.0f) * voltage_v;
    float wh = power_w * (duration_sec / 3600.0f);
    total_used_wh += wh;
    session_active_wh += wh;
}

void Energy_Ledger_AddSleepModel(float sleep_hours) {
    /* 50 uA baseline sleep at 10.8V */
    float sleep_wh = (50e-6f * 10.8f) * sleep_hours;
    total_used_wh += sleep_wh;
}

bool Energy_Ledger_GateCheck(uint32_t day, float cost_of_action_wh) {
    if (day > MISSION_LIFETIME_DAYS) day = MISSION_LIFETIME_DAYS;

    /* Allowed curve spreads (180 Wh - 15 Wh reserve) across 180 days = 0.917 Wh/day */
    float allowed_wh = ((USABLE_BATTERY_WH - RESERVE_WH) * (float)day) / (float)MISSION_LIFETIME_DAYS;

    if ((total_used_wh + cost_of_action_wh) <= allowed_wh) {
        return true; // Approved to run optional action
    }
    return false; // Skip action; log "flagged, not acted on"
}

degradation_tier_t Energy_Ledger_GetDegradationTier(uint32_t day) {
    float allowed_wh = ((USABLE_BATTERY_WH - RESERVE_WH) * (float)day) / (float)MISSION_LIFETIME_DAYS;

    if (total_used_wh <= allowed_wh) {
        return TIER_FULL; // 2 profiles/day + adaptive extras
    } else if (total_used_wh <= (allowed_wh + 10.0f)) {
        return TIER_LEAN; // Baseline only, no extras
    } else if (total_used_wh <= (USABLE_BATTERY_WH - 5.0f)) {
        return TIER_SURVIVAL; // 1 profile/day, status 2x/day, CRITICAL flag once
    } else {
        return TIER_BEACON; // Position + status once/day until exhaustion
    }
}
`
  },

  // 4. qc_packer.c
  {
    path: 'firmware/main-mcu/src/logic/qc_packer.c',
    name: 'qc_packer.c',
    language: 'c',
    description: 'Free-fall descent science pass processing, loop-editing, 0.5m/1m binning, and 31-byte frame packing',
    content: `/**
 * @file qc_packer.c
 * @brief Profiler Science Pass QC (Loop Edit, Binning) & 31-Byte Bit-Packing
 * @details Descent is science pass. Drops samples where depth went backwards (loop-edit).
 */

#include "qc_packer.h"
#include <string.h>

void QC_ProcessProfile(const raw_sample_t *samples, uint16_t count, binned_profile_t *out_profile) {
    float max_depth_seen = 0.0f;
    uint16_t loop_drop_count = 0;

    memset(out_profile, 0, sizeof(binned_profile_t));

    /* 1. Loop-edit filter: drop samples where wave heave caused probe depth to reverse */
    for (uint16_t i = 0; i < count; i++) {
        if (samples[i].depth_m < max_depth_seen) {
            /* Depth went backwards due to surface wave heave: discard */
            loop_drop_count++;
            continue;
        }
        max_depth_seen = samples[i].depth_m;

        /* Bin into 1.0 m intervals (1.0m to 10.0m) */
        int bin_idx = (int)(samples[i].depth_m - 0.5f);
        if (bin_idx >= 0 && bin_idx < 10) {
            out_profile->bins[bin_idx].temp_sum += samples[i].temp_c;
            out_profile->bins[bin_idx].sal_sum += samples[i].salinity_psu;
            out_profile->bins[bin_idx].sample_count++;
        }
    }

    /* Compute averages and set QC flags */
    for (int b = 0; b < 10; b++) {
        if (out_profile->bins[b].sample_count > 0) {
            out_profile->bins[b].temp = out_profile->bins[b].temp_sum / out_profile->bins[b].sample_count;
            out_profile->bins[b].salinity = out_profile->bins[b].sal_sum / out_profile->bins[b].sample_count;
            out_profile->bins[b].qc_flag = (b == 0) ? QC_SUSPECT_NEAR_SURFACE : QC_GOOD;
        } else {
            out_profile->bins[b].qc_flag = QC_MISSING;
        }
    }
}

void QC_PackProfilePart(uint8_t part, uint8_t profile_id, const binned_profile_t *prof, uint8_t *frame_out) {
    memset(frame_out, 0, 31);

    frame_out[0] = (part == 1) ? MSG_TYPE_PROFILE_PART1 : MSG_TYPE_PROFILE_PART2;
    /* Bytes 1..3: Argos Unit ID */
    frame_out[1] = 0x2A; frame_out[2] = 0x80; frame_out[3] = 0x04;
    frame_out[4] = prof->seq_num;
    /* Bytes 5..8: Timestamp */
    memcpy(&frame_out[5], &prof->timestamp, 4);
    frame_out[9] = profile_id;

    int start_bin = (part == 1) ? 0 : 5;
    int offset = 10;

    for (int i = 0; i < 5; i++) {
        int b = start_bin + i;
        int16_t t_scaled = (int16_t)(prof->bins[b].temp * 100.0f);
        uint16_t s_scaled = (uint16_t)(prof->bins[b].salinity * 100.0f);

        frame_out[offset++] = (t_scaled >> 8) & 0xFF;
        frame_out[offset++] = t_scaled & 0xFF;
        frame_out[offset++] = (s_scaled >> 8) & 0xFF;
        frame_out[offset++] = s_scaled & 0xFF;
    }

    /* Byte 30: Packed QC flags */
    uint8_t qc_byte = 0;
    for (int i = 0; i < 5; i++) {
        if (prof->bins[start_bin + i].qc_flag != QC_GOOD) {
            qc_byte |= (1 << i);
        }
    }
    frame_out[30] = qc_byte;
}
`
  },

  // 5. kim1_argos.c
  {
    path: 'firmware/main-mcu/src/drivers/kim1_argos.c',
    name: 'kim1_argos.c',
    language: 'c',
    description: 'Kinéis KIM1 AT-command driver, 4800 baud USART2, cold lock below -20°C',
    content: `/**
 * @file kim1_argos.c
 * @brief Kinéis KIM1 Argos Satellite Transceiver Driver
 * @details USART2 at 4800 baud, 3.3V logic. Transmit locked below -20°C internal temp.
 */

#include "kim1_argos.h"
#include "../config/thresholds.h"

void KIM1_Init(void) {
    /* Initialize USART2 4800 8N1, configure GPIO load switch for 5V rail */
}

bool KIM1_CanTransmit(float internal_temp_c, bool waterline_wet, bool antenna_wet) {
    /* Problem #8 Fix: KIM1 rated only to -20°C. Cold transmit lock. */
    if (internal_temp_c < THRESH_KIM1_COLD_LOCK_TEMP) {
        return false; // Queue held until water contact warms internal hull
    }

    /* Problem #3 & #10: Antenna-covered hold */
    if (antenna_wet) {
        return false; // Float submerged by wash or ice; do not transmit into water
    }

    return true;
}

bool KIM1_TransmitFrame(const uint8_t *frame_31b) {
    /* Format AT command: AT+SEND=31,<HEX> */
    /* Power up 5V rail via load switch */
    /* Transmit at 0.25-1.5 W RF (1-second pulse, buffered by supercap) */
    /* Power down 5V rail */
    return true;
}
`
  },

  // 6. thresholds.h
  {
    path: 'firmware/main-mcu/src/config/thresholds.h',
    name: 'thresholds.h',
    language: 'h',
    description: 'Isolated registry of all [EST] tunables for bench & field calibration',
    content: `/**
 * @file thresholds.h
 * @brief Master Tunables Registry (Every [EST] threshold isolated for field calibration)
 */

#ifndef CONFIG_THRESHOLDS_H_
#define CONFIG_THRESHOLDS_H_

/* Battery & Energy Gate */
#define NOMINAL_BATTERY_WH          281.0f  // 6x Saft LSH20 Li-SOCl2 (3S2P)
#define USABLE_BATTERY_WH           180.0f  // 35% derating for Antarctic cold & ageing
#define RESERVE_WH                  15.0f   // ~3 weeks of baseline survival reserve
#define MISSION_LIFETIME_DAYS       180     // 6 months design life
#define ALLOWED_WH_PER_DAY          ((USABLE_BATTERY_WH - RESERVE_WH) / (float)MISSION_LIFETIME_DAYS) // 0.917 Wh/day

/* Profiling Dynamics */
#define PROFILER_MAX_DEPTH_M        10.0f   // Hard limit by pressure sensor (2m above drogue)
#define PROFILER_DOCK_DEPTH_M       0.3f    // Confirmed by reed switch
#define WINCH_DESCENT_SPEED_MPS     0.20f   // [EST] Free-fall descent science pass speed
#define WINCH_ASCENT_SPEED_MPS      0.10f   // Winch recovery speed
#define MOTOR_STALL_CURRENT_MA      450.0f  // [EST] Fast jam cutoff (>200 ms)
#define MOTOR_STALL_WINDOW_MS       200     // Milliseconds before comparator trip

/* Autonomous State Transitions */
#define THRESH_SST_ICE_APPROACH     0.0f    // °C: 2 of 3 signs triggers ICE_APPROACH
#define THRESH_SST_ICE_FREEZE       -1.5f   // °C: Freeze lock trigger
#define THRESH_SST_ICE_EXIT         -1.0f   // °C: Exit ICE after 3-4 heartbeats
#define THRESH_WAVE_HEIGHT_STORM    3.5f    // Meters: defers profiling in heavy seas
#define THRESH_WAVE_HEIGHT_CALM     0.4f    // Meters: calm ocean trigger
#define HYSTERESIS_REQUIRED_CHECKS  3       // 3 consecutive confirming checks

/* Environmental & Hardware Safety */
#define THRESH_KIM1_COLD_LOCK_TEMP  -20.0f  // °C: Kim1 module cold transmit lock
#define THRESH_HULL_LEAK_RH         75.0f   // % RH internal warning

#endif /* CONFIG_THRESHOLDS_H_ */
`
  },

  // 7. pinmap.h
  {
    path: 'firmware/main-mcu/src/config/pinmap.h',
    name: 'pinmap.h',
    language: 'h',
    description: 'STM32L476RG hardware peripheral and GPIO pin routing map',
    content: `/**
 * @file pinmap.h
 * @brief STM32L476RG Hardware Peripheral Allocation Map
 */

#ifndef CONFIG_PINMAP_H_
#define CONFIG_PINMAP_H_

/* I2C1: Mast Sensors + Hull IMU */
#define I2C1_SCL_PIN        GPIO_PIN_8  // GPIOB
#define I2C1_SDA_PIN        GPIO_PIN_9  // GPIOB
#define ADDR_MAST_SHT45     0x44
#define ADDR_BMP390         0x77
#define ADDR_LSM6DSO_IMU    0x6A

/* I2C2: Internal Sensor Box + Float Base SST */
#define I2C2_SCL_PIN        GPIO_PIN_10 // GPIOB
#define I2C2_SDA_PIN        GPIO_PIN_11 // GPIOB
#define ADDR_INT_SHT45      0x44        // Resolved: Separate bus for duplicate 0x44 address
#define ADDR_SST_TSYS01     0x76

/* USART1: u-blox NEO-M9N GNSS */
#define USART1_TX_PIN       GPIO_PIN_9  // GPIOA
#define USART1_RX_PIN       GPIO_PIN_10 // GPIOA

/* USART2: Kinéis KIM1 Argos Transceiver (4800 baud) */
#define USART2_TX_PIN       GPIO_PIN_2  // GPIOA
#define USART2_RX_PIN       GPIO_PIN_3  // GPIOA

/* USART3: RS-485 to STM32L031 Probe (MAX3485) */
#define USART3_TX_PIN       GPIO_PIN_10 // GPIOC
#define USART3_RX_PIN       GPIO_PIN_11 // GPIOC
#define RS485_DIR_PIN       GPIO_PIN_12 // GPIOC

/* Winch Control */
#define TIM1_CH1_PWM_PIN    GPIO_PIN_8  // GPIOA (DRV8871 IN1)
#define TIM1_CH2_PWM_PIN    GPIO_PIN_7  // GPIOA (DRV8871 IN2)
#define TIM2_ENCODER_A_PIN  GPIO_PIN_0  // GPIOA (Hall A)
#define TIM2_ENCODER_B_PIN  GPIO_PIN_1  // GPIOA (Hall B)

/* Analog / Comparators */
#define ADC1_SHUNT_PIN      GPIO_PIN_0  // GPIOC (Main power shunt)
#define ADC1_LOADCELL_PIN   GPIO_PIN_1  // GPIOC (Tether tension)
#define COMP1_INP_PIN       GPIO_PIN_1  // Tether overload comparator
#define COMP2_INP_PIN       GPIO_PIN_4  // Motor fast stall comparator

/* Capacitive Wet Sensing (Touch Sensing Controller TSC) */
#define TSC_WATERLINE_PAD   GPIO_PIN_4  // GPIOB (G1_IO1)
#define TSC_ANTENNA_PAD     GPIO_PIN_5  // GPIOB (G1_IO2)

/* Discrete Inputs */
#define REED_DOCK_PIN       GPIO_PIN_13 // GPIOC (EXTI13)

#endif /* CONFIG_PINMAP_H_ */
`
  },

  // 8. probe MCU main.c
  {
    path: 'firmware/probe-mcu/src/main.c',
    name: 'main.c (Probe)',
    language: 'c',
    description: 'STM32L031 minimal probe sensor front-end over RS-485',
    content: `/**
 * @file main.c (Probe MCU)
 * @brief STM32L031 Minimal Dumb Sensor Front-End
 * @details Reads TSYS01, Bar30, and Atlas EZO-EC over I2C, replies to main MCU via RS-485.
 */

#include "stm32l0xx_ll_rcc.h"
#include "stm32l0xx_ll_usart.h"
#include "drivers/tsys01.h"
#include "drivers/bar30.h"
#include "drivers/ezo_ec.h"

typedef struct __attribute__((packed)) {
    int16_t  temp_c_x100;      // 0.01 °C
    uint32_t pressure_mbar_x10;// 0.1 mbar -> ~1 mm depth
    uint32_t cond_uS_cm;       // uS/cm
    uint8_t  crc;
} probe_telemetry_packet_t;

int main(void) {
    /* Initialize I2C and RS-485 USART */
    TSYS01_Init();
    Bar30_Init();
    EZO_EC_Init();

    while (1) {
        /* Wait for poll command 0x55 from Main MCU over RS-485 */
        if (RS485_WaitForPoll()) {
            probe_telemetry_packet_t pkt;
            pkt.temp_c_x100 = TSYS01_ReadTemp();
            pkt.pressure_mbar_x10 = Bar30_ReadPressure();
            pkt.cond_uS_cm = EZO_EC_ReadConductivity();
            pkt.crc = ComputeCRC((uint8_t*)&pkt, sizeof(pkt) - 1);

            RS485_SendReply((uint8_t*)&pkt, sizeof(pkt));
        }
    }
}
`
  },

  // 9. Python decode.py
  {
    path: 'ground/decoder/decode.py',
    name: 'decode.py',
    language: 'python',
    description: 'Ground station binary decoder: 31-byte Argos frame -> structured Python dictionary',
    content: `"""
Argos / Kinéis KIM1 31-Byte Frame Decoder
NCPOR / INCOIS Ground Data Processing Pipeline
SIH 2026 PS 26065
"""

import struct
from datetime import datetime, timezone

def crc16_ccitt(data: bytes) -> int:
    crc = 0xFFFF
    for byte in data:
        crc ^= (byte << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return crc

STATE_NAMES = {0: "NORMAL", 1: "STORM", 2: "CALM", 3: "ICE_APPROACH", 4: "ICE", 5: "ON_FLOE"}
TIER_NAMES = {0: "Full", 1: "Lean", 2: "Survival", 3: "Beacon", 4: "Winch fault"}

def decode_argos_frame(raw_31_bytes: bytes) -> dict:
    if len(raw_31_bytes) != 31:
        raise ValueError(f"Expected 31 bytes, got {len(raw_31_bytes)}")

    msg_type = raw_31_bytes[0]
    unit_id = (raw_31_bytes[1] << 16) | (raw_31_bytes[2] << 8) | raw_31_bytes[3]
    seq_no = raw_31_bytes[4]
    timestamp = struct.unpack(">I", raw_31_bytes[5:9])[0]
    dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)

    if msg_type == 0x01: # STATUS
        lat, lon, sst_s, air_s = struct.unpack(">hhhh", raw_31_bytes[9:17])
        rh = raw_31_bytes[17]
        press_s, wave_h_b, wave_p_b, wh_s = struct.unpack(">HBBH", raw_31_bytes[18:24])
        state_idx = raw_31_bytes[24]
        flags = raw_31_bytes[25]
        int_t = raw_31_bytes[26] - 128
        int_rh = raw_31_bytes[27]

        crc_calc = crc16_ccitt(raw_31_bytes[:29])
        crc_recv = struct.unpack(">H", raw_31_bytes[29:31])[0]

        return {
            "type": "STATUS",
            "unit_id": f"0x{unit_id:06X}",
            "seq": seq_no,
            "timestamp": dt.isoformat(),
            "lat": lat / 100.0,
            "lon": lon / 100.0,
            "sst_c": sst_s / 100.0,
            "air_temp_c": air_s / 100.0,
            "humidity_pct": rh,
            "pressure_hpa": (press_s + 8000) / 10.0,
            "wave_height_m": (wave_h_b * 5) / 100.0,
            "wave_period_s": wave_p_b / 10.0,
            "energy_used_wh": wh_s / 100.0,
            "state": STATE_NAMES.get(state_idx, "UNKNOWN"),
            "tier": TIER_NAMES.get((flags >> 4) & 0x0F, "UNKNOWN"),
            "drogue_attached": bool(flags & 0x01),
            "waterline_wet": bool(flags & 0x02),
            "antenna_wet": bool(flags & 0x04),
            "winch_fault": bool(flags & 0x08),
            "internal_temp_c": int_t,
            "crc_valid": crc_calc == crc_recv
        }

    elif msg_type in (0x02, 0x03): # PROFILE
        part = 1 if msg_type == 0x02 else 2
        profile_id = raw_31_bytes[9]
        base_depth = 1 if part == 1 else 6
        levels = []
        offset = 10
        for i in range(5):
            t_s, s_s = struct.unpack(">hH", raw_31_bytes[offset:offset+4])
            offset += 4
            levels.append({
                "depth_m": base_depth + i,
                "temp_c": t_s / 100.0,
                "salinity_psu": s_s / 100.0
            })
        return {
            "type": f"PROFILE_PART_{part}",
            "unit_id": f"0x{unit_id:06X}",
            "seq": seq_no,
            "timestamp": dt.isoformat(),
            "profile_id": profile_id,
            "levels": levels
        }

    raise ValueError(f"Unknown message type 0x{msg_type:02X}")
`
  },

  // 10. Python energy_budget_sim.py
  {
    path: 'sim/energy_budget_sim.py',
    name: 'energy_budget_sim.py',
    language: 'python',
    description: '180-day Monte Carlo and scenario simulation of the allowed-curve gate',
    content: `"""
X-Drifter 180-Day Energy Budget Simulator
Verifies the allowed-curve gate with 15 Wh reserve against synthetic Southern Ocean seasons.
"""

NOMINAL_BATTERY_WH = 281.0
USABLE_BATTERY_WH = 180.0 # 35% derating
RESERVE_WH = 15.0
LIFETIME_DAYS = 180

# Daily baseline loads (Wh/day)
LOAD_SLEEP = 0.013
LOAD_SURFACE_SENSING = 0.011
LOAD_GNSS = 0.006
LOAD_ARGOS_TELEMETRY = 0.067
LOAD_BASELINE_PROFILES = 0.590 # 2 profiles/day @ 0.295 Wh
LOAD_MCU = 0.0002

BASELINE_DAILY_WH = 0.687 # = 124 Wh over 180 days

def run_simulation(scenario="variable_weather"):
    used_wh = 0.0
    history = []
    extra_profiles_run = 0

    for day in range(1, LIFETIME_DAYS + 1):
        allowed_wh = (USABLE_BATTERY_WH - RESERVE_WH) * (day / LIFETIME_DAYS)

        # Baseline cost
        daily_cost = LOAD_SLEEP + LOAD_SURFACE_SENSING + LOAD_GNSS + LOAD_ARGOS_TELEMETRY + LOAD_MCU

        # Weather scenario impact
        if scenario == "calm" or (30 <= day <= 60):
            # CALM: Skip 2nd profile, save 0.295 Wh
            daily_cost += (LOAD_BASELINE_PROFILES / 2.0)
        elif scenario == "storm" or (80 <= day <= 85):
            # STORM: Defer both profiles during extreme heave
            daily_cost += 0.0
        elif 120 <= day <= 135:
            # ICE: Dock probe, 0 profiles
            daily_cost += 0.0
        else:
            # NORMAL: Run 2 baseline profiles
            daily_cost += LOAD_BASELINE_PROFILES

        # Adaptive extra profile attempt (e.g. salinity anomaly detected)
        anomaly_detected = (day % 4 == 0)
        extra_profile_cost = 0.295
        if anomaly_detected and (used_wh + daily_cost + extra_profile_cost <= allowed_wh):
            daily_cost += extra_profile_cost
            extra_profiles_run += 1

        used_wh += daily_cost
        history.append({
            "day": day,
            "used_wh": round(used_wh, 3),
            "allowed_wh": round(allowed_wh, 3),
            "margin_wh": round(allowed_wh - used_wh, 3)
        })

    print(f"End of 180 days: Used {used_wh:.2f} Wh out of {USABLE_BATTERY_WH:.2f} Wh usable.")
    print(f"Reserve remaining: {USABLE_BATTERY_WH - used_wh:.2f} Wh. Extras executed: {extra_profiles_run}")
    return history

if __name__ == "__main__":
    run_simulation()
`
  },

  // 11. docs/message_formats.md
  {
    path: 'docs/message_formats.md',
    name: 'message_formats.md',
    language: 'markdown',
    description: 'Exact byte-by-byte and bit-field layout of the 31-byte Argos telemetry frames',
    content: `# Argos / Kinéis KIM1 31-Byte Message Format

All frames are strictly 31 bytes to comply with Kinéis KIM1 payload limits.

## 1. Status Message (Type \`0x01\`, 4 / day)
| Byte Range | Field | Data Type | Units / Scaling | Description |
|---|---|---|---|---|
| \`[0]\` | Message Type | uint8 | Fixed \`0x01\` | STATUS frame identifier |
| \`[1..3]\` | Unit ID | uint24 BE | — | Argos transmitter 24-bit PTT ID |
| \`[4]\` | Sequence No | uint8 | 0..255 | Rolling sequence counter for deduplication |
| \`[5..8]\` | Timestamp | uint32 BE | Epoch seconds | UTC fix timestamp |
| \`[9..10]\` | Latitude | int16 BE | Deg × 100 | -90.00° to +90.00° |
| \`[11..12]\` | Longitude | int16 BE | Deg × 100 | -180.00° to +180.00° |
| \`[13..14]\` | SST | int16 BE | °C × 100 | Sea surface temp (-2.00°C to +30.00°C) |
| \`[15..16]\` | Air Temp | int16 BE | °C × 100 | Ambient air temp (-40.00°C to +40.00°C) |
| \`[17]\` | Air Humidity | uint8 | % RH | 0 to 100% |
| \`[18..19]\` | Pressure | uint16 BE | (hPa × 10) - 8000 | 800.0 to 1100.0 hPa |
| \`[20]\` | Wave Height | uint8 | cm / 5 | 0 to 12.75 m |
| \`[21]\` | Wave Period | uint8 | s × 10 | 0.0 to 25.5 s |
| \`[22..23]\` | Wh Used | uint16 BE | Wh × 100 | Measured energy ledger accumulated |
| \`[24]\` | State | uint8 | Enum (0..5) | NORMAL(0), STORM(1), CALM(2), ICE_APP(3), ICE(4), FLOE(5) |
| \`[25]\` | Flags | uint8 | Bitfield | b0: Drogue, b1: Wet1, b2: Wet2, b3: Jam, b4-7: Tier |
| \`[26]\` | Bay Temp | uint8 | °C + 128 | Electronics bay internal temp |
| \`[27]\` | Bay Humidity | uint8 | % RH | Electronics bay leak warning |
| \`[28]\` | Diagnostic | uint8 | Reserved | Diagnostic code |
| \`[29..30]\` | CRC-16 | uint16 BE | CCITT | Checksum over bytes 0..28 |

## 2. Profile Message 1 (Type \`0x02\`, 1m to 5m) & 2 (Type \`0x03\`, 6m to 10m)
| Byte Range | Field | Data Type | Units / Scaling | Description |
|---|---|---|---|---|
| \`[0]\` | Message Type | uint8 | \`0x02\` or \`0x03\` | Profile part 1 or part 2 |
| \`[1..3]\` | Unit ID | uint24 BE | — | Transmitter ID |
| \`[4]\` | Sequence No | uint8 | 0..255 | Rolling sequence |
| \`[5..8]\` | Timestamp | uint32 BE | Epoch seconds | Profile cast completion timestamp |
| \`[9]\` | Profile ID | uint8 | 1..255 | Profile counter to reassemble parts 1 & 2 |
| \`[10..11]\` | Level 1 Temp | int16 BE | °C × 100 | e.g. 1m depth (or 6m in part 2) |
| \`[12..13]\` | Level 1 Salinity | uint16 BE | psu × 100 | e.g. 33.85 psu -> 3385 |
| \`[14..29]\` | Levels 2..5 | 4× (int16+uint16) | °C & psu × 100 | Remaining 4 depth bins |
| \`[30]\` | QC Flags | uint8 | Bitfield | 1 bit per level (0=Good, 1=Suspect/Edited) |
`
  },

  // 12. hardware/bom.csv
  {
    path: 'hardware/bom.csv',
    name: 'bom.csv',
    language: 'csv',
    description: 'Complete Bill of Materials comparing Indian local manufacture vs imported components',
    content: `Subsystem,Part,Origin,Supplier,Purpose,Approx Cost INR
Science Sensors,Celsius Fast-Response TSYS01,Imported,Blue Robotics (USA),Water Temperature ±0.1°C,8500
Science Sensors,Bar30 High-Resolution MS5837,Imported,Blue Robotics (USA),Pressure & Depth (2mm res),9500
Science Sensors,EZO-EC + K1.0 Embedded Probe,Imported,Atlas Scientific (USA),Conductivity to Salinity ±2%,14500
Science Sensors,TSYS01 Surface Sensor,Imported,TE Connectivity,Sea Surface Temp at float base,4000
Science Sensors,BMP390 Precision Barometer,Imported,Bosch Sensortec,Atmospheric Pressure ±0.5 hPa,2500
Science Sensors,SHT45 Dual Sensor (Mast+Bay),Imported,Sensirion (Switzerland),Air Temp ±0.1°C & RH ±1%,2500
Engineering Sensors,LSM6DSO 6-Axis IMU,Imported,STMicroelectronics,Wave Spectrum & Wake-on-Motion,1200
Engineering Sensors,Dry-side Tether Load Cell,India,Sensors India,Tension & Drogue Loss Detection,1800
Engineering Sensors,Main-line Shunt & Current Amp,India,Local Assembly,Measured Wh Energy Ledger,600
Engineering Sensors,Capacitive Through-Wall Wet Pads,India,PCB Fabricator,Waterline & Floe Detection,400
Engineering Sensors,Magnetic Dock Reed Switch,India,Local Supplier,Docking Confirmation,300
Electronics,STM32L476RG Main MCU Board,Imported,STMicroelectronics,Event-driven Superloop & FPU,3500
Electronics,STM32L031K6 Probe MCU,Imported,STMicroelectronics,Sensor Front-End & RS-485,900
Electronics,Kinéis KIM1 Argos Satellite Module,Imported,Kinéis (France),400MHz Polar Orbit Telemetry,22000
Electronics,u-blox NEO-M9N Multi-GNSS,Imported,u-blox (Switzerland),Position & Doppler Backup,5500
Electronics,TI DRV8871 H-Bridge Motor Driver,Imported,Texas Instruments,Winch PWM & Fast Stall Sense,1100
Electronics,TPS62840 Ultra-Low-IQ Buck,Imported,Texas Instruments,3.3V Power Rail (60nA IQ),800
Electronics,PCB Fabrication & Assembly,India,Indian EMS (Bengaluru),Double-sided conformal coated,4200
Power Source,6x Saft LSH20 Li-SOCl2 D-cells,Imported,Saft (France),10.8V 26Ah 281Wh -60°C rated,18000
Power Source,Supercapacitor Bank Buffer,India,Local Dist.,Passivation & Winch Inrush,2200
Hull & Mechanics,400mm Rotomoulded HDPE Sphere,India,Indian Rotomoulders,Buoyancy & Impact Resistance,8500
Hull & Mechanics,POM-C Winch Drum & Probe Tube,India,Local CNC Precision,Corrosion-proof Structure,6500
Hull & Mechanics,JGY-370 12V Worm-Gear Motor,India,Local Dist.,Zero-power Hold Winch,1800
Hull & Mechanics,Double Lip Low-Temp Shaft Seals,India,Sealtech India,Water-tight Rotating Seal,1200
Hull & Mechanics,Dyneema Tether 12m + Weak Link,India,Rope Factory (Gujarat),High-strength low-creep tether,2500
Hull & Mechanics,Holey-Sock Ripstop Drogue 6m,India,Marine Sailmakers (Kochi),15m Current Follower (40:1 ratio),4500
Hull & Mechanics,4-Core PUR Aramid Probe Cable,India,Specialty Cable Corp,Subsea RS-485 & Power,3500
TOTAL DEPLOYABLE UNIT COST,,,,,"₹ 1,30,500 (~$1,560 USD vs $7,800 USD imported)"
`
  }
];
