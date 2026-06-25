export type WeatherLocale = 'zh' | 'en';

export interface CampusHourlyWeather {
  time: string;
  temperature?: number;
  apparentTemperature?: number;
  weatherCode?: number;
  condition: string;
  precipitationProbability?: number;
  precipitation?: number;
  uvIndex?: number;
  windSpeed?: number;
  humidity?: number;
}

export interface CampusDailyWeather {
  date: string;
  weatherCode?: number;
  condition: string;
  temperatureMin?: number;
  temperatureMax?: number;
  precipitationProbabilityMax?: number;
  uvIndexMax?: number;
  windSpeedMax?: number;
}

export interface CampusWeather {
  location: string;
  updatedAt?: string;
  temperature?: number;
  apparentTemperature?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  weatherCode?: number;
  condition: string;
  shortTermPrecipitationProbability?: number;
  dailyPrecipitationProbabilityMax?: number;
  precipitationProbability?: number;
  precipitation?: number;
  uvIndex?: number;
  windSpeed?: number;
  windGusts?: number;
  humidity?: number;
  hourly: CampusHourlyWeather[];
  daily: CampusDailyWeather[];
  advice: string[];
  source: 'Open-Meteo';
}

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    relative_humidity_2m?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    apparent_temperature?: number[];
    weather_code?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    uv_index?: number[];
    wind_speed_10m?: number[];
    relative_humidity_2m?: number[];
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    uv_index_max?: number[];
    wind_speed_10m_max?: number[];
  };
}

const HAIDIAN_LATITUDE = 39.9593;
const HAIDIAN_LONGITUDE = 116.2985;

function compactParams(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join('&');
}

function weatherEndpoint(): string {
  const query = compactParams({
    latitude: HAIDIAN_LATITUDE,
    longitude: HAIDIAN_LONGITUDE,
    current:
      'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m',
    hourly:
      'temperature_2m,apparent_temperature,weather_code,precipitation_probability,precipitation,uv_index,wind_speed_10m,relative_humidity_2m',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max',
    timezone: 'Asia/Shanghai',
    forecast_days: 3,
  });
  return `https://api.open-meteo.com/v1/forecast?${query}`;
}

export function describeWeatherCode(
  code: number | undefined,
  locale: WeatherLocale,
): string {
  if (code == null || Number.isNaN(code)) {
    return locale === 'en' ? 'Unknown' : '天气未知';
  }

  if (code === 0) {
    return locale === 'en' ? 'Clear' : '晴';
  }
  if ([1, 2].includes(code)) {
    return locale === 'en' ? 'Partly cloudy' : '多云';
  }
  if (code === 3) {
    return locale === 'en' ? 'Overcast' : '阴';
  }
  if ([45, 48].includes(code)) {
    return locale === 'en' ? 'Fog' : '雾';
  }
  if ([51, 53, 55, 56, 57].includes(code)) {
    return locale === 'en' ? 'Drizzle' : '小雨';
  }
  if ([61, 63, 80, 81].includes(code)) {
    return locale === 'en' ? 'Rain' : '有雨';
  }
  if ([65, 82].includes(code)) {
    return locale === 'en' ? 'Heavy rain' : '大雨';
  }
  if ([66, 67].includes(code)) {
    return locale === 'en' ? 'Freezing rain' : '冻雨';
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return locale === 'en' ? 'Snow' : '降雪';
  }
  if ([95, 96, 99].includes(code)) {
    return locale === 'en' ? 'Thunderstorm' : '雷阵雨';
  }

  return locale === 'en' ? 'Variable' : '天气多变';
}

