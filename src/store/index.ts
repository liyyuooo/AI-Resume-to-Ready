import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Resume, InterviewSession, UserSettings, JDHistoryRecord, ExperiencePoolItem } from '@/types';
import * as db from '@/lib/db';

// 设置Store
interface SettingsState {
  settings: UserSettings | null;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: null,
      isLoading: true,

      loadSettings: async () => {
        set({ isLoading: true });
        const settings = await db.getSettings();
        set({ settings: settings || null, isLoading: false });
      },

      updateSettings: async (newSettings) => {
        const current = get().settings;
        const updated = { ...current, ...newSettings } as UserSettings;
        await db.saveSettings(updated);
        set({ settings: updated });
      },
    }),
    {
      name: 'settings-cache',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

// 简历Store
interface ResumeState {
  resumes: Resume[];
  currentResume: Resume | null;
  isLoading: boolean;
  loadResumes: () => Promise<void>;
  getResume: (id: string) => Promise<Resume | undefined>;
  setCurrentResume: (resume: Resume | null) => void;
  saveResume: (resume: Resume) => Promise<void>;
  deleteResume: (id: string) => Promise<void>;
}

export const useResumeStore = create<ResumeState>()((set, get) => ({
  resumes: [],
  currentResume: null,
  isLoading: true,

  loadResumes: async () => {
    set({ isLoading: true });
    const resumes = await db.getAllResumes();
    set({ resumes, isLoading: false });
  },

  getResume: async (id: string) => {
    return await db.getResume(id);
  },

  setCurrentResume: (resume) => {
    set({ currentResume: resume });
  },

  saveResume: async (resume) => {
    await db.saveResume(resume);
    const resumes = await db.getAllResumes();
    set({ resumes, currentResume: resume });
  },

  deleteResume: async (id) => {
    await db.deleteResume(id);
    const resumes = get().resumes.filter((r) => r.id !== id);
    set({ resumes });
  },
}));

// 面试Store
interface InterviewState {
  sessions: InterviewSession[];
  currentSession: InterviewSession | null;
  isLoading: boolean;
  loadSessions: () => Promise<void>;
  setCurrentSession: (session: InterviewSession | null) => void;
  saveSession: (session: InterviewSession) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

// JD历史记录Store
interface JDHistoryState {
  records: JDHistoryRecord[];
  isLoading: boolean;
  loadHistory: () => Promise<void>;
  addRecord: (record: JDHistoryRecord) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
}

export const useJDHistoryStore = create<JDHistoryState>()((set, get) => ({
  records: [],
  isLoading: true,

  loadHistory: async () => {
    set({ isLoading: true });
    const records = await db.getAllJDHistory();
    set({ records, isLoading: false });
  },

  addRecord: async (record) => {
    await db.saveJDHistory(record);
    const records = await db.getAllJDHistory();
    set({ records });
  },

  removeRecord: async (id) => {
    await db.deleteJDHistory(id);
    const records = get().records.filter((r) => r.id !== id);
    set({ records });
  },
}));

export const useInterviewStore = create<InterviewState>()((set, get) => ({
  sessions: [],
  currentSession: null,
  isLoading: true,

  loadSessions: async () => {
    set({ isLoading: true });
    const sessions = await db.getAllInterviews();
    set({ sessions, isLoading: false });
  },

  setCurrentSession: (session) => {
    set({ currentSession: session });
  },

  saveSession: async (session) => {
    await db.saveInterview(session);
    const sessions = await db.getAllInterviews();
    set({ sessions, currentSession: session });
  },

  deleteSession: async (id) => {
    await db.deleteInterview(id);
    const sessions = get().sessions.filter((s) => s.id !== id);
    set({ sessions });
  },
}));

// 经历池Store
interface ExperiencePoolState {
  items: ExperiencePoolItem[];
  isLoading: boolean;
  loadItems: () => Promise<void>;
  addItem: (item: ExperiencePoolItem) => Promise<void>;
  updateItem: (item: ExperiencePoolItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  getItemsByIds: (ids: string[]) => ExperiencePoolItem[];
}

export const useExperiencePoolStore = create<ExperiencePoolState>()((set, get) => ({
  items: [],
  isLoading: true,

  loadItems: async () => {
    set({ isLoading: true });
    const items = await db.getAllExperiencePoolItems();
    set({ items, isLoading: false });
  },

  addItem: async (item) => {
    await db.saveExperiencePoolItem(item);
    const items = await db.getAllExperiencePoolItems();
    set({ items });
  },

  updateItem: async (item) => {
    await db.saveExperiencePoolItem({ ...item, updatedAt: new Date().toISOString() });
    const items = get().items.map((i) => (i.id === item.id ? item : i));
    set({ items });
  },

  deleteItem: async (id) => {
    await db.deleteExperiencePoolItem(id);
    const items = get().items.filter((i) => i.id !== id);
    set({ items });
  },

  getItemsByIds: (ids) => {
    const items = get().items;
    return ids.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ExperiencePoolItem[];
  },
}));
