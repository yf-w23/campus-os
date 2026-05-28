export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  CourseDetail: {id: string};
  HomeworkDetail: {id: string};
  NotificationDetail: {id: string};
  FileDetail: {id: string};
  InAppViewer: {url: string; title?: string};
  CampusClassroom: undefined;
  CampusGrades: undefined;
  CampusPEtest: undefined;
  CampusDormitory: undefined;
  CampusReservation: undefined;
  /** 图书馆 / 研讨间 native 浏览页 */
  CampusLibrary: undefined;
  /** 单个楼层的分区列表（楼层 → 分区） */
  CampusLibraryFloor: {
    floorId: number;
    floorName: string;
    initialDateChoice?: 0 | 1;
  };
  /** 单个分区的座位列表（分区 → 座位） */
  CampusLibrarySection: {
    sectionId: number;
    sectionName: string;
    initialDateChoice?: 0 | 1;
  };
};
