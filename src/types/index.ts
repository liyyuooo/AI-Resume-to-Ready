// 简历数据结构
export interface Resume {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;

  basicInfo: BasicInfo;
  education: Education[];
  experienceIds: string[];
  projectIds: string[];
  skills: Skill[];
}

// 展开后的简历（从池中解析出完整经历）
export interface ResolvedResume extends Omit<Resume, 'experienceIds' | 'projectIds'> {
  experience: ExperiencePoolItem[];
  projects: ExperiencePoolItem[];
}

export interface BasicInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  links: Link[];
}

export interface Link {
  label: string;
  url: string;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
  highlights: string[];
}

export interface Experience {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  responsibilities: string[];
  achievements: string[];
}

export interface Project {
  id: string;
  name: string;
  role: string;
  description: string;
  technologies: string[];
  highlights: string[];
}

export interface Skill {
  id: string;
  category: string;
  items: string[];
}

// 面试相关类型
export interface InterviewSession {
  id: string;
  type: InterviewType;
  resumeId: string;
  jobDescription?: string;
  targetRole?: string;
  targetCompany?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export type InterviewType = 'job-targeted' | 'resume-deep' | 'behavioral' | 'technical';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// 用户配置
export interface UserSettings {
  apiUrl: string;
  apiKey: string;
  model: string;
  targetIndustry?: string;
  targetRole?: string;
  yearsOfExperience?: number;
}

// LLM Vision 支持
export interface TextContentPart {
  type: 'text';
  text: string;
}

export interface ImageContentPart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export type ContentPart = TextContentPart | ImageContentPart;

// LLM相关
export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface LLMConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

// JD 历史记录
export interface JDHistoryRecord {
  id: string;
  title: string;
  targetRole?: string;
  targetCompany?: string;
  jobDescription: string;
  createdAt: string;
  lastUsedAt: string;
}

// 经历池
export type PoolItemType = 'experience' | 'project';

export interface ExperiencePoolItem {
  id: string;
  type: PoolItemType;
  company?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  responsibilities?: string[];
  achievements?: string[];
  name?: string;
  role?: string;
  description?: string;
  technologies?: string[];
  highlights?: string[];
  source: 'upload' | 'manual' | 'conversation';
  createdAt: string;
  updatedAt: string;
}
