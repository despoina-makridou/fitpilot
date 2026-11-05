import { Goal } from '../types';

/**
 * Sanity checks + realistic guidance for goal follow-ups. This is what lets the
 * app say "you're 50kg, losing 10 more isn't healthy". Advisory only — we warn,
 * we don't hard-block (except physically impossible values).
 */

/** Healthy BMI band used for target-weight sanity. */
const BMI_MIN = 18.5;
const BMI_MAX = 25;

export function healthyWeightRange(heightCm: number): { min: number; max: number } {
  const m = heightCm / 100;
  return { min: Math.round(BMI_MIN * m * m), max: Math.round(BMI_MAX * m * m) };
}

export type TargetVerdict = {
  ok: boolean; // false = block (impossible/unsafe direction)
  level: 'ok' | 'warn' | 'error';
  message?: string;
};

/**
 * Validate a target weight for lose_fat / gain_weight against current weight
 * and height. Returns advisory messages.
 */
export function checkTargetWeight(
  goal: Goal,
  currentKg: number,
  targetKg: number,
  heightCm: number,
): TargetVerdict {
  if (!targetKg || targetKg < 30 || targetKg > 300) {
    return { ok: false, level: 'error', message: 'Enter a realistic target weight.' };
  }

  const { min, max } = healthyWeightRange(heightCm);
  const diff = targetKg - currentKg;

  if (goal === 'lose_fat') {
    if (targetKg >= currentKg) {
      return { ok: false, level: 'error', message: 'To lose fat, your target should be below your current weight.' };
    }
    if (targetKg < min) {
      return {
        ok: true,
        level: 'warn',
        message: `That's below a healthy weight for your height (~${min}–${max} kg). Consider aiming no lower than ${min} kg.`,
      };
    }
    if (Math.abs(diff) > currentKg * 0.25) {
      return { ok: true, level: 'warn', message: `That's a big change. A steady, safe pace is best — we'll aim for gradual progress.` };
    }
    return { ok: true, level: 'ok' };
  }

  if (goal === 'gain_weight') {
    if (targetKg <= currentKg) {
      return { ok: false, level: 'error', message: 'To gain weight, your target should be above your current weight.' };
    }
    if (targetKg > max) {
      return {
        ok: true,
        level: 'warn',
        message: `That's above a healthy weight for your height (~${min}–${max} kg). Consider aiming no higher than ${max} kg.`,
      };
    }
    return { ok: true, level: 'ok' };
  }

  return { ok: true, level: 'ok' };
}

/** A realistic weekly pace hint (kg/week) for weight goals. */
export function weeklyPaceHint(goal: Goal, currentKg: number): string {
  if (goal === 'lose_fat') return `A safe pace is about ${(currentKg * 0.007).toFixed(1)}–${(currentKg * 0.01).toFixed(1)} kg per week.`;
  if (goal === 'gain_weight') return `A healthy pace is about 0.2–0.5 kg per week.`;
  return '';
}
