import { wrap, DBSchema, IDBPDatabase } from 'idb';
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
let rawDB: IDBDatabase | null = null;

// 在 IDBDatabase 上创建/升级所有 object stores
function createStores(db: IDBDatabase, oldVersion: number) {
  if (!db.objectStoreNames.contains('resumes')) {
    const resumeStore = db.createObjectStore('resumes', { keyPath: 'id' });
    resumeStore.createIndex('by-date', 'updatedAt');
  }

  if (!db.objectStoreNames.contains('interviews')) {
    const interviewStore = db.createObjectStore('interviews', { keyPath: 'id' });
    interviewStore.createIndex('by-date', 'updatedAt');
    interviewStore.createIndex('by-resume', 'resumeId');
  }

  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'id' });
  }

  if (!db.objectStoreNames.contains('jdHistory')) {
    const jdStore = db.createObjectStore('jdHistory', { keyPath: 'id' });
    jdStore.createIndex('by-date', 'lastUsedAt');
  }

  if (!db.objectStoreNames.contains('experiences')) {
    const expStore = db.createObjectStore('experiences', { keyPath: 'id' });
    expStore.createIndex('by-date', 'updatedAt');
    expStore.createIndex('by-type', 'type');
  }
}

// 迁移旧格式简历（内联 experience/projects）到经历池引用模式
async function migrateToExperiencePool(db: IDBDatabase) {
  const tx = db.transaction(['resumes', 'experiences'], 'readwrite');
  const resumeStore = tx.objectStore('resumes');
  const expStore = tx.objectStore('experiences');
  const now = new Date().toISOString();

  const resumes = await new Promise<unknown[]>((resolve, reject) => {
    const request = resumeStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  for (const r of resumes) {
    const resume = r as Resume & { experience?: ExperiencePoolItem[]; projects?: ExperiencePoolItem[] };
    const raw = resume as unknown as Record<string, unknown>;
    const oldExperience = raw.experience as ExperiencePoolItem[] | undefined;
    const oldProjects = raw.projects as ExperiencePoolItem[] | undefined;

    if ((!oldExperience || oldExperience.length === 0) && (!oldProjects || oldProjects.length === 0)) {
      continue;
    }

    const experienceIds: string[] = (raw.experienceIds as string[]) || [];
    const projectIds: string[] = (raw.projectIds as string[]) || [];

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
        expStore.put(poolItem);
        experienceIds.push(poolItem.id);
      }
    }

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
        expStore.put(poolItem);
        projectIds.push(poolItem.id);
      }
    }

    delete raw.experience;
    delete raw.projects;
    raw.experienceIds = experienceIds;
    raw.projectIds = projectIds;

    resumeStore.put(resume);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 使用原生 IndexedDB API 打开数据库 —— 正确拒绝 blocked 事件
// idb 的 openDB 在 blocked 时 promise 永不 resolve/reject，这里绕过它
function nativeOpen(
  name: string,
  version: number | undefined,
  onUpgrade: ((db: IDBDatabase, oldVersion: number) => void) | undefined,
  timeoutMs: number
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version !== undefined
      ? indexedDB.open(name, version)
      : indexedDB.open(name);

    const timeout = setTimeout(() => {
      reject(new Error('IndexedDB open timeout'));
    }, timeoutMs);

    request.onupgradeneeded = (event) => {
      if (onUpgrade) {
        onUpgrade(request.result, event.oldVersion);
      }
    };

    request.onsuccess = () => {
      clearTimeout(timeout);
      resolve(request.result);
    };

    request.onerror = () => {
      clearTimeout(timeout);
      reject(request.error || new Error('IndexedDB open failed'));
    };

    request.onblocked = () => {
      clearTimeout(timeout);
      // 版本升级被旧连接阻塞 → 立即拒绝，让上层回退到无版本打开
      reject(new Error('IndexedDB upgrade blocked by old connection'));
    };
  });
}

export async function getDB() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available (server-side rendering)');
  }
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    // === Tier 1: 尝试用目标版本打开（可能被旧 tab 的旧版本连接阻塞） ===
    try {
      const db = await nativeOpen(DB_NAME, DB_VERSION, createStores, 2000);
      rawDB = db;

      // 设置 onversionchange：当未来新版本尝试升级时，主动关闭当前连接
      db.onversionchange = () => {
        db.close();
        rawDB = null;
        dbPromise = null;
      };

      return wrap(db) as unknown as IDBPDatabase<ResumeAIDB>;
    } catch (err) {
      console.warn('IndexedDB open with version upgrade failed:', err);
    }

    // === Tier 2: 回退到无版本打开（不触发 upgrade，永远不会 block） ===
    try {
      const db = await nativeOpen(DB_NAME, undefined, undefined, 5000);
      rawDB = db;

      db.onversionchange = () => {
        db.close();
        rawDB = null;
        dbPromise = null;
      };

      const wrapped = wrap(db) as unknown as IDBPDatabase<ResumeAIDB>;

      // 检查是否需要迁移旧格式数据（v2→v3）
      if (!db.objectStoreNames.contains('experiences')) {
        console.log('DB needs migration — running v2→v3 migration in app code');
        // 关闭当前连接，重新用目标版本打开以触发 upgrade
        db.close();
        rawDB = null;

        const migratedDB = await nativeOpen(DB_NAME, DB_VERSION, (idb, oldVersion) => {
          createStores(idb, oldVersion);
        }, 5000);

        // 检查是否有旧简历数据需要迁移
        const hasResumes = migratedDB.objectStoreNames.contains('resumes');
        let needsMigration = false;
        if (hasResumes) {
          try {
            const checkTx = migratedDB.transaction('resumes', 'readonly');
            const resumes = await new Promise<unknown[]>((resolve, reject) => {
              const req = checkTx.objectStore('resumes').getAll();
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
            needsMigration = resumes.some((r) => {
              const raw = r as unknown as Record<string, unknown>;
              return (raw.experience && Array.isArray(raw.experience) && raw.experience.length > 0)
                || (raw.projects && Array.isArray(raw.projects) && raw.projects.length > 0);
            });
          } catch {
            // 检查失败，跳过迁移
          }
        }

        if (needsMigration) {
          await migrateToExperiencePool(migratedDB);
        }

        migratedDB.onversionchange = () => {
          migratedDB.close();
          rawDB = null;
          dbPromise = null;
        };
        rawDB = migratedDB;
        return wrap(migratedDB) as unknown as IDBPDatabase<ResumeAIDB>;
      }

      return wrapped;
    } catch (err2) {
      console.error('IndexedDB fallback open also failed:', err2);
      dbPromise = null;
      throw err2;
    }
  })();

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
