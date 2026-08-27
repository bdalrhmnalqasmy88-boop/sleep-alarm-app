import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlarmClock, Bed, Bell, BellRing, CheckCircle2, Clock, Moon, RotateCcw, Sparkles, Star, Sunrise } from 'lucide-react';
import StarField from '@/components/StarField';
import MoonIcon from '@/components/MoonIcon';
import SoundSettings from '@/components/SoundSettings';
import { useAlarm } from '@/hooks/useAlarm';
import type { AlarmSoundType } from '@/lib/alarmSound';
import {
  CYCLE_MINUTES,
  computeCycles,
  formatCountdown,
  formatDuration,
  formatTimeAr,
  nearestUpcoming,
} from '@/lib/sleep';
import { loadHistory, saveSession, updateSession, genId, type SleepSession } from '@/lib/storage';
import { initializeNotifications, scheduleAlarm, cancelAlarm, cancelAllAlarms } from '@/lib/notifications';
import type { PickedAudio } from '@/lib/nativeAlarmSound';

type Phase = 'setup' | 'armed' | 'ringing' | 'slept' | 'final-ringing' | 'done';

const ALARM_ID_FIRST = 10001;
const ALARM_ID_FINAL = 10002;

export default function App() {
  const [wakeTime, setWakeTime] = useState('08:30');
  const [now, setNow] = useState(() => new Date());
  const [phase, setPhase] = useState<Phase>('setup');
  const [firstAlarmAt, setFirstAlarmAt] = useState<Date | null>(null);
  const [finalAlarmAt, setFinalAlarmAt] = useState<Date | null>(null);
  const [selectedCycles, setSelectedCycles] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<SleepSession[]>([]);
  const [sound, setSound] = useState<AlarmSoundType>('high');
  const [volume, setVolume] = useState(0.8);
  const [customSound, setCustomSoundState] = useState<PickedAudio | null>(() => {
    try { return JSON.parse(localStorage.getItem('sleep_custom_sound') || 'null'); } catch { return null; }
  });
  const setCustomSound = useCallback((value: PickedAudio) => {
    setCustomSoundState(value);
    localStorage.setItem('sleep_custom_sound', JSON.stringify(value));
  }, []);

  // load history and prepare the native alarm channel
  useEffect(() => {
    setHistory(loadHistory());
    void initializeNotifications();
  }, []);

  // live clock
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const cycleOptions = useMemo(() => computeCycles(wakeTime, now), [wakeTime, now]);
  const nearest = useMemo(() => nearestUpcoming(cycleOptions, now), [cycleOptions, now]);

  // auto-select nearest cycle
  useEffect(() => {
    if (nearest && selectedCycles === 0) {
      setSelectedCycles(nearest.cycles);
    }
  }, [nearest, selectedCycles]);

  const selectedOption = useMemo(
    () => cycleOptions.find((o) => o.cycles === selectedCycles) ?? nearest,
    [cycleOptions, selectedCycles, nearest],
  );

  const handleFirstFired = useCallback(() => {
    setPhase('ringing');
  }, []);

  const handleFinalFired = useCallback(() => {
    setPhase('final-ringing');
  }, []);

  const { arm, dismissFirst, dismissFinal, reset } = useAlarm({
    firstAlarmAt,
    finalAlarmAt,
    sound,
    volume,
    customSoundUri: customSound?.uri,
    onFirstFired: handleFirstFired,
    onFinalFired: handleFinalFired,
  });

  const handleArm = useCallback(async () => {
    if (!selectedOption) return;
    setFirstAlarmAt(selectedOption.bedtime);
    setFinalAlarmAt(selectedOption.wakeTime);
    setPhase('armed');
    arm();

    // schedule local notifications for background alarm
    await scheduleAlarm({
      id: ALARM_ID_FIRST,
      title: 'حان وقت النوم',
      body: 'المنبه الأول — ابدأ نومك الآن',
      at: selectedOption.bedtime,
      sound,
      volume,
      soundUri: sound === 'custom' ? customSound?.uri : undefined,
    });
    await scheduleAlarm({
      id: ALARM_ID_FINAL,
      title: 'موعد الاستيقاظ',
      body: 'اكتملت دورة نوم سليمة — استيقظ بنشاط',
      at: selectedOption.wakeTime,
      sound,
      volume,
      soundUri: sound === 'custom' ? customSound?.uri : undefined,
    });

    // save session locally
    const session: SleepSession = {
      id: genId(),
      wake_time: wakeTime,
      bedtime: selectedOption.bedtime.toISOString(),
      final_wake: selectedOption.wakeTime.toISOString(),
      cycles: selectedOption.cycles,
      duration_min: selectedOption.durationMin,
      completed: false,
      created_at: new Date().toISOString(),
    };
    saveSession(session);
    setSessionId(session.id);
    setHistory(loadHistory());
  }, [selectedOption, wakeTime, arm, sound, volume, customSound]);

  const handleDismissFirst = useCallback(async () => {
    dismissFirst();
    setPhase('slept');
    await cancelAlarm(ALARM_ID_FIRST);
    if (sessionId) {
      updateSession(sessionId, { bedtime: new Date().toISOString() });
    }
  }, [dismissFirst, sessionId]);

  const handleDismissFinal = useCallback(async () => {
    dismissFinal();
    setPhase('done');
    await cancelAllAlarms();
    if (sessionId) {
      updateSession(sessionId, { completed: true });
      setHistory(loadHistory());
    }
  }, [dismissFinal, sessionId]);

  const handleReset = useCallback(async () => {
    reset();
    setPhase('setup');
    setFirstAlarmAt(null);
    setFinalAlarmAt(null);
    setSessionId(null);
    setSelectedCycles(0);
    await cancelAllAlarms();
  }, [reset]);

  const countdownToFirst = firstAlarmAt ? firstAlarmAt.getTime() - now.getTime() : 0;
  const countdownToFinal = finalAlarmAt ? finalAlarmAt.getTime() - now.getTime() : 0;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <StarField />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-5 pb-10 pt-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MoonIcon className="h-11 w-11 animate-float" />
            <div>
              <h1 className="text-xl font-bold text-moon-50">منبه دورات النوم</h1>
              <p className="text-xs text-moon-300/70">نَم بذكاء، استيقظ بنشاط</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-mono text-2xl font-semibold text-moon-100 tabular-nums">
              {formatTimeAr(now)}
            </span>
            <span className="text-[11px] text-moon-300/60">
              {now.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
        </header>

        {/* Main card */}
        <main className="flex flex-1 flex-col gap-5">
          {phase === 'setup' && (
            <SetupView
              wakeTime={wakeTime}
              setWakeTime={setWakeTime}
              cycleOptions={cycleOptions}
              nearest={nearest}
              selectedCycles={selectedCycles}
              setSelectedCycles={setSelectedCycles}
              selectedOption={selectedOption}
              onArm={handleArm}
              sound={sound}
              setSound={setSound}
              volume={volume}
              setVolume={setVolume}
               customSoundUri={customSound?.uri}
               customSoundName={customSound?.name}
               setCustomSound={setCustomSound}
            />
          )}

          {phase === 'armed' && selectedOption && (
            <ArmedView
              firstAlarmAt={firstAlarmAt!}
              finalAlarmAt={finalAlarmAt!}
              cycles={selectedOption.cycles}
              countdown={countdownToFirst}
              onCancel={handleReset}
            />
          )}

          {phase === 'ringing' && (
            <RingingView
              title="حان وقت النوم"
              subtitle={`المنبه الأول — ابدأ نومك الآن`}
              icon={<BellRing className="h-16 w-16" />}
              onDismiss={handleDismissFirst}
            />
          )}

          {phase === 'slept' && finalAlarmAt && (
            <SleepingView finalAlarmAt={finalAlarmAt} countdown={countdownToFinal} onCancel={handleReset} />
          )}

          {phase === 'final-ringing' && (
            <RingingView
              title="موعد الاستيقاظ"
              subtitle="اكتملت دورة نوم سليمة — استيقظ بنشاط"
              icon={<Sunrise className="h-16 w-16" />}
              onDismiss={handleDismissFinal}
            />
          )}

          {phase === 'done' && (
            <DoneView selectedOption={selectedOption} onReset={handleReset} />
          )}
        </main>

        {/* History */}
        {history.length > 0 && phase === 'setup' && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-moon-200">
              <Clock className="h-4 w-4" /> آخر الجلسات
            </h2>
            <div className="space-y-2">
              {history.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-night-700/60 bg-night-800/40 px-4 py-3 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-moon-700/30">
                      <Moon className="h-4 w-4 text-moon-300" />
                    </div>
                    <div>
                      <p className="text-sm text-moon-100">
                        استيقاظ {formatTimeAr(new Date(s.final_wake))}
                      </p>
                      <p className="text-[11px] text-moon-300/60">
                        {s.cycles} دورات · {formatDuration(s.duration_min)}
                      </p>
                    </div>
                  </div>
                  {s.completed ? (
                    <span className="flex items-center gap-1 text-xs text-accent-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> مكتملة
                    </span>
                  ) : (
                    <span className="text-xs text-moon-300/50">قيد التتبع</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-10 text-center text-[11px] text-moon-300/40">
          كل دورة نوم = {CYCLE_MINUTES} دقيقة · صُمّم لنوم أعمق وأصحّ
        </footer>
      </div>
    </div>
  );
}

/* ---------- Sub views ---------- */

function SetupView(props: {
  wakeTime: string;
  setWakeTime: (v: string) => void;
  cycleOptions: ReturnType<typeof computeCycles>;
  nearest: ReturnType<typeof nearestUpcoming>;
  selectedCycles: number;
  setSelectedCycles: (n: number) => void;
  selectedOption: ReturnType<typeof computeCycles>[number] | null;
  onArm: () => void;
  sound: AlarmSoundType;
  setSound: (s: AlarmSoundType) => void;
  volume: number;
  setVolume: (v: number) => void;
  customSoundUri?: string;
  customSoundName?: string;
  setCustomSound: (value: PickedAudio) => void;
}) {
  const { wakeTime, setWakeTime, cycleOptions, nearest, selectedCycles, setSelectedCycles, selectedOption, onArm, sound, setSound, volume, setVolume, customSoundUri, customSoundName, setCustomSound } = props;

  return (
    <div className="flex flex-col gap-6">
      {/* Wake time picker */}
      <div className="rounded-2xl border border-night-700/50 bg-night-800/40 p-6 backdrop-blur-md shadow-glow">
        <label className="mb-3 flex items-center gap-2 text-sm font-medium text-moon-200">
          <Sunrise className="h-5 w-5 text-gold-300" /> موعد الاستيقاظ النهائي
        </label>
        <div className="flex items-center gap-4">
          <input
            type="time"
            value={wakeTime}
            onChange={(e) => {
              setWakeTime(e.target.value);
              setSelectedCycles(0);
            }}
            className="w-full rounded-xl border border-night-600 bg-night-900/60 px-4 py-4 text-center text-3xl font-bold text-moon-50 outline-none transition focus:border-moon-500 focus:shadow-glow"
          />
        </div>
        <p className="mt-3 text-xs text-moon-300/60">
          سيتم حساب أوقات النوم المثالية للخلف من هذا الموعد بدورات مدتها 90 دقيقة.
        </p>
      </div>

      {/* Sound settings */}
      <SoundSettings sound={sound} setSound={setSound} volume={volume} setVolume={setVolume} customSoundUri={customSoundUri} customSoundName={customSoundName} setCustomSound={setCustomSound} />

      {/* Cycle options */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-moon-200">
          <Sparkles className="h-4 w-4 text-accent-400" /> أوقات بداية النوم المقترحة
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cycleOptions.map((opt) => {
            const isNearest = nearest?.cycles === opt.cycles;
            const isSelected = selectedCycles === opt.cycles;
            return (
              <button
                key={opt.cycles}
                onClick={() => setSelectedCycles(opt.cycles)}
                className={`group relative overflow-hidden rounded-2xl border p-4 text-right transition-all duration-300 ${
                  isSelected
                    ? 'border-accent-400 bg-accent-500/10 shadow-glow-accent'
                    : isNearest
                      ? 'border-moon-400/60 bg-moon-700/20'
                      : 'border-night-700/50 bg-night-800/30 hover:border-moon-500/50 hover:bg-night-700/40'
                }`}
              >
                {isNearest && (
                  <span className="absolute left-2 top-2 rounded-full bg-moon-500/20 px-2 py-0.5 text-[10px] text-moon-200">
                    الأقرب
                  </span>
                )}
                <div className="mb-1 flex items-center gap-1.5">
                  <Bed className="h-4 w-4 text-moon-300" />
                  <span className="text-lg font-bold text-moon-50 tabular-nums">{formatTimeAr(opt.bedtime)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-moon-300/70">
                  <span>{opt.cycles} دورات</span>
                  <span>{formatDuration(opt.durationMin)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary + arm */}
      {selectedOption && (
        <div className="rounded-2xl border border-night-700/50 bg-night-800/40 p-6 backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-moon-200">
              <Moon className="h-4 w-4 text-moon-300" />
              <span>النوم في</span>
              <span className="font-bold text-moon-50">{formatTimeAr(selectedOption.bedtime)}</span>
            </div>
            <div className="flex items-center gap-2 text-moon-200">
              <Sunrise className="h-4 w-4 text-gold-300" />
              <span>الاستيقاظ في</span>
              <span className="font-bold text-moon-50">{formatTimeAr(selectedOption.wakeTime)}</span>
            </div>
          </div>
          <button
            onClick={onArm}
            className="group flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-l from-moon-600 to-accent-600 px-6 py-4 text-lg font-bold text-white shadow-glow-accent transition-all duration-300 hover:scale-[1.02] hover:shadow-glow active:scale-95"
          >
            <AlarmClock className="h-6 w-6 transition-transform group-hover:rotate-12" />
            تفعيل المنبه
          </button>
        </div>
      )}
    </div>
  );
}

function ArmedView(props: {
  firstAlarmAt: Date;
  finalAlarmAt: Date;
  cycles: number;
  countdown: number;
  onCancel: () => void;
}) {
  const { firstAlarmAt, finalAlarmAt, cycles, countdown, onCancel } = props;
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative mt-4 flex h-32 w-32 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-accent-500/20 animate-pulse-ring" />
        <span className="absolute inset-2 rounded-full bg-accent-500/10 animate-pulse-ring" style={{ animationDelay: '0.4s' }} />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-accent-400/40 bg-night-800/60 backdrop-blur-md">
          <Bell className="h-10 w-10 text-accent-400" />
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-moon-300/70">المنبه الأول يرن بعد</p>
        <p className="mt-1 font-mono text-4xl font-bold text-moon-50 tabular-nums">{formatCountdown(countdown)}</p>
      </div>

      <div className="grid w-full grid-cols-2 gap-3">
        <InfoTile icon={<Bed className="h-5 w-5" />} label="وقت النوم" value={formatTimeAr(firstAlarmAt)} />
        <InfoTile icon={<Sunrise className="h-5 w-5" />} label="وقت الاستيقاظ" value={formatTimeAr(finalAlarmAt)} />
      </div>

      <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-night-700/50 bg-night-800/40 px-4 py-3 text-sm text-moon-200">
        <Star className="h-4 w-4 text-gold-300" />
        {cycles} دورات نوم مكتملة · {formatDuration(cycles * CYCLE_MINUTES)}
      </div>

      <button
        onClick={onCancel}
        className="flex items-center gap-2 rounded-xl border border-night-600 bg-night-800/50 px-6 py-3 text-sm text-moon-200 transition hover:bg-night-700/50"
      >
        <RotateCcw className="h-4 w-4" /> إلغاء
      </button>
    </div>
  );
}

function RingingView(props: { title: string; subtitle: string; icon: React.ReactNode; onDismiss: () => void }) {
  const { title, subtitle, icon, onDismiss } = props;
  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="relative flex h-40 w-40 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-gold-400/20 animate-pulse-ring" />
        <span className="absolute inset-3 rounded-full bg-gold-400/10 animate-pulse-ring" style={{ animationDelay: '0.3s' }} />
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-gold-300/40 bg-night-800/70 backdrop-blur-md text-gold-300">
          {icon}
        </div>
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-moon-50">{title}</h2>
        <p className="mt-1 text-sm text-moon-300/70">{subtitle}</p>
      </div>
      <button
        onClick={onDismiss}
        className="w-full rounded-xl bg-gradient-to-l from-gold-500 to-gold-400 px-6 py-5 text-xl font-bold text-night-950 shadow-glow-gold transition-all duration-300 hover:scale-[1.02] active:scale-95"
      >
        إيقاف المنبه
      </button>
    </div>
  );
}

function SleepingView(props: { finalAlarmAt: Date; countdown: number; onCancel: () => void }) {
  const { finalAlarmAt, countdown, onCancel } = props;
  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <MoonIcon className="h-28 w-28 animate-breathe" />
      <div className="text-center">
        <h2 className="text-xl font-bold text-moon-50">نوم هانئ…</h2>
        <p className="mt-1 text-sm text-moon-300/70">تم تسجيل بدء النوم. المنبه النهائي مضبوط على</p>
        <p className="mt-1 text-lg font-bold text-gold-300">{formatTimeAr(finalAlarmAt)}</p>
      </div>

      <div className="w-full rounded-2xl border border-night-700/50 bg-night-800/40 p-6 text-center backdrop-blur-md">
        <p className="text-sm text-moon-300/70">الاستيقاظ بعد</p>
        <p className="mt-2 font-mono text-4xl font-bold text-moon-50 tabular-nums">{formatCountdown(countdown)}</p>
      </div>

      <button
        onClick={onCancel}
        className="flex items-center gap-2 rounded-xl border border-night-600 bg-night-800/50 px-6 py-3 text-sm text-moon-200 transition hover:bg-night-700/50"
      >
        <RotateCcw className="h-4 w-4" /> إلغاء
      </button>
    </div>
  );
}

function DoneView(props: { selectedOption: ReturnType<typeof computeCycles>[number] | null; onReset: () => void }) {
  const { selectedOption, onReset } = props;
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-accent-500/15 text-accent-400 shadow-glow-accent">
        <CheckCircle2 className="h-14 w-14" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-moon-50">صباح الخير!</h2>
        <p className="mt-2 text-sm text-moon-300/70">
          أكملت {selectedOption?.cycles ?? 0} دورات نوم · {selectedOption ? formatDuration(selectedOption.durationMin) : ''}
        </p>
        <p className="mt-1 text-sm text-accent-400">نوم سليم يبدأ بدورة مكتملة</p>
      </div>
      <button
        onClick={onReset}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-moon-600 to-accent-600 px-8 py-3.5 font-bold text-white shadow-glow-accent transition hover:scale-[1.02] active:scale-95"
      >
        <RotateCcw className="h-5 w-5" /> جلسة نوم جديدة
      </button>
    </div>
  );
}

function InfoTile(props: { icon: React.ReactNode; label: string; value: string }) {
  const { icon, label, value } = props;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-night-700/50 bg-night-800/40 px-4 py-3 backdrop-blur-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-night-700/40 text-moon-300">{icon}</div>
      <div>
        <p className="text-[11px] text-moon-300/60">{label}</p>
        <p className="font-bold text-moon-50 tabular-nums">{value}</p>
      </div>
    </div>
  );
}
