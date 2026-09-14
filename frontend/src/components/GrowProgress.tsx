const DAY_MS = 86400000;
const DEFAULT_GROW_DAYS = 98;

export function growProgressPercent(grow: {
  start_date: string;
  end_date: string | null;
  status: string;
}): number {
  if (!grow.start_date) return 0;
  if (grow.status === "completed") return 100;

  const parseDay = (s: string) => new Date(`${s}T00:00:00Z`).getTime();

  const start = parseDay(grow.start_date);
  const end = grow.end_date ? parseDay(grow.end_date) : start + DEFAULT_GROW_DAYS * DAY_MS;
  const total = end - start;
  if (total <= 0) return grow.end_date ? 100 : 0;

  const today = parseDay(new Date().toISOString().slice(0, 10));
  const pct = Math.floor(((today - start) / total) * 100);
  return Math.max(0, Math.min(100, pct));
}

export function growProgressDays(grow: {
  start_date: string;
  end_date: string | null;
  status: string;
}): { day: number; total: number } | null {
  if (!grow.start_date) return null;
  if (grow.status === "completed") return null;

  const parseDay = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
  const start = parseDay(grow.start_date);
  const end = grow.end_date ? parseDay(grow.end_date) : start + DEFAULT_GROW_DAYS * DAY_MS;
  const total = Math.round((end - start) / DAY_MS);
  if (total <= 0) return null;

  const today = parseDay(new Date().toISOString().slice(0, 10));
  const day = Math.floor((today - start) / DAY_MS);
  return { day: Math.max(0, day), total };
}

export function growCurrentWeek(grow: {
  start_date: string;
  end_date: string | null;
  status: string;
}): number | null {
  if (!grow.start_date || grow.status === "completed") return null;

  const parseDay = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
  const start = parseDay(grow.start_date);
  const end = grow.end_date ? parseDay(grow.end_date) : start + DEFAULT_GROW_DAYS * DAY_MS;
  const total = Math.round((end - start) / DAY_MS);
  if (total <= 0) return null;

  const today = parseDay(new Date().toISOString().slice(0, 10));
  const day = Math.floor((today - start) / DAY_MS);
  if (day < 0) return null;
  return Math.min(Math.floor(day / 7) + 1, Math.ceil(total / 7));
}

export function growEstimatedEnd(grow: {
  start_date: string;
  end_date: string | null;
  status: string;
}): string | null {
  if (!grow.start_date || grow.end_date) return null;
  if (grow.status === "completed") return null;
  const start = new Date(`${grow.start_date}T00:00:00Z`);
  const est = new Date(start.getTime() + DEFAULT_GROW_DAYS * DAY_MS);
  return est.toISOString().slice(0, 10);
}

export default function GrowProgress({ grow }: { grow: { start_date: string; end_date: string | null; status: string } }) {
  const pct = growProgressPercent(grow);
  const days = growProgressDays(grow);
  return (
    <div className="grow-progress" title={days ? `Tag ${days.day} von ${days.total}` : `${pct}%`}>
      <div className="grow-progress-track">
        <div className="grow-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="grow-progress-label">
        {days ? `(${days.day}/${days.total}) ` : ""}{pct}%
      </span>
    </div>
  );
}