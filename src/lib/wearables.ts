import { Platform } from 'react-native';

/**
 * Scaffold for wearable / HealthKit / Health Connect vitals.
 * Expo Go builds return null until a dev client wires native APIs.
 */

export interface VitalReading {
  heartRate?: number;
  temperature?: number;
  spO2?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  steps?: number;
  readAt: Date;
}

/** Latest snapshot from HealthKit / Health Connect when integrated. */
export async function getLatestVitals(): Promise<VitalReading | null> {
  void Platform.OS;
  return null;
}

export async function isWearableConnected(): Promise<boolean> {
  return false;
}
