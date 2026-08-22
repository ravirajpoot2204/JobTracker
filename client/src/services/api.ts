import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

export interface JobData {
  _id?: string;
  company: string;
  role: string;
  platform: string;
  url?: string;
  companyEmail?: string;
  status: string;
  appliedDate?: string;
  lastContactDate?: string;
  followUpCount?: number;
  notes?: string;
  tags?: string[];
  sourceEmailId?: string;
  cvTailoredLink?: string;
  jdSnapshot?: {
    description?: string;
    skillsRequired?: string[];
    interviewTopics?: string[];
    suggestedQuestions?: string[];
  };
  emailLog?: Array<{
    direction: 'inbound' | 'outbound';
    subject: string;
    from?: string;
    to?: string;
    gmailMessageId?: string;
    gmailThreadId?: string;
    snippet?: string;
    sentAt?: string;
    link?: string;
  }>;
  deleted?: boolean;
  deletedAt?: string;
  binExpiresAt?: string;
}

export interface StatsData {
  saved: number;
  applied: number;
  processing: number;
  interview: number;
  offer: number;
  rejected: number;
  no_response: number;
}
export const generateCoverLetterStandalone = (data: { company: string; role: string; jobDescription: string }) =>
  api.post(`/cover-letter/generate`, data);

export const downloadCoverLetter = (payload: {
  text: string;
  company?: string;
  role?: string;
  recipientName?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}) =>
  api.post(`/cover-letter/download`, payload, { responseType: 'blob' });
export const generateCoverLetter = (id: string, jobDescription: string) =>
  api.post(`/jobs/${id}/generate-cover-letter`, { jobDescription });

export const sendFollowUp = (id: string) =>
  api.post(`/jobs/${id}/follow-up`);
export const fetchJobs = (params?: Record<string, string>) =>
  api.get<JobData[]>('/jobs', { params });

export const addJob = (jobData: Partial<JobData>) =>
  api.post<JobData>('/jobs', jobData);

export const fetchStats = () =>
  api.get<StatsData>('/jobs/stats');

export const updateJobStatus = (id: string, status: string) =>
  api.patch<JobData>(`/jobs/${id}/status`, { status });

export const binJob = (id: string) =>
  api.patch<JobData>(`/jobs/${id}/bin`);

export const restoreJob = (id: string) =>
  api.patch<JobData>(`/jobs/${id}/restore`);

export const permanentDeleteJob = (id: string) =>
  api.delete(`/jobs/${id}/permanent`);