import type { SleepSession } from './storage';

type AlarmConfig = {
  id: number;
  title: string;
  body: string;
  at: Date;
  sound: string;
  volume: number;
  soundUri?: string;
};

const isCapacitor = typeof window !== 'undefined' && typeof window.Capacitor !== 'undefined';

async function getLocalNotifications() {
  if (!isCapacitor) return null;
  try {
    const mod = await import('@capacitor/local-notifications');
    return mod.LocalNotifications;
  } catch {
    return null;
  }
}

export async function initializeNotifications(): Promise<void> {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return;
  try {
    const { NativeAlarmSound } = await import('./nativeAlarmSound');
    await NativeAlarmSound.configureChannel({ channelId: 'alarm-channel' });
  } catch {
    try {
      await LocalNotifications.createChannel({
        id: 'alarm-channel',
        name: 'Sleep alarms',
        description: 'Sleep Cycle Alarm notifications',
        importance: 5,
        sound: undefined,
        vibration: true,
      });
    } catch {
      // channel may already exist
    }
  }
}

export async function configureAlarmChannel(soundUri?: string): Promise<string> {
  const channelId = soundUri
    ? `alarm-channel-${Array.from(soundUri).reduce((hash, char) => ((hash * 31 + char.charCodeAt(0)) | 0), 0).toString(36).replace('-', 'n')}`
    : 'alarm-channel';

  try {
    const { NativeAlarmSound } = await import('./nativeAlarmSound');
    const result = await NativeAlarmSound.configureChannel({ channelId, soundUri });
    return result.channelId;
  } catch {
    // Fall back to the standard notification channel if the native plugin is unavailable.
  }
  return 'alarm-channel';
}

export async function scheduleAlarm(config: AlarmConfig): Promise<void> {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return;

  const channelId = await configureAlarmChannel(config.soundUri);
  try {
    const { NativeAlarmSound } = await import('./nativeAlarmSound');
    await NativeAlarmSound.scheduleAlarm({
      id: config.id,
      atMillis: config.at.getTime(),
      soundUri: config.soundUri,
      title: config.title,
      body: config.body,
      volume: config.volume,
    });
  } catch {
    // Local notification remains as a fallback.
  }
  try {
    await LocalNotifications.requestPermissions();
  } catch {
    // permissions may already be granted
  }

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: config.id,
          title: config.title,
          body: config.body,
          schedule: { at: config.at },
          sound: undefined,
          smallIcon: 'ic_stat_icon',
          largeIcon: 'ic_launcher',
          channelId,
          ongoing: true,
        },
      ],
    });
  } catch {
    // notification scheduling failed — app still works in foreground
  }
}

export async function cancelAlarm(id: number): Promise<void> {
  try {
    const { NativeAlarmSound } = await import('./nativeAlarmSound');
    await NativeAlarmSound.cancelAlarm({ id });
  } catch {
    // Native alarm may be unavailable on web.
  }
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    // ignore
  }
}

export async function cancelAllAlarms(): Promise<void> {
  const LocalNotifications = await getLocalNotifications();
  if (!LocalNotifications) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }
  } catch {
    // ignore
  }
}

export function makeSessionFromAlarm(
  wakeTime: string,
  bedtime: Date,
  wakeDate: Date,
  cycles: number,
  durationMin: number,
): SleepSession {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
    wake_time: wakeTime,
    bedtime: bedtime.toISOString(),
    final_wake: wakeDate.toISOString(),
    cycles,
    duration_min: durationMin,
    completed: false,
    created_at: new Date().toISOString(),
  };
}
