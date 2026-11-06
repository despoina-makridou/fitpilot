import AsyncStorage from '@react-native-async-storage/async-storage';
import { FitnessLevel, Sex } from '../types';

/**
 * Personal info kept LOCALLY on the device only. This is NEVER sent to the
 * cloud (Supabase) — the consent screen promises we don't collect health
 * metrics/weight in the study. It's used purely on-device for AI guidance,
 * guardrails, and greeting.
 */
export interface LocalProfile {
  name?: string;          // real name / greeting (local only)
  age?: number;
  sex?: Sex;
  height_cm?: number;
  weight_kg?: number;
  fitness_level?: FitnessLevel;
  days_per_week?: number;
}

const KEY = 'fitpilot.localProfile';

export async function getLocalProfile(): Promise<LocalProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalProfile) : {};
  } catch {
    return {};
  }
}

export async function saveLocalProfile(patch: Partial<LocalProfile>): Promise<void> {
  const current = await getLocalProfile();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function clearLocalProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
