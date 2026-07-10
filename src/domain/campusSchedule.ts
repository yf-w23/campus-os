/** 课表领域模型 — 对齐 thu-info-lib models/schedule */

export enum CampusScheduleType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  EXAM = 'exam',
  CUSTOM = 'custom',
}

export interface ScheduleTimeSlice {
  id?: string | number;
  /** 1=周一 … 7=周日 */
  dayOfWeek: number;
  /** 完整本地时间，ISO 形如 2026-05-29T09:50:00 */
  beginISO: string;
  endISO: string;
}

export interface CampusSchedule {
  name: string;
  location: string;
  hash: string;
  type: CampusScheduleType;
  category?: string;
  activeTime: ScheduleTimeSlice[];
}

export interface SemesterInfo {
  firstDay: string;
  semesterId: string;
  semesterName: string;
  weekCount: number;
}

export interface SemesterCalendar extends SemesterInfo {
  /** 当前学期原始信息；当页面切到 nextSemesterList 时仍保留，供学期选择器展示。 */
  currentSemester?: SemesterInfo;
  nextSemesterList: SemesterInfo[];
  /** 对齐 thu-info-lib getSchedule(nextSemesterIndex)：undefined 表示当前学期，0+ 表示 nextSemesterList 的索引。 */
  selectedSemesterIndex?: number;
}
