import { Goal } from '../types';

/**
 * Equipment / space the user can tick on the Equipment screen. One shared,
 * combined list (shown before goal selection). Each goal then decides which of
 * these contribute exercises and what those exercises are (see LIBRARY).
 */
export type Equipment =
  | 'open_space'
  | 'pullup_bar'
  | 'parallel_bars'
  | 'stairs'
  | 'resistance_bands'
  | 'dumbbells'
  | 'barbell'
  | 'kettlebell'
  | 'bench'
  | 'weighted_objects'
  | 'running_area'
  | 'bike'
  | 'pool'
  | 'jump_rope'
  | 'rowing_machine'
  | 'gym_machines'
  | 'yoga_space';

export const EQUIPMENT_OPTIONS: { id: Equipment; label: string; emoji: string }[] = [
  { id: 'open_space', label: 'Open space', emoji: '🟩' },
  { id: 'pullup_bar', label: 'Pull-up bar', emoji: '🏋️' },
  { id: 'parallel_bars', label: 'Parallel / dip bars', emoji: '🤸' },
  { id: 'bench', label: 'Bench / chair', emoji: '🪑' },
  { id: 'stairs', label: 'Stairs / hills', emoji: '🪜' },
  { id: 'resistance_bands', label: 'Resistance bands', emoji: '🎗️' },
  { id: 'dumbbells', label: 'Dumbbells', emoji: '🏋️‍♀️' },
  { id: 'barbell', label: 'Barbell + weights', emoji: '🏋️‍♂️' },
  { id: 'kettlebell', label: 'Kettlebell', emoji: '🔔' },
  { id: 'weighted_objects', label: 'Backpack / weighted objects', emoji: '🎒' },
  { id: 'running_area', label: 'Running / walking area', emoji: '🏃' },
  { id: 'bike', label: 'Bike', emoji: '🚲' },
  { id: 'pool', label: 'Swimming pool', emoji: '🏊' },
  { id: 'jump_rope', label: 'Jump rope', emoji: '🪢' },
  { id: 'rowing_machine', label: 'Rowing machine', emoji: '🚣' },
  { id: 'gym_machines', label: 'Gym machines', emoji: '🏢' },
  { id: 'yoga_space', label: 'Yoga / mobility space', emoji: '🧘' },
];

export const equipmentLabel = (id: Equipment): string =>
  EQUIPMENT_OPTIONS.find((e) => e.id === id)?.label ?? id;

/**
 * The exercise library: for each goal, which equipment yields which exercises.
 * (Transcribed from the app spec.) Only equipment the user actually has AND
 * that this goal uses will surface exercises.
 */
type GoalLibrary = Partial<Record<Equipment, string[]>>;

