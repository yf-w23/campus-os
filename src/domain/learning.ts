export type HomeworkStatus = 'pending' | 'submitted' | 'graded' | 'overdue';

export interface RemoteFile {
  id: string;
  name: string;
  downloadUrl: string;
  previewUrl: string;
  size: string;
}

export interface CourseInfo {
  id: string;
  name: string;
  teacherName: string;
  timeAndLocation: string[];
  courseNumber: string;
}

export interface ScheduleEvent {
  id: string;
  date: string;
  title: string;
  location: string;
  startTime: string;
  endTime: string;
  category: string;
}

export interface NotificationItem {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  content: string;
  publishTime: string;
  expireTime?: string;
  hasRead: boolean;
  expired: boolean;
  publisher: string;
  attachment?: RemoteFile;
}

export interface HomeworkItem {
  id: string;
  baseId: string;
  courseId: string;
  courseName: string;
  title: string;
  deadline: string;
  lateSubmissionDeadline?: string;
  submitted: boolean;
  graded: boolean;
  isLateSubmission: boolean;
  status: HomeworkStatus;
  grade?: number;
  url: string;
}

export interface CourseFile {
  id: string;
  fileId: string;
  courseId: string;
  courseName: string;
  title: string;
  description: string;
  uploadTime: string;
  size: string;
  fileType: string;
  isNew: boolean;
  downloadUrl: string;
  previewUrl: string;
}

export interface LearningSnapshot {
  courses: CourseInfo[];
  schedule: ScheduleEvent[];
  notifications: NotificationItem[];
  homework: HomeworkItem[];
  files: CourseFile[];
  fetchedAt: string;
}
