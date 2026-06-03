export type LaundryPlatform = 'jieli' | 'haile';

export interface LaundryBuilding {
  id: string;
  name: string;
  platform: LaundryPlatform;
}

export interface LaundryBuildingGroup {
  name: string;
  buildings: LaundryBuilding[];
}

export type LaundryMachineStatus = 'idle' | 'working' | 'error';

export interface LaundryMachine {
  type: string;
  name: string;
  floor: string;
  status: LaundryMachineStatus;
  etaMinutes: number | null;
  updatedAt?: string;
  location?: string | null;
}

export interface LaundryFloor {
  name: string;
  machines: LaundryMachine[];
}

interface JieliTowerItem {
  text?: unknown;
  value?: unknown;
}

interface JieliStatusItem {
  floorName?: unknown;
  status?: unknown;
  macUnionCode?: unknown;
}

interface HailePositionItem {
  id?: unknown;
  name?: unknown;
}

interface HaileDeviceItem {
  name?: unknown;
  state?: unknown;
}

const JIELI_TOWER_URL = 'https://api.cleverschool.cn/washapi4/device/tower';
const JIELI_STATUS_URL = 'https://api.cleverschool.cn/washapi4/device/status';
const JIELI_LOCATION_URL = 'https://app.cs.tsinghua.edu.cn/Api/JieliWashers';
const HAILE_POSITIONS_URL = 'https://yshz-user.haier-ioc.com/position/nearPosition';
const HAILE_DEVICES_URL =
  'https://yshz-user.haier-ioc.com/position/deviceDetailPage';

const HAILE_CATEGORIES = [
  {code: '00', label: '洗衣机'},
  {code: '01', label: '洗鞋机'},
  {code: '02', label: '烘干机'},
] as const;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function chineseNumberToInt(raw: string): number | null {
  if (!raw) {
    return null;
  }
  if (raw === '十') {
    return 10;
  }
  const tenIndex = raw.indexOf('十');
  if (tenIndex >= 0) {
    const left = raw.slice(0, tenIndex);
    const right = raw.slice(tenIndex + 1);
    const tens = left ? CHINESE_DIGITS[left] : 1;
    const ones = right ? CHINESE_DIGITS[right] : 0;
    if (tens == null || ones == null) {
      return null;
    }
    return tens * 10 + ones;
  }
  return CHINESE_DIGITS[raw] ?? null;
}

function sortNumbers(value: string): number[] {
  const result: number[] = [];
  const pattern = /\d+|[零一二两三四五六七八九十]+/g;
  for (const match of value.matchAll(pattern)) {
    const token = match[0];
    const parsed = /^\d+$/.test(token)
      ? Number(token)
      : chineseNumberToInt(token);
    if (parsed != null) {
      result.push(parsed);
    }
  }
  return result;
}

function compareByNumberThenName(a: string, b: string): number {
  const aNums = sortNumbers(a);
  const bNums = sortNumbers(b);
  const len = Math.min(aNums.length, bNums.length);
  for (let i = 0; i < len; i += 1) {
    const diff = aNums[i] - bNums[i];
    if (diff !== 0) {
      return diff;
    }
  }
  if (aNums.length !== bNums.length) {
    return aNums.length - bNums.length;
  }
  return a.localeCompare(b, 'zh-Hans-CN');
}

function compareMachines(a: LaundryMachine, b: LaundryMachine): number {
  const left = a.location || a.name;
  const right = b.location || b.name;
  const byLocation = compareByNumberThenName(left, right);
  if (byLocation !== 0) {
    return byLocation;
  }
  return compareByNumberThenName(a.type, b.type);
}

async function fetchJson<T>(
  url: string,
  options?: RequestInit,
  errorMessage = '洗衣机服务请求失败',
): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`${errorMessage}（HTTP ${res.status}）`);
  }
  return res.json() as Promise<T>;
}

