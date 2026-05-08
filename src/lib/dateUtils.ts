/** Relative time label for ISO timestamps (shared across screens). */
export function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const t = d.getTime();
  if (t >= dayStart) return 'Today';
  if (t >= yStart) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