const LIBRARY: Record<Goal, GoalLibrary> = {
  build_muscle: {
    open_space: ['Push-ups', 'Squats', 'Lunges', 'Bulgarian split squats', 'Planks', 'Burpees'],
    pullup_bar: ['Pull-ups', 'Chin-ups', 'Australian pull-ups', 'Hanging leg raises', 'Knee raises', 'Dead hangs'],
    parallel_bars: ['Dips', 'Assisted dips', 'L-sits', 'Support holds'],
    resistance_bands: ['Band rows', 'Band chest press', 'Band shoulder press', 'Band curls', 'Band triceps extensions', 'Face pulls'],
    dumbbells: ['Dumbbell press', 'Dumbbell rows', 'Shoulder press', 'Lateral raises', 'Curls', 'Goblet squats', 'Romanian deadlifts'],
    barbell: ['Squats', 'Deadlifts', 'Bench press', 'Overhead press', 'Barbell rows', 'Hip thrusts'],
    kettlebell: ['Kettlebell swings', 'Goblet squats', 'Clean & press', 'Farmer carries'],
    bench: ['Step-ups', 'Bulgarian split squats', 'Incline push-ups', 'Decline push-ups', 'Chair dips'],
  },
  lose_fat: {
    running_area: ['Walking', 'Jogging', 'Running', 'Sprint intervals'],
    bike: ['Cycling', 'Intervals', 'Long-distance cycling'],
    pool: ['Swimming', 'Water intervals', 'Endurance swimming'],
    open_space: ['Burpees', 'Mountain climbers', 'Jump squats', 'High knees', 'Bodyweight circuits'],
    jump_rope: ['Skipping', 'HIIT intervals', 'Conditioning drills'],
    resistance_bands: ['Full-body circuits', 'Rows', 'Squats', 'Presses'],
    dumbbells: ['Dumbbell circuits', 'Thrusters', 'Lunges', 'Rows', 'Presses'],
    gym_machines: ['Treadmill', 'Elliptical', 'Rowing machine', 'Cable machines', 'Weight machines'],
  },
  endurance: {
    running_area: ['Outdoor running', 'Sprint training', 'Interval running', 'Long-distance running'],
    bike: ['Road cycling', 'Mountain biking', 'Cycling intervals'],
    pool: ['Swimming laps', 'Swim intervals', 'Endurance swimming'],
    rowing_machine: ['Steady rowing', 'Interval rowing'],
    stairs: ['Stair climbing', 'Hill walking', 'Hill running'],
    jump_rope: ['Skipping endurance', 'Conditioning'],
    open_space: ['Mobility drills', 'Bodyweight circuits', 'Conditioning workouts'],
  },
  gain_weight: {
    open_space: ['Push-ups', 'Squats', 'Lunges', 'Core exercises'],
    pullup_bar: ['Pull-ups', 'Chin-ups', 'Hanging leg raises', 'Australian pull-ups'],
    parallel_bars: ['Dips', 'L-sits'],
    resistance_bands: ['Rows', 'Presses', 'Curls', 'Extensions'],
    dumbbells: ['Presses', 'Rows', 'Curls', 'Squats', 'Deadlifts'],
    barbell: ['Squats', 'Deadlifts', 'Bench press', 'Overhead press', 'Rows'],
    kettlebell: ['Swings', 'Squats', 'Carries'],
    bench: ['Step-ups', 'Split squats', 'Hip thrusts'],
  },
  maintain: {
    running_area: ['Walking', 'Light jogging', 'Jogging', 'Running', 'Intervals'],
    bike: ['Cycling', 'Casual rides'],
    pool: ['Swimming', 'Water exercises'],
    open_space: ['Stretching', 'Mobility', 'Bodyweight workouts'],
    resistance_bands: ['Light strength training', 'Mobility exercises'],
    dumbbells: ['Basic strength workouts', 'Full-body routines'],
    yoga_space: ['Yoga', 'Stretching', 'Balance work'],
  },
};

/**
 * Which equipment options are actually MEANINGFUL for a goal (i.e. contribute
 * at least one exercise). Used to gently sort/mark the equipment screen if
 * desired — but the screen shows all options regardless.
 */
export function equipmentUsedByGoal(goal: Goal): Equipment[] {
  return Object.keys(LIBRARY[goal]) as Equipment[];
}

/**
 * The exercises available to a user, given their goal and the equipment they
 * ticked. Intersection of (goal's library) x (their equipment), de-duplicated
 * and grouped by equipment for display.
 */
export function availableExercises(
  goal: Goal,
  owned: Equipment[],
): { equipment: Equipment; exercises: string[] }[] {
  const lib = LIBRARY[goal];
  const groups: { equipment: Equipment; exercises: string[] }[] = [];
  for (const eq of owned) {
    const list = lib[eq];
    if (list && list.length) groups.push({ equipment: eq, exercises: list });
  }
  return groups;
}

/** Flat, de-duplicated list of exercise names for a goal + equipment. */
export function flatExercises(goal: Goal, owned: Equipment[]): string[] {
  const seen = new Set<string>();
  for (const g of availableExercises(goal, owned)) {
    for (const ex of g.exercises) seen.add(ex);
  }
  return [...seen];
}

/**
 * A suggested duration (minutes) for an exercise, used as the timer's soft
 * target. Uses keyword heuristics so we don't maintain a per-exercise table:
 * long cardio > steady cardio > circuits > strength sets > short holds.
 */
export function suggestedMinutes(name: string): number {
  const n = name.toLowerCase();
  // Long-form cardio / endurance
  if (/(long-distance|endurance|long )/.test(n)) return 40;
  if (/(running|jogging|cycling|swimming|row|treadmill|elliptical|walk|hill|stair|bike|skip|rope)/.test(n)) return 30;
  // Interval / HIIT / conditioning
  if (/(interval|hiit|sprint|conditioning|circuit|burpee|mountain climber|high knee|thruster)/.test(n)) return 20;
  // Mobility / stretch / yoga / balance
  if (/(stretch|mobility|yoga|balance|warm|cool)/.test(n)) return 15;
  // Short isometric holds
  if (/(plank|l-sit|hold|hang|dead hang)/.test(n)) return 3;
  // Default: a strength block
  return 10;
}
