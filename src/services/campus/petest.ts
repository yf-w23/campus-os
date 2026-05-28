/**
 * 体测成绩 — 对照 thu-info-lib basics.ts getPhysicalExamResult。
 * 工作流：
 *   1) roamDefault('8BF4F9A706589060488B6B6179E462E5')
 *   2) GET tyjx.tyjx_tc_xscjb.do?m=jsonCj → 解析 JSON
 */
import {webvpnTransport} from '../webvpn/transport';
import {tsinghuaAuthService} from '../auth/tsinghuaAuth';

const WEBVPN_BASE = 'https://webvpn.tsinghua.edu.cn';
const ZHJW_TOKEN =
  '77726476706e69737468656265737421eaff4b8b69336153301c9aa596522b20bc86e6e559a9b290';
const PHYSICAL_EXAM_URL = `${WEBVPN_BASE}/http/${ZHJW_TOKEN}/tyjx.tyjx_tc_xscjb.do?m=jsonCj`;
const PETEST_YYFWID = '8BF4F9A706589060488B6B6179E462E5';

export interface PEItem {
  label: string;
  value: string;
}

/** 与 thu-info-lib 一致的参考计算 */
function calcReference(json: any): number {
  const v = (k: string) => Number(json[k]) || 0;
  return (
    v('fhltzfs') * 0.15 +
    v('wsmpfs') * 0.2 +
    v('zwtqqfs') * 0.1 +
    v('ldtyfs') * 0.1 +
    v('ytxsfs') * 0.1 +
    v('yqmpfs') * 0.2 +
    v('ywqzfs') * 0.1 +
    v('bbmpfs') * 0.2 +
    v('sgtzfs') * 0.15
  );
}

export async function fetchPEResult(): Promise<PEItem[]> {
  await tsinghuaAuthService.roamDefault(PETEST_YYFWID);
  const text = await webvpnTransport.fetchText(PHYSICAL_EXAM_URL);
  const json = JSON.parse(text);
  if (json.success === 'false' || json.success === false) {
    return [{label: '状态', value: '暂无可查成绩'}];
  }
  return [
    {label: '是否免测', value: json.sfmc ?? ''},
    {label: '免测原因', value: json.mcyy ?? ''},
    {label: '总分', value: String(json.zf ?? '')},
    {label: '标准分', value: String(json.bzf ?? '')},
    {label: '附加分', value: String(json.fjf ?? '')},
    {label: '长跑附加分', value: String(json.cpfjf ?? '')},
    {label: '参考成绩（自动结算）', value: calcReference(json).toFixed(2)},
    {label: '身高', value: String(json.sg ?? '')},
    {label: '体重', value: String(json.tz ?? '')},
    {label: '身高体重分数', value: String(json.sgtzfs ?? '')},
    {label: '肺活量', value: String(json.fhl ?? '')},
    {label: '肺活量分数', value: String(json.fhltzfs ?? '')},
    {label: '800M 跑', value: String(json.bbmp ?? '')},
    {label: '800M 跑分数', value: String(json.bbmpfs ?? '')},
    {label: '1000M 跑', value: String(json.yqmp ?? '')},
    {label: '1000M 跑分数', value: String(json.yqmpfs ?? '')},
    {label: '50M 跑', value: String(json.wsmp ?? '')},
    {label: '50M 跑分数', value: String(json.wsmpfs ?? '')},
    {label: '立定跳远', value: String(json.ldty ?? '')},
    {label: '立定跳远分数', value: String(json.ldtyfs ?? '')},
    {label: '坐位体前屈', value: String(json.zwtqq ?? '')},
    {label: '坐位体前屈分数', value: String(json.zwtqqfs ?? '')},
    {label: '仰卧起坐', value: String(json.ywqz ?? '')},
    {label: '仰卧起坐分数', value: String(json.ywqzfs ?? '')},
    {label: '引体向上', value: String(json.ytxs ?? '')},
    {label: '引体向上分数', value: String(json.ytxsfs ?? '')},
    {label: '体育课成绩', value: String(json.tykcj ?? '')},
  ].filter(it => it.value && it.value !== 'null' && it.value !== 'undefined');
}