function groupJieliBuilding(building: LaundryBuilding): number {
  if (building.name.includes('紫荆')) {
    return 0;
  }
  if (building.name.includes('南区')) {
    return 1;
  }
  if (building.name.includes('双清')) {
    return 2;
  }
  return 3;
}

async function fetchJieliBuildings(): Promise<LaundryBuildingGroup[]> {
  const response = await fetchJson<{
    errorCode?: unknown;
    errorMsg?: unknown;
    data?: JieliTowerItem[];
  }>(
    JIELI_TOWER_URL,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: '{}',
    },
    '洁力洗衣机楼宇加载失败',
  );

  if (response.errorCode != null) {
    throw new Error(asString(response.errorMsg) || '洁力洗衣机接口返回失败');
  }

  const groups: LaundryBuildingGroup[] = [
    {name: '紫荆公寓', buildings: []},
    {name: '南区宿舍', buildings: []},
    {name: '双清公寓', buildings: []},
    {name: '其他位置', buildings: []},
  ];

  for (const item of response.data ?? []) {
    const id = asString(item.value);
    const name = asString(item.text);
    if (!id || id === '0' || !name) {
      continue;
    }
    const building: LaundryBuilding = {id, name, platform: 'jieli'};
    groups[groupJieliBuilding(building)].buildings.push(building);
  }

  return groups
    .map(group => ({
      ...group,
      buildings: group.buildings.sort((a, b) =>
        compareByNumberThenName(a.name, b.name),
      ),
    }))
    .filter(group => group.buildings.length > 0);
}

async function fetchHaileBuildings(): Promise<LaundryBuildingGroup[]> {
  const response = await fetchJson<{
    code?: unknown;
    data?: {items?: HailePositionItem[]};
  }>(
    HAILE_POSITIONS_URL,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        lng: 116.32697,
        lat: 40.00281,
        page: 1,
        pageSize: 30,
      }),
    },
    '海乐生活楼宇加载失败',
  );

  if (response.code !== 0) {
    return [];
  }

  const buildings = (response.data?.items ?? [])
    .map((item): LaundryBuilding => {
      return {
        id: asString(item.id),
        name: asString(item.name),
        platform: 'haile',
      };
    })
    .filter(item => item.id && item.name.includes('清华'))
    .sort((a, b) => compareByNumberThenName(a.name, b.name));

  return buildings.length > 0 ? [{name: '海乐生活', buildings}] : [];
}

export async function getLaundryBuildings(): Promise<LaundryBuildingGroup[]> {
  const [jieli, haile] = await Promise.allSettled([
    fetchJieliBuildings(),
    fetchHaileBuildings(),
  ]);

  const groups: LaundryBuildingGroup[] = [];
  if (jieli.status === 'fulfilled') {
    groups.push(...jieli.value);
  }
  if (haile.status === 'fulfilled') {
    groups.push(...haile.value);
  }

  if (groups.length === 0) {
    const message =
      jieli.status === 'rejected'
        ? jieli.reason instanceof Error
          ? jieli.reason.message
          : '洁力洗衣机楼宇加载失败'
        : haile.status === 'rejected' && haile.reason instanceof Error
        ? haile.reason.message
        : '洗衣机楼宇加载失败';
    throw new Error(message);
  }

  return groups;
}

function parseJieliStatus(rawStatus: string): {
  status: LaundryMachineStatus;
  etaMinutes: number | null;
  updatedAt?: string;
} {
  const status = /待机|空闲/.test(rawStatus)
    ? 'idle'
    : /工作|运转|运行/.test(rawStatus)
    ? 'working'
    : 'error';
  const eta = rawStatus.match(/剩余\D*(\d+)/);
  const updatedAt =
    rawStatus.match(/更新[:：]?\s*([0-9./-]+\s+[0-9:]+)/)?.[1] ??
    rawStatus.match(/更新[:：]?\s*([0-9:]+)/)?.[1];

  return {
    status,
    etaMinutes: eta ? Number(eta[1]) : null,
    updatedAt,
  };
}

