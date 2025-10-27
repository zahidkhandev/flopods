import { JobState } from 'bullmq';

export interface QueueJobData<T = any> {
  id?: string;
  data: T;
  attemptsMade?: number;
}

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface QueueJobStatus {
  id?: string;
  state?: JobState | 'unknown';
  progress?: any;
  attemptsMade?: number;
  processedOn?: number;
  finishedOn?: number;
}

export interface QueueAdapter<T = any> {
  add(jobName: string, data: T, options?: any): Promise<string>;
  process(handler: (job: any) => Promise<any>): void;
  getMetrics(): Promise<QueueMetrics>;
  cancel(jobId: string): Promise<boolean>;
  getJobStatus(jobId: string): Promise<QueueJobStatus | null>;
  close(): Promise<void>;
}
