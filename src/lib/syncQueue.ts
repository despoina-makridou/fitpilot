import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { AdherenceLog, Goal, Outcome, StudyGroup } from '../types';

/**
 * Offline-first outbox for adherence records.
 *
 * Every adherence record (a real logged workout OR an auto-backfilled miss) is
 * first written to a LOCAL queue, then flushed to Supabase. A record is removed
 * from the queue ONLY after the DB confirms the insert succeeded. If offline or
 * the insert fails, it stays queued and is retried on the next flush (e.g. next
 * app open). A unique DB index (user_id, session_date, item_title) plus
 * upsert/ignore-on-conflict make retries idempotent — no duplicates.
 */

export interface PendingLog {
  // Dedupe key parts (must match the DB unique index).
  user_id: string;
  session_date: string; // 'YYYY-MM-DD' — the day this record is FOR
  item_title: string;
  // Payload
  group: StudyGroup;
  goal: Goal | null;
  day: number;
  outcome: Outcome;
  minutes: number;
  target_minutes: number;
  source: 'manual' | 'auto_miss';
  logged_at: string;
  // Points computed at log time (streak depends on prior sessions in window).
  points: number;
  base_points: number;
  streak_bonus: number;
}

const KEY = 'fitpilot.syncQueue';

function keyOf(p: PendingLog): string {
  return `${p.user_id}|${p.session_date}|${p.item_title}`;
}

async function readQueue(): Promise<PendingLog[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingLog[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingLog[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

/**
 * Enqueue a record (dedup by key so we never queue the same session twice),
 * then immediately attempt to flush.
 */
export async function enqueueLog(p: PendingLog): Promise<void> {
  const q = await readQueue();
  if (!q.some((x) => keyOf(x) === keyOf(p))) {
    q.push(p);
    await writeQueue(q);
  }
  await flushQueue();
}

/**
 * Try to send everything in the queue. Each item is upserted with
 * ignoreDuplicates so a retry after a lost response can't duplicate a row.
 * Items are removed from the local queue only on confirmed success.
 */
export async function flushQueue(): Promise<{ sent: number; remaining: number }> {
  let q = await readQueue();
  if (q.length === 0) return { sent: 0, remaining: 0 };

  let sent = 0;
  const stillPending: PendingLog[] = [];

  for (const p of q) {
    const row = {
      user_id: p.user_id,
      group: p.group,
      goal: p.goal,
      day: p.day,
      item_title: p.item_title,
      outcome: p.outcome,
      minutes: p.minutes,
      target_minutes: p.target_minutes,
      logged_at: p.logged_at,
      source: p.source,
      session_date: p.session_date,
      points: p.points,
      base_points: p.base_points,
      streak_bonus: p.streak_bonus,
    };

    try {
      // Upsert on the unique key; ignore duplicates so retries are safe.
      const { error } = await supabase
        .from('adherence_logs')
        .upsert(row, {
          onConflict: 'user_id,session_date,item_title',
          ignoreDuplicates: true,
        });
      if (error) {
        // Network/DB failure — keep it queued for next time.
        stillPending.push(p);
      } else {
        sent++; // confirmed delivered
      }
    } catch {
      stillPending.push(p);
    }
  }

  await writeQueue(stillPending);
  return { sent, remaining: stillPending.length };
}

/** How many records are still waiting to sync (for UI/debug). */
export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

/** True if a given session (by key parts) is already queued. */
export async function isQueued(
  userId: string,
  sessionDate: string,
  itemTitle: string,
): Promise<boolean> {
  const q = await readQueue();
  const k = `${userId}|${sessionDate}|${itemTitle}`;
  return q.some((x) => keyOf(x) === k);
}
