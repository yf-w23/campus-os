import React from 'react';
import {Platform, StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useTranslation} from '../i18n';
import {HomeScreen} from '../../features/home/HomeScreen';
import {LearningScreen} from '../../features/learning/LearningScreen';
import {CourseDetailScreen} from '../../features/learning/CourseDetailScreen';
import {HomeworkDetailScreen} from '../../features/learning/HomeworkDetailScreen';
import {NotificationDetailScreen} from '../../features/learning/NotificationDetailScreen';
import {FileDetailScreen} from '../../features/learning/FileDetailScreen';
import {InAppViewerScreen} from '../../features/learning/InAppViewerScreen';
import {ScheduleScreen} from '../../features/schedule/ScheduleScreen';
import {CampusScreen} from '../../features/campus/CampusScreen';
import {
  ClassroomScreen,
  GradesScreen,
  PEtestScreen,
  DormitoryScreen,
  ReservationScreen,
} from '../../features/campus/subscreens';
import {EleBalanceScreen} from '../../features/campus/EleBalanceScreen';
import {EleRechargeScreen} from '../../features/campus/EleRechargeScreen';
import {CampusFinanceScreen} from '../../features/campus/CampusFinanceScreen';
import {CampusNetworkScreen} from '../../features/campus/CampusNetworkScreen';
import {SportsScreen} from '../../features/campus/SportsScreen';
import {SportsDetailScreen} from '../../features/campus/SportsDetailScreen';
import {SportsBookScreen} from '../../features/campus/SportsBookScreen';
import {LibraryNativeScreen} from '../../features/campus/LibraryNativeScreen';
import {LibraryFloorScreen} from '../../features/campus/LibraryFloorScreen';
import {LibrarySectionScreen} from '../../features/campus/LibrarySectionScreen';
import {AIScreen} from '../../features/ai/AIScreen';
import {SettingsScreen} from '../../features/settings/SettingsScreen';
import {LoginScreen} from '../../features/auth/LoginScreen';
import {TabIcon} from '../../features/common/components/Buttons';
import {useSelector} from 'react-redux';
import {selectAuth} from '../../state/selectors';
import {colors} from '../theme';
import {RootStackParamList, RootTabParamList} from './types';
import {uiImages} from '../assets/uiImages';

/**
 * 全局 Navigation 主题 — 用 app 浅色调色板覆盖 RN-Nav 默认色，
 * 进入/退出 Stack 背景统一，不会闪屏。
 */
const navTheme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: 'transparent',
    notification: colors.primary,
  },
  fonts: {
    regular: {fontFamily: 'System', fontWeight: '400' as const},
    medium: {fontFamily: 'System', fontWeight: '500' as const},
    bold: {fontFamily: 'System', fontWeight: '700' as const},
    heavy: {fontFamily: 'System', fontWeight: '800' as const},
  },
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const t = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.borderSubtle,
          elevation: 0,
          height: 78,
          paddingBottom: 14,
          paddingTop: 10,
          ...Platform.select({
            ios: {
              shadowColor: colors.shadowSoft,
              shadowOffset: {width: 0, height: -4},
              shadowOpacity: 1,
              shadowRadius: 12,
            },
            android: {},
          }),
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon
              focused={focused}
              source={uiImages.home}
              label={t.tabs.home}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Learning"
        component={LearningScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon
              focused={focused}
              source={uiImages.learning}
              label={t.tabs.learning}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon
              focused={focused}
              source={uiImages.schedule}
              label={t.tabs.schedule}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Campus"
        component={CampusScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon
              focused={focused}
              source={uiImages.campus}
              label={t.tabs.campus}
            />
          ),
        }}
      />
      <Tab.Screen
        name="AI"
        component={AIScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon
              focused={focused}
              source={uiImages.ai}
              label={t.tabs.ai}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon
              focused={focused}
              source={uiImages.settings}
              label={t.tabs.settings}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const auth = useSelector(selectAuth);
  const isLoggedIn = auth.session.isAuthenticated || auth.demoMode;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: {backgroundColor: colors.background},
          animation: 'slide_from_right',
        }}>
        {isLoggedIn ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
            <Stack.Screen name="HomeworkDetail" component={HomeworkDetailScreen} />
            <Stack.Screen name="NotificationDetail" component={NotificationDetailScreen} />
            <Stack.Screen name="FileDetail" component={FileDetailScreen} />
            <Stack.Screen
              name="InAppViewer"
              component={InAppViewerScreen}
              options={{presentation: 'modal'}}
            />
            <Stack.Screen name="CampusClassroom" component={ClassroomScreen} />
            <Stack.Screen name="CampusGrades" component={GradesScreen} />
            <Stack.Screen name="CampusPEtest" component={PEtestScreen} />
            <Stack.Screen name="CampusDormitory" component={DormitoryScreen} />
            <Stack.Screen name="CampusFinance" component={CampusFinanceScreen} />
            <Stack.Screen name="CampusNetwork" component={CampusNetworkScreen} />
            <Stack.Screen name="CampusEleBalance" component={EleBalanceScreen} />
            <Stack.Screen name="CampusEleRecharge" component={EleRechargeScreen} />
            <Stack.Screen name="CampusReservation" component={ReservationScreen} />
            <Stack.Screen name="CampusSports" component={SportsScreen} />
            <Stack.Screen name="CampusSportsDetail" component={SportsDetailScreen} />
            <Stack.Screen name="CampusSportsBook" component={SportsBookScreen} />
            <Stack.Screen name="CampusLibrary" component={LibraryNativeScreen} />
            <Stack.Screen
              name="CampusLibraryFloor"
              component={LibraryFloorScreen}
            />
            <Stack.Screen
              name="CampusLibrarySection"
              component={LibrarySectionScreen}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
