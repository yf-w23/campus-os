export type RootTabParamList = {
  Home: undefined;
  Learning: undefined;
  Schedule: undefined;
  Campus: undefined;
  AI: {initialQuestion?: string} | undefined;
  Settings: undefined;
};

import type {SportsVenueInfo} from '../../domain/sports';

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
  CampusFinance: undefined;
  CampusNetwork: undefined;
  /** 电费余额（native）*/
  CampusEleBalance: undefined;
  /** 电费充值（native）*/
  CampusEleRecharge: undefined;
  CampusReservation: undefined;
  /** 体育场馆预约 */
  CampusSports: undefined;
  CampusSportsDetail: {info: SportsVenueInfo};
  CampusSportsBook: {
    info: SportsVenueInfo;
    date: string;
    phone: string;
    period: string;
    field: {id: string; name: string; cost: number};
  };
  /** 图书馆座位 / 研读间 native 浏览页 */
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
