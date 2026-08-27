export type AlarmSoundType = 'high' | 'annoying' | 'gradual' | 'bell' | 'custom';

export const ALARM_SOUNDS: { id: AlarmSoundType; label: string; description: string }[] = [
  { id: 'high', label: 'نغمة عالية', description: 'صفير حاد وواضح' },
  { id: 'annoying', label: 'نغمة مزعجة', description: 'إشارات متناوبة سريعة' },
  { id: 'gradual', label: 'استيقاظ تدريجي', description: 'صوت يتصاعد بهدوء' },
  { id: 'bell', label: 'جرس قوي', description: 'رنين عميق متكرر' },
];

type StopFn = () => void;

function createCtx(): AudioContext {
  const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio is not supported');
  return new AudioContextClass();
}

/** Play a single sine beep. */
function beep(ctx: AudioContext, freq: number, vol: number, start: number, dur: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(vol * 0.6, start + dur * 0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/** Bell-like note with harmonics. */
function bellNote(ctx: AudioContext, vol: number, start: number) {
  const harmonics = [1, 2, 2.4, 3];
  const freqs = [587, 1175, 1408, 1761];
  harmonics.forEach((_, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqs[i], start);
    const peak = vol * (1 / (i + 1));
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 1.3);
  });
}

/**
 * Start a looping alarm sound. Returns a stop function.
 * `volume` is 0..1. The sound loops until `stop()` is called.
 */
export function startAlarmSound(sound: AlarmSoundType, volume: number): StopFn {
  if (sound === 'custom') return () => undefined;
  const ctx = createCtx();
  if (ctx.state === 'suspended') ctx.resume();
  const vol = Math.max(0.001, Math.min(1, volume));
  let intervalId: number | null = null;
  let elapsedLoops = 0;

  const schedule = () => {
    const now = ctx.currentTime;
    switch (sound) {
      case 'high': {
        // two quick high beeps per cycle
        beep(ctx, 1000, vol, now + 0, 0.15, 'sine');
        beep(ctx, 1000, vol, now + 0.25, 0.15, 'sine');
        break;
      }
      case 'annoying': {
        // alternating square-wave tones, fast
        beep(ctx, 800, vol, now + 0, 0.1, 'square');
        beep(ctx, 1200, vol, now + 0.15, 0.1, 'square');
        beep(ctx, 800, vol, now + 0.3, 0.1, 'square');
        beep(ctx, 1200, vol, now + 0.45, 0.1, 'square');
        break;
      }
      case 'gradual': {
        // volume ramps up over ~8 loops (~16s), then stays at full
        const rampVol = Math.min(vol, vol * (0.15 + elapsedLoops * 0.12));
        const f = 523; // C5
        beep(ctx, f, rampVol, now + 0, 0.4, 'sine');
        beep(ctx, f * 1.5, rampVol * 0.7, now + 0.5, 0.4, 'sine');
        elapsedLoops++;
        break;
      }
      case 'bell': {
        bellNote(ctx, vol, now + 0);
        break;
      }
    }
  };

  const intervals: Record<AlarmSoundType, number> = {
    high: 700,
    annoying: 650,
    gradual: 1100,
    bell: 1500,
    custom: 1000,
  };

  schedule();
  intervalId = window.setInterval(schedule, intervals[sound]);

  return () => {
    if (intervalId !== null) window.clearInterval(intervalId);
    intervalId = null;
    // fade out any remaining sound quickly
    try {
      const master = ctx.createGain();
      master.gain.setValueAtTime(1, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
      master.connect(ctx.destination);
    } catch {
      // context may be closed
    }
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // already closed
      }
    }, 200);
  };
}

/** Play a user-selected Android audio URI while the app is visible. */
export function startCustomAlarmSound(uri: string, volume: number): StopFn {
  const audio = new Audio(uri);
  audio.loop = true;
  audio.volume = Math.max(0, Math.min(1, volume));
  void audio.play().catch(() => undefined);
  return () => {
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute('src');
    audio.load();
  };
}

/** Play a one-shot preview of a sound (non-looping, ~1.5s). */
export function previewSound(sound: AlarmSoundType, volume: number): StopFn {
  if (sound === 'custom') return () => undefined;
  const ctx = createCtx();
  if (ctx.state === 'suspended') ctx.resume();
  const vol = Math.max(0.001, Math.min(1, volume));
  const now = ctx.currentTime;

  switch (sound) {
    case 'high':
      beep(ctx, 1000, vol, now + 0, 0.15, 'sine');
      beep(ctx, 1000, vol, now + 0.25, 0.15, 'sine');
      beep(ctx, 1000, vol, now + 0.5, 0.15, 'sine');
      break;
    case 'annoying':
      beep(ctx, 800, vol, now + 0, 0.1, 'square');
      beep(ctx, 1200, vol, now + 0.15, 0.1, 'square');
      beep(ctx, 800, vol, now + 0.3, 0.1, 'square');
      beep(ctx, 1200, vol, now + 0.45, 0.1, 'square');
      break;
    case 'gradual':
      beep(ctx, 523, vol * 0.5, now + 0, 0.4, 'sine');
      beep(ctx, 784, vol * 0.7, now + 0.5, 0.4, 'sine');
      beep(ctx, 523, vol, now + 1.0, 0.4, 'sine');
      break;
    case 'bell':
      bellNote(ctx, vol, now + 0);
      bellNote(ctx, vol * 0.7, now + 0.75);
      break;
  }

  return () => {
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // already closed
      }
    }, 100);
  };
}
