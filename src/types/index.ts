// 简历数据结构
export interface Resume {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;

  basicInfo: BasicInfo;
  education: Education[];
  experience: Experience[];
  projects: Project[];
  skills: Skill[];
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

// LLM相关
export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}
