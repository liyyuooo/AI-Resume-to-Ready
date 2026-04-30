import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Resume, InterviewSession, UserSettings } from '@/types';

interface ResumeAIDB extends DBSchema {
  resumes: {
    key: string;
    value: Resume;
    indexes: { 'by-date': string };
  };
  interviews: {
    key: string;
    value: InterviewSession;
    indexes: { 'by-date': string; 'by-resume': string };
  };
  settings: {
    key: string;
    value: UserSettings;
  };
}

const DB_NAME = 'resume-ai-assistant';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ResumeAIDB>> | null = null;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ResumeAIDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 简历存储
        if (!db.objectStoreNames.contains('resumes')) {
          const resumeStore = db.createObjectStore('resumes', { keyPath: 'id' });
          resumeStore.createIndex('by-date', 'updatedAt');
        }

        // 面试记录存储
        if (!db.objectStoreNames.contains('interviews')) {
          const interviewStore = db.createObjectStore('interviews', { keyPath: 'id' });
          interviewStore.createIndex('by-date', 'updatedAt');
          interviewStore.createIndex('by-resume', 'resumeId');
        }

        // 设置存储
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// 简历相关操作
export async function saveResume(resume: Resume): Promise<void> {
  const db = await getDB();
  await db.put('resumes', resume);
}

export async function getResume(id: string): Promise<Resume | undefined> {
  const db = await getDB();
  return db.get('resumes', id);
}

export async function getAllResumes(): Promise<Resume[]> {
  const db = await getDB();
  const resumes = await db.getAllFromIndex('resumes', 'by-date');
  return resumes.reverse();
}

export async function deleteResume(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('resumes', id);
}

// 面试记录相关操作
export async function saveInterview(interview: InterviewSession): Promise<void> {
  const db = await getDB();
  await db.put('interviews', interview);
}

export async function getInterview(id: string): Promise<InterviewSession | undefined> {
  const db = await getDB();
  return db.get('interviews', id);
}

export async function getInterviewsByResume(resumeId: string): Promise<InterviewSession[]> {
  const db = await getDB();
  return db.getAllFromIndex('interviews', 'by-resume', resumeId);
}

export async function getAllInterviews(): Promise<InterviewSession[]> {
  const db = await getDB();
  const interviews = await db.getAllFromIndex('interviews', 'by-date');
  return interviews.reverse();
}

export async function deleteInterview(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('interviews', id);
}

// 设置相关操作
const SETTINGS_ID = 'user-settings';

export async function saveSettings(settings: UserSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', { ...settings, id: SETTINGS_ID } as UserSettings & { id: string });
}

export async function getSettings(): Promise<UserSettings | undefined> {
  const db = await getDB();
  const result = await db.get('settings', SETTINGS_ID);
  if (result) {
    const settings = result as UserSettings & { id: string };
    delete (settings as { id?: string }).id;
    return settings;
  }
  return undefined;
}
