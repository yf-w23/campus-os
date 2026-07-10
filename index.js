import './src/polyfills';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {campusWorkflowBackgroundTask} from './src/services/workflow/headlessWorkflowTask';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerHeadlessTask(
  'CampusWorkflowBackgroundTask',
  () => campusWorkflowBackgroundTask,
);
