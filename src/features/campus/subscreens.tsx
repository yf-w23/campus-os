/**
 * 校园子页面统一导出。
 * - Grades / Classroom / PEtest：native 实现（fetch + 解析）
 * - Dormitory / Reservation：保留 webview 入口（涉及 ASP.NET / 支付，native 化收益不大）
 */
import React from 'react';
import {CampusEntryScreen, EntryScreenProps} from './CampusEntryScreen';
import {
  DORM_ELE_DETAIL_URL,
  DORM_ELE_URL,
  DORM_HEALTH_URL,
} from '../../services/campus/campusEndpoints';

export {GradesScreen} from './GradesScreen';
export {ClassroomScreen} from './ClassroomScreen';
export {PEtestScreen} from './PEtestScreen';

const icons = {
  dormitory: require('../../assets/campus/dormitory.png'),
  reservation: require('../../assets/campus/reservation.png'),
};

export function DormitoryScreen({navigation}: EntryScreenProps<'CampusDormitory'>) {
  return (
    <CampusEntryScreen
      navigation={navigation}
      pageTitle="宿舍服务"
      heroIcon={icons.dormitory}
      heroTitle="宿舍生活服务"
      heroSubtitle="电费查询与充值、健康打卡与服务"
      entries={[
        {
          title: '电费余额',
          subtitle: '查询当前余额与更新时间',
          url: DORM_ELE_DETAIL_URL,
          accent: '#A78BFA',
        },
        {
          title: '电费充值',
          subtitle: '在线给宿舍房间充值',
          url: DORM_ELE_URL,
          accent: '#A78BFA',
        },
        {
          title: '宿舍服务系统',
          subtitle: '健康打卡、报修与公告',
          url: DORM_HEALTH_URL,
          accent: '#A78BFA',
        },
      ]}
    />
  );
}

export function ReservationScreen({
  navigation,
}: EntryScreenProps<'CampusReservation'>) {
  // 场馆预约 = 图书馆 + 研讨间 — 现在走 native 实现（参照 thu-info-app）
  // 进入后直接 navigate 到 LibraryNativeScreen 的双 tab 浏览页
  React.useEffect(() => {
    navigation.replace('CampusLibrary');
  }, [navigation]);
  return null;
}
