import { useCallback, useEffect, useRef, useState } from 'react';
import { startAlarmSound, startCustomAlarmSound, type AlarmSoundType } from '@/lib/alarmSound';

export type AlarmState = 'idle' | 'armed' | 'ringing' | 'slept' | 'final-ringing' | 'done';

type Options = {
  firstAlarmAt: Date | null;
  finalAlarmAt: Date | null;
  sound: AlarmSoundType;
  volume: number;
  customSoundUri?: string;
  onFirstFired?: () => void;
  onFinalFired?: () => void;
};

export function useAlarm({ firstAlarmAt, finalAlarmAt, sound, volume, customSoundUri, onFirstFired, onFinalFired }: Options) {
  const [state, setState] = useState<AlarmState>('idle');
  const [now, setNow] = useState(() => new Date());
  const intervalRef = useRef<number | null>(null);
  const stopSoundRef = useRef<(() => void) | null>(null);
  const firedFirstRef = useRef(false);
  const firedFinalRef = useRef(false);

  // keep latest callbacks in refs so the tick effect doesn't restart on every render
  const onFirstFiredRef = useRef(onFirstFired);
  const onFinalFiredRef = useRef(onFinalFired);
  useEffect(() => {
    onFirstFiredRef.current = onFirstFired;
  }, [onFirstFired]);
  useEffect(() => {
    onFinalFiredRef.current = onFinalFired;
  }, [onFinalFired]);

  const stopSound = useCallback(() => {
    if (stopSoundRef.current) {
      stopSoundRef.current();
      stopSoundRef.current = null;
    }
  }, []);

  const startSound = useCallback(() => {
    stopSound();
    stopSoundRef.current =
      sound === 'custom' && customSoundUri ? startCustomAlarmSound(customSoundUri, volume) : startAlarmSound(sound, volume);
  }, [sound, volume, customSoundUri, stopSound]);

  // main tick
  useEffect(() => {
    if (state === 'idle' || state === 'done') {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      stopSound();
      return;
    }

    intervalRef.current = window.setInterval(() => {
      const t = new Date();
      setNow(t);

      if (state === 'armed' && firstAlarmAt && !firedFirstRef.current && t.getTime() >= firstAlarmAt.getTime()) {
        firedFirstRef.current = true;
        setState('ringing');
        startSound();
        onFirstFiredRef.current?.();
      }

      if (state === 'slept' && finalAlarmAt && !firedFinalRef.current && t.getTime() >= finalAlarmAt.getTime()) {
        firedFinalRef.current = true;
        setState('final-ringing');
        startSound();
        onFinalFiredRef.current?.();
      }
    }, 250);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state, firstAlarmAt, finalAlarmAt, startSound, stopSound]);

  const arm = useCallback(() => {
    firedFirstRef.current = false;
    firedFinalRef.current = false;
    setState('armed');
  }, []);

  const dismissFirst = useCallback(() => {
    stopSound();
    setState('slept');
  }, [stopSound]);

  const dismissFinal = useCallback(() => {
    stopSound();
    setState('done');
  }, [stopSound]);

  const reset = useCallback(() => {
    stopSound();
    firedFirstRef.current = false;
    firedFinalRef.current = false;
    setState('idle');
  }, [stopSound]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      stopSound();
    };
  }, [stopSound]);

  return { state, now, arm, dismissFirst, dismissFinal, reset };
}
