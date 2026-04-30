import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Resume, InterviewSession, UserSettings } from '@/types';
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
