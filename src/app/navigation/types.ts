export type RootTabParamList = {
  Home: undefined;
  Learning:
    | {
        initialTab?: 'courses' | 'homework' | 'notifications' | 'files';
        openAddDeadline?: boolean;
      }
    | undefined;
  Schedule: undefined;
  Campus: undefined;
  AI: {initialQuestion?: string} | undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  WeatherDetail: undefined;
  CourseDetail: {id: string};
  HomeworkDetail: {id: string};
  NotificationDetail: {id: string};
  FileDetail: {id: string};
  InAppViewer: {url: string; title?: string};
  CampusClassroom: undefined;
  CampusGrades: undefined;
  CampusPEtest: undefined;
  CampusDormitory: undefined;
  CampusLaundry: undefined;
  CampusLaundryDetail: {
    id: string;
    name: string;
    platform: 'jieli' | 'haile';
  };
  CampusFinance: undefined;
  CampusNetwork: undefined;
  CampusMail: undefined;
  CampusMailViewer: {
    view: 'home' | 'inbox' | 'compose';
    title?: string;
  };
  CampusMailDetail: {
    id: string;
    title?: string;
    fid?: number;
    folderName?: string;
    fromName?: string;
    date?: string;
    brief?: string;
  };
  CampusMailCompose: {
    mode?: 'new' | 'reply' | 'forward';
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    content?: string;
  };
  /** 电费余额（native）*/
  CampusEleBalance: undefined;
  /** 电费充值（native）*/
  CampusEleRecharge: undefined;
  CampusReservation: undefined;
  /** 监控管理 */
  Monitors: undefined;
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
