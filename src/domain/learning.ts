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
  /** 完成方式：'个人完成' | '小组完成'（zywcfs）*/
  completionType?: string;
  /** 提交方式：'网络学堂提交' | '线下提交'（zytjfs）*/
  submissionType?: string;
  /** 提交日期（scsj）*/
  submitTime?: string;
  /** 批阅老师（jsm）*/
  graderName?: string;
  /** 评语（pynr）*/
  gradeContent?: string;
  /** 批阅时间（pysj）*/
  gradeTime?: string;
}

/**
 * 作业完整详情 —— 通过抓取网络学堂 viewCj 页面 HTML 解析得到，
 * 对照 thu-learn-lib `parseHomeworkAtUrl`。各字段均可能缺省。
 */
export interface HomeworkDetail {
  /** 作业说明（富文本 HTML）*/
  description?: string;
  /** 答案说明（富文本 HTML）*/
  answerContent?: string;
  /** 上交作业内容（富文本 HTML）*/
  submittedContent?: string;
  /** 作业附件 */
  attachment?: RemoteFile;
  /** 答案附件 */
  answerAttachment?: RemoteFile;
  /** 上交作业附件 */
  submittedAttachment?: RemoteFile;
  /** 评语附件 */
  gradeAttachment?: RemoteFile;
  /** 发布对象 */
  publishTarget?: string;
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
