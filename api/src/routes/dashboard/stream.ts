import { Router, Request, Response } from 'express';

export const streamRouter = Router();

// Map of userId -> Set of active Express Response objects
export const clients = new Map<string, Set<Response>>();

/**
 * GET /api/dashboard/stream
 * Establishes an SSE connection for real-time updates.
 */
streamRouter.get('/', (req: Request, res: Response) => {
  const userId = req.userId; // Provided by dashboardAuth middleware

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // For Nginx

  // Send an initial heartbeat
  res.write('event: connected\ndata: {"status":"ok"}\n\n');

  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add(res);

  // Keep the connection alive
  const heartbeat = setInterval(() => {
    res.write('event: ping\ndata: {}\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const userClients = clients.get(userId);
    if (userClients) {
      userClients.delete(res);
      if (userClients.size === 0) {
        clients.delete(userId);
      }
    }
  });
});

/**
 * Helper to emit an event to a specific user.
 */
export function emitToUser(userId: string, eventName: string, payload: any) {
  const userClients = clients.get(userId);
  if (!userClients) return;
  const dataString = JSON.stringify(payload);
  for (const client of userClients) {
    client.write(`event: ${eventName}\ndata: ${dataString}\n\n`);
  }
}
