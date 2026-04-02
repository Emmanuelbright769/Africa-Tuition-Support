import type { Response } from "express";

const clients = new Map<number, Set<Response>>();

export function addSseClient(userId: number, res: Response): void {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);
}

export function removeSseClient(userId: number, res: Response): void {
  clients.get(userId)?.delete(res);
  if ((clients.get(userId)?.size ?? 0) === 0) clients.delete(userId);
}

export function pushToUser(userId: number, event: string, data: unknown): void {
  const conns = clients.get(userId);
  if (!conns?.size) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of conns) {
    try { res.write(msg); } catch { conns.delete(res); }
  }
}
