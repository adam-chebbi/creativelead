import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    '[SUPABASE] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — realtime broadcasts disabled'
  );
}

export const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      })
    : null;

/**
 * Broadcast a realtime event to all dashboard subscribers for a given user.
 * Uses Supabase Broadcast channel keyed by userId.
 * Fire-and-forget — never throws.
 */
export async function broadcastToUser(
  userId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!supabase) return;
  try {
    const channel = supabase.channel(`user:${userId}`);
    await channel.send({ type: 'broadcast', event, payload });
    await supabase.removeChannel(channel);
  } catch (err) {
    console.warn('[SUPABASE] Broadcast failed:', err);
  }
}
