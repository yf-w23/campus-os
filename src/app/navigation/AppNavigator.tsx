import React from 'react';
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
import {CampusScreen} from '../../features/campus/CampusScreen';
import {
  ClassroomScreen,
  GradesScreen,
  PEtestScreen,
  DormitoryScreen,
  ReservationScreen,
} from '../../features/campus/subscreens';
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
import {RootStackParamList} from './types';

export type RootTabParamList = {
  Home: undefined;
  Learning: undefined;
  Campus: undefined;
  AI: undefined;
  Settings: undefined;
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
          borderTopColor: colors.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon
              focused={focused}
              source={require('../../assets/tabs/home.png')}
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
              source={require('../../assets/tabs/learning.png')}
              label={t.tabs.learning}
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
              source={require('../../assets/tabs/campus.png')}
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
              source={require('../../assets/tabs/ai.png')}
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
              source={require('../../assets/tabs/settings.png')}
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
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
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
            <Stack.Screen name="CampusReservation" component={ReservationScreen} />
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
