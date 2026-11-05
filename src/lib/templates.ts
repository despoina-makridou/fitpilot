import { Goal, WorkoutTemplate } from '../types';

/**
 * Goal-based workout templates. Deliberately LOOSE and near-identical in
 * structure across goals — the study wants everyone on a comparable schedule
 * so the only real variable is AI vs non-AI. Targets are ranges/alternatives,
 * never "6pm sharp do X".
 *
 * Day index: 0=Mon, 1=Tue, ... 6=Sun.
 */
const TEMPLATES: Record<Goal, WorkoutTemplate> = {
  lose_fat: {
    goal: 'lose_fat',
    name: 'Lean & Active',
    items: [
      { day: 0, title: 'Cardio', target: '~40 min walking or ~20 min running', targetMinutes: 30 },
      { day: 2, title: 'Full body', target: '~30 min bodyweight circuit', targetMinutes: 30 },
      { day: 4, title: 'Cardio', target: '~40 min walking or ~25 min cycling', targetMinutes: 35 },
      { day: 6, title: 'Easy movement', target: '~30 min stretch or light walk', targetMinutes: 25 },
    ],
  },
  endurance: {
    goal: 'endurance',
    name: 'Go Longer',
    items: [
      { day: 0, title: 'Steady cardio', target: '~30 min easy run/cycle/swim', targetMinutes: 30 },
      { day: 2, title: 'Intervals', target: '~25 min intervals (hard/easy)', targetMinutes: 25 },
      { day: 4, title: 'Steady cardio', target: '~35 min at a comfortable pace', targetMinutes: 35 },
      { day: 6, title: 'Long session', target: '~45 min longer, slow effort', targetMinutes: 45 },
    ],
  },
  gain_weight: {
    goal: 'gain_weight',
    name: 'Build & Fuel',
    items: [
      { day: 0, title: 'Strength', target: '~30 min resistance / weights', targetMinutes: 30 },
      { day: 2, title: 'Strength', target: '~30 min resistance / weights', targetMinutes: 30 },
      { day: 4, title: 'Strength', target: '~30 min resistance / weights', targetMinutes: 30 },
      { day: 6, title: 'Light cardio', target: '~20 min easy walk', targetMinutes: 20 },
    ],
  },
  build_muscle: {
    goal: 'build_muscle',
    name: 'Strong & Steady',
    items: [
      { day: 0, title: 'Upper body', target: '~35 min push/pull work', targetMinutes: 35 },
      { day: 1, title: 'Lower body', target: '~35 min legs / squats', targetMinutes: 35 },
      { day: 3, title: 'Upper body', target: '~35 min push/pull work', targetMinutes: 35 },
      { day: 4, title: 'Lower body', target: '~35 min legs / squats', targetMinutes: 35 },
      { day: 6, title: 'Recovery', target: '~25 min mobility / stretch', targetMinutes: 25 },
    ],
  },
  maintain: {
    goal: 'maintain',
    name: 'Steady Routine',
    items: [
      { day: 0, title: 'Move', target: '~30 min anything you enjoy', targetMinutes: 30 },
      { day: 2, title: 'Move', target: '~30 min anything you enjoy', targetMinutes: 30 },
      { day: 4, title: 'Move', target: '~30 min anything you enjoy', targetMinutes: 30 },
      { day: 6, title: 'Move', target: '~30 min anything you enjoy', targetMinutes: 30 },
    ],
  },
};

export function templateForGoal(goal: Goal): WorkoutTemplate {
  return TEMPLATES[goal];
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const dayName = (d: number) => DAY_NAMES[d] ?? '?';

/** JS getDay() is 0=Sun..6=Sat; our templates use 0=Mon..6=Sun. */
export function todayIndex(date = new Date()): number {
  return (date.getDay() + 6) % 7;
}
