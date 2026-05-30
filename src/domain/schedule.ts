/** 用户自建日程（本地持久化，与教务课表合并展示） */
export interface PersonalEvent {
  id: string;
  date: string;
  title: string;
  location?: string;
  startTime: string;
  endTime: string;
  note?: string;
  createdAt: string;
}
