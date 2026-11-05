import { generate } from './llm';
import { Goal, Outcome, TemplateItem } from '../types';

/**
 * The "brain": turns workout context into short human text using the on-device
 * model. Only used for the AI study arm. Every function has a deterministic
 * fallback so the app never blocks on the model (and so the non-AI arm — or a
 * device where the model isn't ready — still works).
 *
 * IMPORTANT: the coach must only ever reference exercises the user can actually
 * do, so callers pass `availableExercises` (already filtered by the user's goal
 * and the equipment they own). The model is told to pick ONLY from that list.
 */

export interface CoachContext {
  goal: Goal | null;
  name?: string | null;
  /** Exercise names the user can do (goal × their equipment). May be empty. */
  availableExercises?: string[];
}

const NUDGE_SYSTEM =
  'You are a warm, concise fitness coach. Write ONE short motivating reminder ' +
  '(max 18 words). If exercises are listed, only mention ones from that list. ' +
  'No hashtags, no quotes, no lists.';

const ENCOURAGE_SYSTEM =
  'You are a warm fitness coach. In ONE short sentence (max 16 words), react to ' +
  'how the workout went. Be genuine, not cheesy. No hashtags, no quotes.';

function exerciseHint(ctx: CoachContext): string {
  const ex = ctx.availableExercises ?? [];
  if (!ex.length) return '';
  // Cap the list so the prompt stays small.
  const list = ex.slice(0, 12).join(', ');
  return ` They can only do these exercises: ${list}. Only mention exercises from this list.`;
}

/**
 * Pre-session nudge for the AI arm. Falls back to a clean plain reminder.
 */
export async function makeNudge(item: TemplateItem, ctx: CoachContext): Promise<string> {
  const fallback = cleanReminder(item, ctx.availableExercises);
  try {
    const who = ctx.name ? `The user's name is ${ctx.name}. ` : '';
    const user =
      `${who}Today's session is "${item.title}" (${item.target}). ` +
      `Their goal: ${goalLabel(ctx.goal)}.${exerciseHint(ctx)} Write the reminder.`;
    const text = await generate(NUDGE_SYSTEM, user, 48);
    return sanitize(text) || fallback;
  } catch {
    return fallback;
  }
}

/** Plain, non-AI reminder text (for the control arm). Clean, no raw ~/- chars. */
export function plainReminder(item: TemplateItem): string {
  return `Time for your ${item.title.toLowerCase()} session. Aim for about ${item.targetMinutes} minutes.`;
}

/** A friendly, well-formed reminder used as the AI fallback. */
function cleanReminder(item: TemplateItem, available?: string[]): string {
  const pick = available && available.length ? available[Math.floor(Math.random() * available.length)] : null;
  if (pick) {
    return `${item.title} today — try some ${pick.toLowerCase()} for around ${item.targetMinutes} minutes.`;
  }
  return `${item.title} today. Aim for about ${item.targetMinutes} minutes.`;
}

/**
 * Post-session encouragement for the AI arm. Reacts to the outcome.
 */
export async function makeEncouragement(
  item: TemplateItem,
  outcome: Outcome,
  minutes: number,
  ctx?: CoachContext,
): Promise<string> {
  const fallback = fallbackEncouragement(outcome, minutes);
  try {
    const who = ctx?.name ? `The user's name is ${ctx.name}. ` : '';
    const how =
      outcome === 'completed'
        ? `They completed ${minutes} minutes of ${item.title}.`
        : outcome === 'partial'
        ? `They did ${minutes} minutes of ${item.title} but could not finish.`
        : `They skipped ${item.title} today.`;
    const user = `${who}${how} Write the reaction.`;
    const text = await generate(ENCOURAGE_SYSTEM, user, 40);
    return sanitize(text) || fallback;
  } catch {
    return fallback;
  }
}

function fallbackEncouragement(outcome: Outcome, minutes: number): string {
  if (outcome === 'completed') return `Nice work! ${minutes} minutes done. That consistency really adds up.`;
  if (outcome === 'partial') return `${minutes} minutes still counts. Showing up is the hardest part.`;
  return `No worries. Tomorrow is a fresh start, and you've got this.`;
}

function goalLabel(goal: Goal | null): string {
  switch (goal) {
    case 'lose_fat': return 'lose body fat';
    case 'gain_weight': return 'gain healthy weight';
    case 'build_muscle': return 'build muscle mass';
    case 'endurance': return 'improve endurance';
    case 'maintain': return 'stay fit';
    default: return 'stay healthy';
  }
}

/** Trim model quirks: surrounding quotes, trailing junk, over-long output. */
function sanitize(text: string): string {
  let t = text.replace(/^["'`]+|["'`]+$/g, '').trim();
  // Keep to first line / first sentence-ish.
  t = t.split('\n')[0].trim();
  if (t.length > 140) t = t.slice(0, 140).replace(/\s+\S*$/, '') + '…';
  return t;
}
