import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Resume, InterviewSession, UserSettings, JDHistoryRecord, ExperiencePoolItem, ResolvedResume } from '@/types';

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
  jdHistory: {
    key: string;
    value: JDHistoryRecord;
    indexes: { 'by-date': string };
  };
  experiences: {
    key: string;
    value: ExperiencePoolItem;
    indexes: { 'by-date': string; 'by-type': string };
  };
}

const DB_NAME = 'resume-ai-assistant';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<ResumeAIDB>> | null = null;

// 迁移旧格式简历（内联 experience/projects）到经历池引用模式
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function migrateToExperiencePool(transaction: any) {
  const resumeStore = transaction.objectStore('resumes');
  const expStore = transaction.objectStore('experiences');
  const now = new Date().toISOString();

  let cursor = await resumeStore.openCursor();
  while (cursor) {
    const resume = (cursor as unknown as { value: unknown }).value as Resume & { experience?: ExperiencePoolItem[]; projects?: ExperiencePoolItem[] };
    const oldExperience = (resume as unknown as Record<string, unknown>).experience as ExperiencePoolItem[] | undefined;
    const oldProjects = (resume as unknown as Record<string, unknown>).projects as ExperiencePoolItem[] | undefined;

    const experienceIds: string[] = [];
    const projectIds: string[] = [];

    // 迁移工作经历
    if (oldExperience && Array.isArray(oldExperience)) {
      for (const exp of oldExperience) {
        const poolItem: ExperiencePoolItem = {
          id: exp.id || crypto.randomUUID(),
          type: 'experience',
          company: exp.company,
          title: exp.title,
          startDate: exp.startDate,
          endDate: exp.endDate,
          location: exp.location,
          responsibilities: exp.responsibilities,
          achievements: exp.achievements,
          source: 'upload',
          createdAt: now,
          updatedAt: now,
        };
        await expStore.put(poolItem);
        experienceIds.push(poolItem.id);
      }
    }

    // 迁移项目经历
    if (oldProjects && Array.isArray(oldProjects)) {
      for (const proj of oldProjects) {
        const poolItem: ExperiencePoolItem = {
          id: proj.id || crypto.randomUUID(),
          type: 'project',
          name: proj.name,
          role: proj.role,
          description: proj.description,
          technologies: proj.technologies,
          highlights: proj.highlights,
          source: 'upload',
          createdAt: now,
          updatedAt: now,
        };
        await expStore.put(poolItem);
        projectIds.push(poolItem.id);
      }
    }

    // 更新简历：使用 ID 引用，删除旧字段
    const updatedResume = { ...resume };
    delete (updatedResume as Record<string, unknown>).experience;
    delete (updatedResume as Record<string, unknown>).projects;
    (updatedResume as Record<string, unknown>).experienceIds = experienceIds;
    (updatedResume as Record<string, unknown>).projectIds = projectIds;

    await (cursor as unknown as { update: (value: unknown) => Promise<unknown> }).update(updatedResume as Resume);
    cursor = await (cursor as unknown as { continue: () => Promise<typeof cursor> }).continue();
  }
}

