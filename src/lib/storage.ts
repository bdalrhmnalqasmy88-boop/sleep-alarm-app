export type SleepSession = {
  id: string;
  wake_time: string;
  bedtime: string;
  final_wake: string;
  cycles: number;
  duration_min: number;
  completed: boolean;
  created_at: string;
};

const STORAGE_KEY = 'sleep_cycle_alarm_history';

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

export function loadHistory(): SleepSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed as SleepSession[];
  } catch {
    return [];
  }
}

export function saveSession(session: SleepSession): void {
  try {
    const history = loadHistory();
    history.unshift(session);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(history.slice(0, 50))
    );
  } catch {
    // Ignore storage errors
  }
}

export function updateSession(
  id: string,
  updates: Partial<SleepSession>
): void {
  try {
    const history = loadHistory();

    const updated = history.map((session) =>
      session.id === id
        ? { ...session, ...updates }
        : session
    );

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    );
  } catch {
    // Ignore storage errors
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
