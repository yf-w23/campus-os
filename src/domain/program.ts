export enum CourseState {
  COMPLETED = 'completed',
  NOT_COMPLETED = 'not_completed',
  ELECTED = 'elected',
}

export enum CourseType {
  COMPULSORY = 'compulsory',
  RESTRICTED = 'restricted',
  ELECTIVE = 'elective',
  EXCLUDED = 'excluded',
}

export interface CourseItemCompletion {
  id: string;
  name: string;
  credit: number;
  point?: number;
  grade?: string;
  state: CourseState;
}

export interface CourseSetCompletion {
  setName: string;
  type: CourseType;
  course: CourseItemCompletion[];
  requiredCredit?: number;
  completedCredit?: number;
  requiredCourseNum?: number;
  completedCourseNum?: number;
  fullCompleted: boolean;
}

export interface ProgramCompletion {
  completedCredit: number;
  compulsoryCredit: number;
  restrictedCredit: number;
  electiveCredit: number;
  duplicatedCourse: string[];
  courseSet: CourseSetCompletion[];
}

export interface CourseSetFull {
  setName: string;
  type: CourseType;
  course: Array<{
    id: string;
    name: string;
    credit: number;
  }>;
}

export interface ProgramFull {
  courseSet: CourseSetFull[];
}
