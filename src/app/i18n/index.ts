import {useSelector} from 'react-redux';
import {selectSettings} from '../../state/selectors';
import {zh} from './zh';
import {en} from './en';

export function useTranslation() {
  const {locale} = useSelector(selectSettings);
  return locale === 'en' ? en : zh;
}
