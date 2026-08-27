import { registerPlugin } from '@capacitor/core';

export type PickedAudio = {
  uri: string;
  name: string;
};

export interface AlarmSoundPlugin {
  pickAudio(): Promise<PickedAudio>;
  configureChannel(options: { soundUri?: string; channelId: string }): Promise<{ channelId: string }>;
  scheduleAlarm(options: {
    id: number;
    atMillis: number;
    soundUri?: string;
    title: string;
    body: string;
    volume?: number;
  }): Promise<void>;
  cancelAlarm(options: { id: number }): Promise<void>;
}

export const NativeAlarmSound = registerPlugin<AlarmSoundPlugin>('AlarmSound');
