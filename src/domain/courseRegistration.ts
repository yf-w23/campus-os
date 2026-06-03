export type Priority = 'bx' | 'xx' | 'rx' | 'ty' | 'xwk' | 'fxwk' | 'tyk' | 'cx';

export type Will = 1 | 2 | 3;

export interface CrSemester {
  id: string;
  name: string;
}

export interface CrTimetableEvent {
  stage: string;
  begin: string;
  end: string;
  messages: string[];
}

export interface CrTimetable {
  semester: string;
  undergraduate: boolean;
  graduate: boolean;
  events: CrTimetableEvent[];
}

export interface CrRemainingInfo {
  id: string;
  seq: number;
  name: string;
  capacity: number;
  remaining: number;
  queue: number;
  teacher: string;
  time: string;
}

export interface CrCourseInfo {
  id: string;
  seq: number;
  name: string;
  credits: number;
  department: string;
  teacher: string;
  time: string;
  note: string;
  capacity: number;
  remaining: number;
  queue: number;
}

export interface SelectedCourse {
  type: string;
  will: Will;
  id: string;
  seq: string;
  name: string;
  time: string;
  teacher: string;
  credit: number;
  secondary: boolean;
}

export interface CourseSearchParams {
  semester: string;
  id?: string;
  name?: string;
  dayOfWeek?: number;
  period?: number;
  page?: number;
}

export interface SearchCoursePriorityResult {
  courseId: string;
  courseSeq: string;
  courseName: string;
  departmentName: string;
  capacity: number;
  bxSelected: number;
  xxSelected: number;
  rxSelected: number;
}

export interface QueueInfo {
  property: string;
  will: Will;
  courseId: string;
  courseSeq: string;
  courseName: string;
  inQueue: number;
  position: number;
  time: string;
  teacher: string;
}
