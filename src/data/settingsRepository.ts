import { db } from './db';
import type { Settings } from '../domain/types';

const SETTINGS_ID = 1;

const DEFAULT_SETTINGS: Settings = {
  constraints: [],
  recencyWindowWeeks: 4,
};

export async function getSettings(): Promise<Settings> {
  const record = await db.settings.get(SETTINGS_ID);
  if (!record) return { ...DEFAULT_SETTINGS };
  const { id: _id, ...settings } = record;
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put({ id: SETTINGS_ID, ...settings });
}
