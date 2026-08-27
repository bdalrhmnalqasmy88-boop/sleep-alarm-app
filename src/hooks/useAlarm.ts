import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startAlarmSound,
  startCustomAlarmSound,
  type AlarmSoundType,
} from '@/lib/alarmSound';
import { NativeAlarmSound } from '@/lib/nativeAlarmSound';

export type AlarmState =
  | 'idle'
  | 'armed'
  | 'ringing'
  | 'slept'
  | 'final-ringing'
  | 'done';

type Options = {
  firstAlarmAt: Date | null;
  finalAlarmAt: Date | null;
  sound: AlarmSoundType;
  volume: number;
  customSoundUri?: string;
  onFirstFired?: () => void;
  onFinalFired?: () => void;
};

export function useAlarm({
  firstAlarmAt,
  finalAlarmAt,
  sound,
  volume,
  customSoundUri,
  onFirstFired,
  onFinalFired,
}: Options) {
  const [state, setState] = useState<AlarmState>('idle');
  const [now, setNow] = useState(() => new Date());

  const intervalRef = useRef<number | null>(null);
  const stopSoundRef = useRef<(() => void) | null>(null);

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
      sound === 'custom' && customSoundUri
        ? startCustomAlarmSound(customSoundUri, volume)
        : startAlarmSound(sound, volume);
  }, [sound, volume, customSoundUri, stopSound]);

  /*
   * هذا المؤقت مسؤول فقط عن تحديث الشاشة
   * أثناء فتح التطبيق.
   *
   * المنبه الحقيقي بعد إغلاق التطبيق
   * يتم تشغيله بواسطة Android AlarmManager.
   */
  useEffect(() => {
    if (state === 'idle' || state === 'done') {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      const t = new Date();
      setNow(t);

      if (
        state === 'armed' &&
        firstAlarmAt &&
        t.getTime() >= firstAlarmAt.getTime()
      ) {
        setState('ringing');
        startSound();
        onFirstFiredRef.current?.();

        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }

      if (
        state === 'slept' &&
        finalAlarmAt &&
        t.getTime() >= finalAlarmAt.getTime()
      ) {
        setState('final-ringing');
        startSound();
        onFinalFiredRef.current?.();

        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    state,
    firstAlarmAt,
    finalAlarmAt,
    startSound,
  ]);

  const arm = useCallback(() => {
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
    setState('idle');
  }, [stopSound]);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (stopSoundRef.current) {
        stopSoundRef.current();
        stopSoundRef.current = null;
      }
    };
  }, []);

  return {
    state,
    now,
    arm,
    dismissFirst,
    dismissFinal,
    reset,
  };
}
