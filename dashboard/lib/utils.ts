import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

export function timeAgo(date: string | Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60)  return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function stageColor(stage: string): string {
  const map: Record<string, string> = {
    New: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    Contacted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Replied: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Closed: 'bg-green-500/20 text-green-400 border-green-500/30',
    Unsubscribed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return map[stage] ?? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
}