function parseJieliMachine(
  item: JieliStatusItem,
  locations: Record<string, string>,
): LaundryMachine | null {
  const floor = asString(item.floorName) || '未知楼层';
  const rawStatus = asString(item.status);
  const [type, ...nameParts] = asString(item.macUnionCode).split(/\s+/);
  const name = nameParts.join(' ') || asString(item.macUnionCode) || '洗衣机';
  const status = parseJieliStatus(rawStatus);

  return {
    type: type || '洗衣机',
    name,
    floor,
    location: locations[name] ?? null,
    ...status,
  };
}

async function getJieliLaundryFloors(
  building: LaundryBuilding,
): Promise<LaundryFloor[]> {
  const statusPromise = fetchJson<{
    errorCode?: unknown;
    errorMsg?: unknown;
    data?: JieliStatusItem[];
  }>(
    JIELI_STATUS_URL,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({towerKey: building.id}),
    },
    '洁力洗衣机状态加载失败',
  );

  const locationPromise = fetchJson<Record<string, string>>(
    `${JIELI_LOCATION_URL}?building=${encodeURIComponent(building.id)}`,
    undefined,
    '洁力洗衣机位置加载失败',
  );

  const [statusResult, locationResult] = await Promise.allSettled([
    statusPromise,
    locationPromise,
  ]);

  if (statusResult.status === 'rejected') {
    throw statusResult.reason;
  }

  const response = statusResult.value;
  if (response.errorCode != null) {
    throw new Error(asString(response.errorMsg) || '洁力洗衣机接口返回失败');
  }

  const locations =
    locationResult.status === 'fulfilled' ? locationResult.value : {};
  const byFloor = new Map<string, LaundryMachine[]>();

  for (const item of response.data ?? []) {
    const machine = parseJieliMachine(item, locations);
    if (!machine) {
      continue;
    }
    const machines = byFloor.get(machine.floor) ?? [];
    machines.push(machine);
    byFloor.set(machine.floor, machines);
  }

  return Array.from(byFloor.entries())
    .sort(([a], [b]) => compareByNumberThenName(a, b))
    .map(([name, machines]) => ({
      name,
      machines: machines.sort(compareMachines),
    }));
}

function haileStatus(state: unknown): LaundryMachineStatus {
  if (state === 1) {
    return 'idle';
  }
  if (state === 2) {
    return 'working';
  }
  return 'error';
}

async function getHaileLaundryFloors(
  building: LaundryBuilding,
): Promise<LaundryFloor[]> {
  const batches = await Promise.all(
    HAILE_CATEGORIES.map(async category => {
      const response = await fetchJson<{
        code?: unknown;
        data?: {items?: HaileDeviceItem[]};
      }>(
        HAILE_DEVICES_URL,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            positionId: building.id,
            categoryCode: category.code,
            page: 1,
            floorCode: '',
            pageSize: 100,
          }),
        },
        '海乐生活设备状态加载失败',
      );
      if (response.code !== 0) {
        return [];
      }
      return (response.data?.items ?? []).map((item): LaundryMachine => {
        const name = asString(item.name) || category.label;
        return {
          type: category.label,
          name,
          floor: '海乐生活',
          status: haileStatus(item.state),
          etaMinutes: null,
          updatedAt: new Date().toLocaleTimeString('zh-CN', {hour12: false}),
        };
      });
    }),
  );

  const machines = batches
    .flat()
    .sort(compareMachines);

  return machines.length > 0 ? [{name: '海乐生活', machines}] : [];
}

export async function getLaundryFloors(
  building: LaundryBuilding,
): Promise<LaundryFloor[]> {
  if (building.platform === 'haile') {
    return getHaileLaundryFloors(building);
  }
  return getJieliLaundryFloors(building);
}
