export function formatRating(rating: number | null | undefined): string {
  if (rating == null) return '—';
  return `${rating.toFixed(1)} Stars`;
}