export function buildWeatherAdvice(
  weather: Pick<
    CampusWeather,
    | 'weatherCode'
    | 'temperature'
    | 'temperatureMax'
    | 'precipitationProbability'
    | 'uvIndex'
    | 'windSpeed'
  >,
  locale: WeatherLocale,
): string[] {
  const advice: string[] = [];
  const rainLikely =
    (weather.precipitationProbability ?? 0) >= 45 ||
    [51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(
      weather.weatherCode ?? -1,
    );
  const hot = (weather.temperatureMax ?? weather.temperature ?? 0) >= 30;
  const cold = (weather.temperature ?? weather.temperatureMax ?? 99) <= 5;
  const strongUv = (weather.uvIndex ?? 0) >= 6;
  const windy = (weather.windSpeed ?? 0) >= 28;

  if (rainLikely) {
    advice.push(
      locale === 'en'
        ? 'Carry an umbrella and prefer indoor routes.'
        : '带伞，优先走室内连廊或近路。',
    );
  }
  if (hot) {
    advice.push(
      locale === 'en'
        ? 'Plan study blocks near water and shade.'
        : '适合把复习安排在有空调、补水方便的地方。',
    );
  }
  if (cold) {
    advice.push(
      locale === 'en'
        ? 'Add a warm layer before early classes.'
        : '早课和夜间出门注意加衣。',
    );
  }
  if (strongUv) {
    advice.push(
      locale === 'en'
        ? 'UV is strong; add sunscreen for outdoor walks.'
        : '紫外线偏强，户外通勤注意防晒。',
    );
  }
  if (windy) {
    advice.push(
      locale === 'en'
        ? 'Wind is noticeable; leave a few extra minutes between buildings.'
        : '风力偏大，跨楼通勤预留几分钟。',
    );
  }
  if (advice.length === 0) {
    advice.push(
      locale === 'en'
        ? 'Weather looks friendly for normal campus movement.'
        : '天气适合正常校园通勤。',
    );
  }

  return advice.slice(0, 3);
}

function firstNumber(values?: number[]): number | undefined {
  return typeof values?.[0] === 'number' ? values[0] : undefined;
}

function numberAt(
  values: number[] | undefined,
  index: number,
): number | undefined {
  return typeof values?.[index] === 'number' ? values[index] : undefined;
}

function parseWeatherTime(value?: string): number | undefined {
  const time = Date.parse(String(value ?? ''));
  return Number.isNaN(time) ? undefined : time;
}

function findCurrentHourlyIndex(
  hourlyTimes: string[] | undefined,
  currentTime: string | undefined,
): number {
  if (!hourlyTimes?.length) {
    return -1;
  }

  const hourKey = currentTime?.slice(0, 13);
  if (hourKey) {
    const sameHour = hourlyTimes.findIndex(
      time => time.slice(0, 13) === hourKey,
    );
    if (sameHour >= 0) {
      return sameHour;
    }
  }

  const currentMs = parseWeatherTime(currentTime);
  if (currentMs == null) {
    return 0;
  }

  const nextIndex = hourlyTimes.findIndex(time => {
    const timeMs = parseWeatherTime(time);
    return timeMs != null && timeMs >= currentMs;
  });
  return nextIndex >= 0 ? nextIndex : 0;
}

function maxNumber(values: Array<number | undefined>): number | undefined {
  const knownValues = values.filter(
    (value): value is number => typeof value === 'number',
  );
  return knownValues.length > 0 ? Math.max(...knownValues) : undefined;
}

function maxHourlyProbability(
  probabilities: number[] | undefined,
  startIndex: number,
  hours: number,
): number | undefined {
  if (!probabilities?.length || startIndex < 0) {
    return undefined;
  }
  return maxNumber(
    probabilities.slice(startIndex, startIndex + hours).map(value => value),
  );
}

function normalizeHourlyWeather(
  data: OpenMeteoResponse,
  locale: WeatherLocale,
): CampusHourlyWeather[] {
  const times = data.hourly?.time ?? [];
  return times.map((time, index) => {
    const weatherCode = numberAt(data.hourly?.weather_code, index);
    return {
      time,
      temperature: numberAt(data.hourly?.temperature_2m, index),
      apparentTemperature: numberAt(data.hourly?.apparent_temperature, index),
      weatherCode,
      condition: describeWeatherCode(weatherCode, locale),
      precipitationProbability: numberAt(
        data.hourly?.precipitation_probability,
        index,
      ),
      precipitation: numberAt(data.hourly?.precipitation, index),
      uvIndex: numberAt(data.hourly?.uv_index, index),
      windSpeed: numberAt(data.hourly?.wind_speed_10m, index),
      humidity: numberAt(data.hourly?.relative_humidity_2m, index),
    };
  });
}

function normalizeDailyWeather(
  data: OpenMeteoResponse,
  locale: WeatherLocale,
): CampusDailyWeather[] {
  const dates = data.daily?.time ?? [];
  return dates.map((date, index) => {
    const weatherCode = numberAt(data.daily?.weather_code, index);
    return {
      date,
      weatherCode,
      condition: describeWeatherCode(weatherCode, locale),
      temperatureMin: numberAt(data.daily?.temperature_2m_min, index),
      temperatureMax: numberAt(data.daily?.temperature_2m_max, index),
      precipitationProbabilityMax: numberAt(
        data.daily?.precipitation_probability_max,
        index,
      ),
      uvIndexMax: numberAt(data.daily?.uv_index_max, index),
      windSpeedMax: numberAt(data.daily?.wind_speed_10m_max, index),
    };
  });
}

function roundedLabel(value?: number, suffix = ''): string | undefined {
  return typeof value === 'number'
    ? `${Math.round(value)}${suffix}`
    : undefined;
}

export function dailyMaxPrecipitationMeaning(locale: WeatherLocale): string {
  return locale === 'en'
    ? 'Daily max rain probability means the highest hourly rain probability at any point of that date. It is not the current rain probability and does not mean it will rain all day.'
    : '当天最高降水概率表示这一天里某个小时段的最高降水概率，不是当前降水概率，也不代表全天都会下雨。';
}

function parseSummaryTime(value?: string): number | undefined {
  const time = Date.parse(String(value ?? ''));
  return Number.isNaN(time) ? undefined : time;
}

function summaryHourLabel(value: string, index: number, locale: WeatherLocale) {
  if (index === 0) {
    return locale === 'en' ? 'now' : '现在';
  }
  const time = parseSummaryTime(value);
  if (time == null) {
    return value;
  }
  const date = new Date(time);
  return `${String(date.getHours()).padStart(2, '0')}:00`;
}

function upcomingSummaryHours(hourly: CampusHourlyWeather[]) {
  const now = Date.now();
  const firstIndex = hourly.findIndex(item => {
    const time = parseSummaryTime(item.time);
    return time != null && time >= now - 60 * 60 * 1000;
  });
  return hourly.slice(Math.max(firstIndex, 0), Math.max(firstIndex, 0) + 6);
}

export function buildCampusWeatherSummary(
  weather: CampusWeather,
  locale: WeatherLocale,
): string {
  const zh = locale === 'zh';
  const temperature = roundedLabel(weather.temperature, '°') ?? '--';
  const apparent = roundedLabel(weather.apparentTemperature, '°');
  const range =
    roundedLabel(weather.temperatureMin, '°') &&
    roundedLabel(weather.temperatureMax, '°')
      ? `${roundedLabel(weather.temperatureMin, '°')}/${roundedLabel(
          weather.temperatureMax,
          '°',
        )}`
      : undefined;
  const shortRain = roundedLabel(
    weather.shortTermPrecipitationProbability ??
      weather.precipitationProbability,
    '%',
  );
  const dailyRain = roundedLabel(weather.dailyPrecipitationProbabilityMax, '%');
  const uv = roundedLabel(weather.uvIndex);
  const humidity = roundedLabel(weather.humidity, '%');
  const wind = roundedLabel(weather.windSpeed, ' km/h');

  const currentLine = zh
    ? [
        `${weather.location}：${temperature}，${weather.condition}`,
        apparent ? `体感 ${apparent}` : undefined,
        range ? `今日 ${range}` : undefined,
        shortRain ? `近 3 小时降水 ${shortRain}` : undefined,
        dailyRain ? `今日最高降水概率 ${dailyRain}（非当前）` : undefined,
        uv ? `UV ${uv}` : undefined,
        humidity ? `湿度 ${humidity}` : undefined,
        wind ? `风速 ${wind}` : undefined,
      ]
        .filter(Boolean)
        .join('，')
    : [
        `${weather.location}: ${temperature}, ${weather.condition}`,
        apparent ? `feels like ${apparent}` : undefined,
        range ? `today ${range}` : undefined,
        shortRain ? `3h rain ${shortRain}` : undefined,
        dailyRain
          ? `daily max rain probability ${dailyRain} (not current)`
          : undefined,
        uv ? `UV ${uv}` : undefined,
        humidity ? `humidity ${humidity}` : undefined,
        wind ? `wind ${wind}` : undefined,
      ]
        .filter(Boolean)
        .join(', ');

  const hourlyLine = upcomingSummaryHours(weather.hourly)
    .map((item, index) => {
      const temp = roundedLabel(item.temperature, '°') ?? '--';
      const rain = roundedLabel(item.precipitationProbability, '%') ?? '--';
      return `${summaryHourLabel(item.time, index, locale)} ${temp} ${
        item.condition
      } ${zh ? '降水' : 'rain'} ${rain}`;
    })
    .join(zh ? '；' : '; ');

  const dailyLine = weather.daily
    .slice(0, 3)
    .map(item => {
      const min = roundedLabel(item.temperatureMin, '°') ?? '--';
      const max = roundedLabel(item.temperatureMax, '°') ?? '--';
      const rain = roundedLabel(item.precipitationProbabilityMax, '%') ?? '--';
      return `${item.date} ${item.condition} ${min}/${max} ${
        zh ? '当天最高降水概率' : 'daily max rain probability'
      } ${rain}`;
    })
    .join(zh ? '；' : '; ');

  return [
    currentLine,
    hourlyLine
      ? zh
        ? `未来小时：${hourlyLine}`
        : `Next hours: ${hourlyLine}`
      : undefined,
    dailyLine
      ? zh
        ? `未来几天：${dailyLine}`
        : `Next days: ${dailyLine}`
      : undefined,
    weather.advice.length > 0
      ? zh
        ? `建议：${weather.advice.join('')}`
        : `Advice: ${weather.advice.join(' ')}`
      : undefined,
    zh
      ? `说明：${dailyMaxPrecipitationMeaning(locale)}`
      : `Note: ${dailyMaxPrecipitationMeaning(locale)}`,
    weather.updatedAt
      ? zh
        ? `更新时间：${weather.updatedAt}`
        : `Updated at: ${weather.updatedAt}`
      : undefined,
  ]
    .filter(Boolean)
    .join('\n');
}

export function normalizeOpenMeteoWeather(
  data: OpenMeteoResponse,
  locale: WeatherLocale,
): CampusWeather {
  const dailyCode = firstNumber(data.daily?.weather_code);
  const weatherCode = data.current?.weather_code ?? dailyCode;
  const currentHourlyIndex = findCurrentHourlyIndex(
    data.hourly?.time,
    data.current?.time,
  );
  const shortTermPrecipitationProbability = maxNumber([
    maxHourlyProbability(
      data.hourly?.precipitation_probability,
      currentHourlyIndex,
      3,
    ),
    typeof data.current?.precipitation === 'number' &&
    data.current.precipitation > 0
      ? 100
      : undefined,
  ]);
  const dailyPrecipitationProbabilityMax = firstNumber(
    data.daily?.precipitation_probability_max,
  );
  const weather: Omit<CampusWeather, 'advice' | 'condition' | 'source'> = {
    location: locale === 'en' ? 'Haidian, Beijing' : '北京市海淀区',
    updatedAt: data.current?.time,
    temperature: data.current?.temperature_2m,
    apparentTemperature: data.current?.apparent_temperature,
    temperatureMin: firstNumber(data.daily?.temperature_2m_min),
    temperatureMax: firstNumber(data.daily?.temperature_2m_max),
    weatherCode,
    shortTermPrecipitationProbability,
    dailyPrecipitationProbabilityMax,
    precipitationProbability:
      shortTermPrecipitationProbability ?? dailyPrecipitationProbabilityMax,
    precipitation: data.current?.precipitation,
    uvIndex: firstNumber(data.daily?.uv_index_max),
    windSpeed:
      data.current?.wind_speed_10m ??
      firstNumber(data.daily?.wind_speed_10m_max),
    windGusts: data.current?.wind_gusts_10m,
    humidity: data.current?.relative_humidity_2m,
    hourly: normalizeHourlyWeather(data, locale),
    daily: normalizeDailyWeather(data, locale),
  };

  return {
    ...weather,
    condition: describeWeatherCode(weatherCode, locale),
    advice: buildWeatherAdvice(weather, locale),
    source: 'Open-Meteo',
  };
}

export async function fetchHaidianWeather(
  locale: WeatherLocale,
): Promise<CampusWeather> {
  const response = await fetch(weatherEndpoint());
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`);
  }
  const data = (await response.json()) as OpenMeteoResponse;
  return normalizeOpenMeteoWeather(data, locale);
}
