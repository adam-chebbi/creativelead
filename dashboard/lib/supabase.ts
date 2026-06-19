import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnon);

/**
 * Subscribe to realtime events for the current user.
 * Returns an unsubscribe function.
 */
export function subscribeToUserChannel(
  userId: string,
  onEvent: (event: string, payload: Record<string, unknown>) => void
) {
  const channel = supabase.channel(`user:${userId}`);

  channel
    .on('broadcast', { event: '*' }, ({ event, payload }) => {
      onEvent(event as string, payload as Record<string, unknown>);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}
