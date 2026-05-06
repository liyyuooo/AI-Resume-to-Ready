import type { Resume, InterviewSession, UserSettings, JDHistoryRecord, ExperiencePoolItem, ResolvedResume } from '@/types';

const PREFIX = 'raa_';

function readTable<T>(name: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PREFIX + name);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeTable<T>(name: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to write table ${name}:`, err);
  }
}

// 简历
export async function saveResume(resume: Resume): Promise<void> {
  const items = readTable<Resume>('resumes');
  const idx = items.findIndex((r) => r.id === resume.id);
  if (idx >= 0) items[idx] = resume;
  else items.push(resume);
  writeTable('resumes', items);
}

export async function getResume(id: string): Promise<Resume | undefined> {
  return readTable<Resume>('resumes').find((r) => r.id === id);
}

export async function getAllResumes(): Promise<Resume[]> {
  return readTable<Resume>('resumes').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteResume(id: string): Promise<void> {
  writeTable('resumes', readTable<Resume>('resumes').filter((r) => r.id !== id));
}

// 面试记录
export async function saveInterview(interview: InterviewSession): Promise<void> {
  const items = readTable<InterviewSession>('interviews');
  const idx = items.findIndex((i) => i.id === interview.id);
  if (idx >= 0) items[idx] = interview;
  else items.push(interview);
  writeTable('interviews', items);
}

export async function getInterview(id: string): Promise<InterviewSession | undefined> {
  return readTable<InterviewSession>('interviews').find((i) => i.id === id);
}

export async function getInterviewsByResume(resumeId: string): Promise<InterviewSession[]> {
  return readTable<InterviewSession>('interviews').filter((i) => i.resumeId === resumeId);
}

export async function getAllInterviews(): Promise<InterviewSession[]> {
  return readTable<InterviewSession>('interviews').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteInterview(id: string): Promise<void> {
  writeTable('interviews', readTable<InterviewSession>('interviews').filter((i) => i.id !== id));
}

// 设置
const SETTINGS_ID = 'user-settings';

export async function saveSettings(settings: UserSettings): Promise<void> {
  writeTable('settings', [{ ...settings, id: SETTINGS_ID } as unknown as UserSettings]);
}

export async function getSettings(): Promise<UserSettings | undefined> {
  const items = readTable<UserSettings & { id: string }>('settings');
  const result = items.find((s) => s.id === SETTINGS_ID);
  if (result) {
    delete (result as { id?: string }).id;
    return result;
  }
  return undefined;
}

// JD 历史
export async function saveJDHistory(record: JDHistoryRecord): Promise<void> {
  const items = readTable<JDHistoryRecord>('jdHistory');
  const idx = items.findIndex((r) => r.id === record.id);
  if (idx >= 0) items[idx] = record;
  else items.push(record);
  writeTable('jdHistory', items);
}

export async function getAllJDHistory(): Promise<JDHistoryRecord[]> {
  return readTable<JDHistoryRecord>('jdHistory').sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

export async function deleteJDHistory(id: string): Promise<void> {
  writeTable('jdHistory', readTable<JDHistoryRecord>('jdHistory').filter((r) => r.id !== id));
}

// 字符串归一化
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, ' ')
    .replace(/\b(inc\.?|ltd\.?|llc|corp\.?|corporation|co\.?|limited|holding|holdings|group|plc|s\.?a\.?|s\.?r\.?l\.?|pty|ag|gmbh|bv|nv)\b/gi, '')
    .replace(/(有限公司|股份有限公司|责任公司|集团公司|集团|科技|技术|网络|信息|文化|传媒)/g, '')
    .replace(/[（(][^)）]*[)）]/g, '')
    .replace(/[,，.。、;；:：!！?？'"]/g, '')
    .replace(/[-–—]/g, '')
    .trim();
}

function isSimilar(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// 经历池
export async function saveExperiencePoolItem(item: ExperiencePoolItem): Promise<void> {
  const items = readTable<ExperiencePoolItem>('experiences');
  const duplicate = items.find((existing) => {
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
  if (duplicate) {
    const idx = items.findIndex((i) => i.id === duplicate.id);
    items[idx] = {
      ...item,
      id: duplicate.id,
      createdAt: duplicate.createdAt,
      updatedAt: new Date().toISOString(),
    };
  } else {
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
  }
  writeTable('experiences', items);
}

export async function findDuplicatePoolItem(item: ExperiencePoolItem): Promise<ExperiencePoolItem | undefined> {
  return readTable<ExperiencePoolItem>('experiences').find((existing) => {
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
  return readTable<ExperiencePoolItem>('experiences').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getExperiencePoolItemsByType(type: 'experience' | 'project'): Promise<ExperiencePoolItem[]> {
  return readTable<ExperiencePoolItem>('experiences')
    .filter((i) => i.type === type)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getExperiencePoolItemsByIds(ids: string[]): Promise<ExperiencePoolItem[]> {
  const items = readTable<ExperiencePoolItem>('experiences');
  return ids.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ExperiencePoolItem[];
}

export async function deleteExperiencePoolItem(id: string): Promise<void> {
  writeTable('experiences', readTable<ExperiencePoolItem>('experiences').filter((i) => i.id !== id));
}

export async function saveExperiencePoolItemsBatch(items: ExperiencePoolItem[]): Promise<void> {
  const existing = readTable<ExperiencePoolItem>('experiences');
  for (const item of items) {
    const idx = existing.findIndex((i) => i.id === item.id);
    if (idx >= 0) existing[idx] = item;
    else existing.push(item);
  }
  writeTable('experiences', existing);
}

export async function resolveResume(resume: Resume): Promise<ResolvedResume> {
  const allExperiences = await getExperiencePoolItemsByIds(resume.experienceIds);
  const allProjects = await getExperiencePoolItemsByIds(resume.projectIds);

  const { experienceIds, projectIds, ...rest } = resume;
  return {
    ...rest,
    experience: allExperiences.filter((e) => e.type === 'experience'),
    projects: allProjects.filter((p) => p.type === 'project'),
  };
}