export async function getDB() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available (server-side rendering)');
  }
  if (!dbPromise) {
    dbPromise = openDB<ResumeAIDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
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

        // JD历史记录存储 (v2)
        if (!db.objectStoreNames.contains('jdHistory')) {
          const jdStore = db.createObjectStore('jdHistory', { keyPath: 'id' });
          jdStore.createIndex('by-date', 'lastUsedAt');
        }

        // 经历池存储 (v3) + 数据迁移
        if (oldVersion < 3) {
          const expStore = db.createObjectStore('experiences', { keyPath: 'id' });
          expStore.createIndex('by-date', 'updatedAt');
          expStore.createIndex('by-type', 'type');

          // 迁移旧简历数据：将内联 experience/projects 迁移到经历池
          migrateToExperiencePool(transaction).catch((err) => {
            console.error('Migration to v3 failed (non-fatal):', err);
          });
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

// JD历史记录操作
export async function saveJDHistory(record: JDHistoryRecord): Promise<void> {
  const db = await getDB();
  await db.put('jdHistory', record);
}

export async function getAllJDHistory(): Promise<JDHistoryRecord[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex('jdHistory', 'by-date');
  return records.reverse();
}

export async function deleteJDHistory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('jdHistory', id);
}

// 字符串归一化：用于模糊匹配
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, ' ')
    // 移除常见公司后缀
    .replace(/\b(inc\.?|ltd\.?|llc|corp\.?|corporation|co\.?|limited|holding|holdings|group|plc|s\.?a\.?|s\.?r\.?l\.?|pty|ag|gmbh|bv|nv)\b/gi, '')
    // 移除中文公司后缀
    .replace(/(有限公司|股份有限公司|责任公司|集团公司|集团|科技|技术|网络|信息|文化|传媒)/g, '')
    // 移除括号内容（公司注册地等）
    .replace(/[（(][^)）]*[)）]/g, '')
    // 移除标点
    .replace(/[,，.。、;；:：!！?？'"]/g, '')
    .replace(/[-–—]/g, '')
    .trim();
}

// 检查两个字符串是否相似（归一化后相等或互相包含）
function isSimilar(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// 经历池操作
export async function saveExperiencePoolItem(item: ExperiencePoolItem): Promise<void> {
  const db = await getDB();
  // 去重：模糊匹配检查是否有相同经历
  const allItems = await db.getAll('experiences');
  const duplicate = allItems.find((existing) => {
    if (existing.id === item.id) return false; // 更新操作，允许自己
    if (item.type === 'experience' && existing.type === 'experience') {
      return isSimilar(existing.company || '', item.company || '')
        && isSimilar(existing.title || '', item.title || '');
    }
    if (item.type === 'project' && existing.type === 'project') {
      return isSimilar(existing.name || '', item.name || '');
    }
    return false;
  });
  if (duplicate) {
    // 合并：用新数据更新旧记录，保留旧ID
    await db.put('experiences', {
      ...item,
      id: duplicate.id,
      createdAt: duplicate.createdAt,
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  await db.put('experiences', item);
}

export async function findDuplicatePoolItem(item: ExperiencePoolItem): Promise<ExperiencePoolItem | undefined> {
  const db = await getDB();
  const allItems = await db.getAll('experiences');
  return allItems.find((existing) => {
    if (existing.id === item.id) return false;
    if (item.type === 'experience' && existing.type === 'experience') {
      return isSimilar(existing.company || '', item.company || '')
        && isSimilar(existing.title || '', item.title || '');
    }
    if (item.type === 'project' && existing.type === 'project') {
      return isSimilar(existing.name || '', item.name || '');
    }
    return false;
  });
}

export async function getAllExperiencePoolItems(): Promise<ExperiencePoolItem[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('experiences', 'by-date');
  return items.reverse();
}

export async function getExperiencePoolItemsByType(type: 'experience' | 'project'): Promise<ExperiencePoolItem[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('experiences', 'by-type', type);
  return items.reverse();
}

export async function getExperiencePoolItemsByIds(ids: string[]): Promise<ExperiencePoolItem[]> {
  const db = await getDB();
  const items: ExperiencePoolItem[] = [];
  for (const id of ids) {
    const item = await db.get('experiences', id);
    if (item) items.push(item);
  }
  return items;
}

export async function deleteExperiencePoolItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('experiences', id);
}

// 批量保存经历池条目（跳过去重检查，用于导入场景）
export async function saveExperiencePoolItemsBatch(items: ExperiencePoolItem[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('experiences', 'readwrite');
  await Promise.all(items.map((item) => tx.store.put(item)));
  await tx.done;
}

export async function resolveResume(resume: Resume): Promise<ResolvedResume> {
  const db = await getDB();
  const allExperiences = await getExperiencePoolItemsByIds(resume.experienceIds);
  const allProjects = await getExperiencePoolItemsByIds(resume.projectIds);

  const { experienceIds, projectIds, ...rest } = resume;
  return {
    ...rest,
    experience: allExperiences.filter((e) => e.type === 'experience'),
    projects: allProjects.filter((p) => p.type === 'project'),
  };
}
