import {parseUrlToWebVPN} from '../src/services/webvpn/parseUrl';
import {
  mapScheduleRows,
  normalizeScheduleTime,
} from '../src/services/campus/scheduleParser';
import {
  buildWeekSliceViews,
  flattenSchedulesToEvents,
  parseScheduleJson,
} from '../src/services/campus/scheduleModel';
import {
  buildAgentContext,
  buildSystemPrompt,
} from '../src/services/ai/agentService';
import {demoLearningSnapshot} from '../src/fixtures/demoData';
import {
  buildCampusWeatherSummary,
  buildWeatherAdvice,
  describeWeatherCode,
  normalizeOpenMeteoWeather,
} from '../src/services/campus/weather';
import {buildHomeWorkbenchBlocks} from '../src/features/home/homeWorkbench';
import {getToolByName, toolSpecs} from '../src/services/ai/tools';
import {
  isDeadlineVisible,
  selectUpcomingDeadlines,
} from '../src/state/selectors';
import {gb2312PercentEncode, gb2312PercentDecode} from '../src/utils/encoding';
import {
  CLASSROOM_PERIODS,
  ClassroomStatus,
  PERIODS_PER_DAY,
  parseClassroomList,
  parseClassroomState,
} from '../src/services/campus/classroom';
import {normalizeCampusCardTransactionAmount} from '../src/services/campus/campusCard';

describe('parseUrlToWebVPN', () => {
  it('maps learn host to webvpn token path', () => {
    const result = parseUrlToWebVPN(
      'https://learn.tsinghua.edu.cn/b/wlxt/kc/xk/xsxk.shtml',
    );
    expect(result).toContain('webvpn.tsinghua.edu.cn');
    expect(result).toContain('fcf2408e297e7c4377068ea48d546d30ca8cc97bcc');
  });
});

describe('schedule parsing', () => {
  it('normalizes chinese colon in time fields', () => {
    expect(normalizeScheduleTime('08：00')).toBe('08:00');
    const rows = mapScheduleRows([
      {
        nq: '2026-05-26',
        nr: '数据结构',
        dd: '六教',
        fl: '个人日历',
        kssj: '08：00',
        jssj: '09：35',
      },
    ]);

    expect(rows[0].startTime).toBe('08:00');
    expect(rows[0].endTime).toBe('09:35');
  });

  it('keeps full semester schedule slices addressable by week', () => {
    const schedules = parseScheduleJson([
      {
        nq: '2026-05-26',
        nr: '数据结构',
        dd: '六教',
        fl: '必修课',
        kssj: '08:00',
        jssj: '09:35',
      },
      {
        nq: '2026-06-02',
        nr: '数据结构',
        dd: '六教',
        fl: '必修课',
        kssj: '08:00',
        jssj: '09:35',
      },
    ]);

    const firstWeek = buildWeekSliceViews(schedules, '2026-05-25', 18, 0);
    const secondWeek = buildWeekSliceViews(schedules, '2026-05-25', 18, 1);
    const events = flattenSchedulesToEvents(schedules);

    expect(firstWeek).toHaveLength(1);
    expect(secondWeek).toHaveLength(1);
    expect(events.map(e => e.date)).toEqual(['2026-05-26', '2026-06-02']);
  });
});

describe('buildAgentContext', () => {
  it('includes schedule and homework summaries', () => {
    const context = buildAgentContext(demoLearningSnapshot);
    expect(context.scheduleSummary).toContain('数据结构');
    expect(context.ddlSummary).toContain('编程作业 3');
    expect(context.courseSummary).toContain('计算机网络');
  });

  it('injects weather snapshot into the system prompt', () => {
    const context = buildAgentContext(demoLearningSnapshot, {
      weatherSummary: '北京市海淀区：29°，晴，近 3 小时降水 0%',
    });
    const prompt = buildSystemPrompt(context);

    expect(context.weatherSummary).toContain('近 3 小时降水 0%');
    expect(prompt).toContain('## 海淀天气');
    expect(prompt).toContain('get_campus_weather');
    expect(prompt).toContain('北京市海淀区：29°');
    expect(prompt).toContain('不要把它说成当前降水概率');
  });
});

describe('campus weather', () => {
  it('maps Open-Meteo weather codes to campus-facing labels', () => {
    expect(describeWeatherCode(0, 'zh')).toBe('晴');
    expect(describeWeatherCode(61, 'zh')).toBe('有雨');
    expect(describeWeatherCode(95, 'en')).toBe('Thunderstorm');
  });

  it('builds practical advice from rain and UV risk', () => {
    const advice = buildWeatherAdvice(
      {
        weatherCode: 61,
        temperatureMax: 31,
        precipitationProbability: 80,
        uvIndex: 7,
        windSpeed: 12,
      },
      'zh',
    );

    expect(advice.join(' ')).toContain('带伞');
    expect(advice.join(' ')).toContain('防晒');
  });

  it('normalizes Open-Meteo data into a Haidian weather summary', () => {
    const weather = normalizeOpenMeteoWeather(
      {
        current: {
          time: '2026-06-14T10:15',
          temperature_2m: 28.4,
          apparent_temperature: 30.2,
          weather_code: 2,
          wind_speed_10m: 9,
          relative_humidity_2m: 62,
        },
        daily: {
          temperature_2m_max: [32],
          temperature_2m_min: [22],
          precipitation_probability_max: [35],
          uv_index_max: [6.5],
          weather_code: [2],
        },
      },
      'zh',
    );

    expect(weather.location).toBe('北京市海淀区');
    expect(weather.condition).toBe('多云');
    expect(weather.temperatureMax).toBe(32);
    expect(weather.advice.length).toBeGreaterThan(0);
  });

  it('uses near-term hourly rain probability instead of daily max on the home summary', () => {
    const weather = normalizeOpenMeteoWeather(
      {
        current: {
          time: '2026-06-17T14:15',
          temperature_2m: 29,
          weather_code: 0,
          precipitation: 0,
        },
        hourly: {
          time: [
            '2026-06-17T14:00',
            '2026-06-17T15:00',
            '2026-06-17T16:00',
            '2026-06-17T23:00',
          ],
          temperature_2m: [29, 30, 30, 24],
          weather_code: [0, 0, 0, 61],
          precipitation_probability: [0, 0, 0, 100],
        },
        daily: {
          time: ['2026-06-17'],
          temperature_2m_max: [32],
          temperature_2m_min: [21],
          precipitation_probability_max: [100],
          uv_index_max: [6],
          weather_code: [0],
        },
      },
      'zh',
    );

    expect(weather.condition).toBe('晴');
    expect(weather.precipitationProbability).toBe(0);
    expect(weather.shortTermPrecipitationProbability).toBe(0);
    expect(weather.dailyPrecipitationProbabilityMax).toBe(100);
    expect(weather.hourly).toHaveLength(4);
    expect(weather.daily).toHaveLength(1);
    expect(buildCampusWeatherSummary(weather, 'zh')).toContain(
      '近 3 小时降水 0%',
    );
    expect(buildCampusWeatherSummary(weather, 'zh')).toContain(
      '今日最高降水概率 100%（非当前）',
    );
    expect(buildCampusWeatherSummary(weather, 'zh')).toContain(
      '不是当前降水概率',
    );
  });
});

describe('agent tools', () => {
  it('exposes campus weather as a read-only agent tool', () => {
    const tool = getToolByName('get_campus_weather');

    expect(tool?.risk).toBe('read');
    expect(tool?.permission).toBe('campus.weather.read');
    expect(
      toolSpecs().some(spec => {
        const fn = spec.function as {name?: string} | undefined;
        return fn?.name === 'get_campus_weather';
      }),
    ).toBe(true);
  });

  it('exposes campus news search as read-only agent tools', () => {
    const names = ['get_news_list', 'search_news', 'get_news_detail'];
    const specNames = toolSpecs().map(spec => {
      const fn = spec.function as {name?: string} | undefined;
      return fn?.name;
    });

    for (const name of names) {
      const tool = getToolByName(name);
      expect(tool?.risk).toBe('read');
      expect(tool?.permission).toBe('campus.news.read');
      expect(specNames).toContain(name);
    }
  });

  it('filters tools by disabled AI permissions', () => {
    const disabledPermission = 'campus.news.read';
    const specNames = toolSpecs([disabledPermission]).map(spec => {
      const fn = spec.function as {name?: string} | undefined;
      return fn?.name;
    });

    expect(getToolByName('search_news', [disabledPermission])).toBeUndefined();
    expect(specNames).not.toContain('get_news_list');
    expect(specNames).not.toContain('search_news');
    expect(specNames).not.toContain('get_news_detail');
  });
});

describe('home workbench', () => {
  it('builds compact briefing and task plan blocks for the home screen', () => {
    const blocks = buildHomeWorkbenchBlocks({
      schedule: [
        {
          id: 's1',
          date: new Date().toISOString().slice(0, 10),
          title: '高电压工程',
          location: '六教',
          startTime: '23:00',
          endTime: '23:45',
          category: 'course',
        },
      ],
      deadlines: [
        {
          kind: 'manual',
          id: 'd1',
          title: '暂态作业',
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          submitted: false,
          courseName: '暂态',
        },
      ],
      unread: [],
      weather: normalizeOpenMeteoWeather(
        {
          current: {temperature_2m: 26, weather_code: 0},
          daily: {
            temperature_2m_max: [30],
            temperature_2m_min: [20],
            precipitation_probability_max: [10],
            uv_index_max: [4],
          },
        },
        'zh',
      ),
      locale: 'zh',
    });

    expect(blocks.map(block => block.type)).toEqual(['briefing', 'task_plan']);
    expect(blocks[0].title).toBe('今日重点');
    expect(blocks[0].subtitle).toContain('海淀');
    expect(
      blocks[1].actions?.some(action => action.type === 'add_deadline'),
    ).toBe(true);
    expect(
      blocks.some(block =>
        block.actions?.some(action => action.type === 'ask_ai'),
      ),
    ).toBe(false);
  });
});

describe('deadline visibility', () => {
  it('keeps DDL overdue within one day and hides older overdue items', () => {
    const now = new Date('2026-06-14T12:00:00+08:00').getTime();

    expect(isDeadlineVisible('2026-06-13T12:01:00+08:00', now)).toBe(true);
    expect(isDeadlineVisible('2026-06-13T11:59:00+08:00', now)).toBe(false);
    expect(isDeadlineVisible('not-a-date', now)).toBe(true);
  });

  it('filters old overdue homework and manual deadlines from todo lists', () => {
    const state = {
      learning: {
        snapshot: {
          homework: [
            {
              id: 'old-homework',
              title: '旧作业',
              courseName: '高电压工程',
              deadline: new Date(
                Date.now() - 25 * 60 * 60 * 1000,
              ).toISOString(),
              status: 'overdue',
              submitted: false,
            },
            {
              id: 'recent-homework',
              title: '刚逾期作业',
              courseName: '信号与系统',
              deadline: new Date(
                Date.now() - 23 * 60 * 60 * 1000,
              ).toISOString(),
              status: 'overdue',
              submitted: false,
            },
          ],
        },
      },
      manualDeadlines: {
        items: [
          {
            id: 'old-manual',
            title: '旧自建 DDL',
            deadline: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
            createdAt: '2026-06-01T00:00:00+08:00',
          },
          {
            id: 'future-manual',
            title: '未来自建 DDL',
            deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            createdAt: '2026-06-01T00:00:00+08:00',
          },
        ],
      },
    } as any;

    expect(selectUpcomingDeadlines(state).map(item => item.id)).toEqual([
      'recent-homework',
      'future-manual',
    ]);
  });
});

describe('campus card transactions', () => {
  it('marks merchant transactions as expenses when the API amount is positive', () => {
    expect(
      normalizeCampusCardTransactionAmount({
        txamt: 300,
        mername: '桃李园_二层大伙',
        meraddr: '桃李园',
      }),
    ).toBe(-3);
  });

  it('keeps online recharge transactions as income', () => {
    expect(
      normalizeCampusCardTransactionAmount({
        txamt: 1000,
        mername: '移动端交易(100032026060210...)',
        meraddr: '在线充值',
      }),
    ).toBe(10);
  });

  it('uses transaction type when the backend provides one', () => {
    expect(
      normalizeCampusCardTransactionAmount({txamt: 1270, tradetype: 1}),
    ).toBe(-12.7);
    expect(
      normalizeCampusCardTransactionAmount({txamt: 5000, tradetype: 2}),
    ).toBe(50);
  });
});

// ---------------------------------------------------------------
// 教室查询：编码 + HTML 解析
// 与 thu-info-lib `getClassroomList` / `getClassroomState` 行为锁定。
// ---------------------------------------------------------------

describe('gb2312 encoding', () => {
  it('encodes Chinese characters via GBK bytes', () => {
    // "六教" 在 GBK 表中是 C1 F9 BD CC
    expect(gb2312PercentEncode('六教')).toBe('%C1%F9%BD%CC');
  });

  it('leaves already-encoded ASCII strings untouched (no double-encoding %)', () => {
    // 关键回归：旧版会把 '%' 二次编码成 '%25'，导致 href 抓下来已编码的串送回 URL 后无法命中
    expect(gb2312PercentEncode('%C1%F9%BD%CC')).toBe('%C1%F9%BD%CC');
  });

  it('keeps non-CJK chars (ASCII / numbers / underscore) as-is', () => {
    expect(gb2312PercentEncode('Room_2024')).toBe('Room_2024');
  });

  it('mixes Chinese and ASCII correctly', () => {
    expect(gb2312PercentEncode('六教_v2')).toBe('%C1%F9%BD%CC_v2');
  });

  it('round trips Chinese via encode → decode', () => {
    const original = '紫荆公寓';
    expect(gb2312PercentDecode(gb2312PercentEncode(original))).toBe(original);
  });

  it('decodes percent-encoded GBK back to Chinese', () => {
    expect(gb2312PercentDecode('%C1%F9%BD%CC')).toBe('六教');
  });

  it('leaves raw Chinese intact when given to decode (no garbage low-byte read)', () => {
    // 旧 gbkPercentDecode 用 charCodeAt&0xff 取多字节字符的低字节，会得到乱码；
    // 新实现：只处理 %XX 段，其它原样返回。
    expect(gb2312PercentDecode('六教')).toBe('六教');
  });
});

describe('parseClassroomList', () => {
  it('extracts building name + searchName from .w30 a[href^="/http/"]', () => {
    const html = `
      <html><body>
        <table>
          <tr>
            <td class="w30">
              <a href="/http/abc/pk.classroomctrl.do?m=qyClassroomState&classroom=%C1%F9%BD%CC&weeknumber=3">六教</a>
            </td>
            <td class="w30">
              <a href="/http/abc/pk.classroomctrl.do?m=qyClassroomState&classroom=%CE%F7%BD%D7&weeknumber=3">西阶</a>
            </td>
            <td class="other">
              <a href="/somethingelse">忽略</a>
            </td>
          </tr>
        </table>
      </body></html>
    `;
    const list = parseClassroomList(html);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({
      name: '六教',
      weekNumber: 3,
      // 关键：与上游一致，searchName 直接保留 href 里的原串（已 GBK 编码），不再 round-trip
      searchName: '%C1%F9%BD%CC',
    });
    expect(list[1].name).toBe('西阶');
    expect(list[1].searchName).toBe('%CE%F7%BD%D7');
  });

  it('throws when no .w30 anchors found', () => {
    expect(() => parseClassroomList('<html><body></body></html>')).toThrow(
      /教学楼/,
    );
  });
});

describe('parseClassroomState', () => {
  it('uses Tsinghua big-period classroom times', () => {
    expect(PERIODS_PER_DAY).toBe(6);
    expect(CLASSROOM_PERIODS.map(p => p.timeRange)).toEqual([
      '08:00-09:35',
      '09:50-12:15',
      '13:30-15:05',
      '15:20-16:55',
      '17:10-18:45',
      '19:20-21:45',
    ]);
  });

  const buildRow = (
    name: string,
    statusClasses: Array<string | null>,
  ): string => {
    const tds = statusClasses
      .map(cls => (cls === null ? '<td></td>' : `<td class="${cls}"></td>`))
      .join('');
    // 与上游 HTML 结构对齐（基于 thu-info-lib 解析路径 `tr.children[1].children[2]` + `slice(3)` 推断）：
    //   tr 子节点序：
    //     children[0] = whitespace TextNode
    //     children[1] = 名字 <td>（其内 children[1]=<a>, children[2]=text(name)）
    //     children[2] = whitespace TextNode
    //     children[3..] = 42 个状态 <td>（之间穿插 whitespace TextNode）
    return `
      <tr>
        <td>
          <a name="anchor"></a>
          ${name}
        </td>
        ${tds}
      </tr>
    `;
  };

  it('parses scrollContent rows with classroom name + 42 status cells', () => {
    // 42 = 7 天 × 6 节
    const allAvailable: Array<string | null> = Array.from(
      {length: 42},
      () => null,
    );
    // 周一第 1 节上课、第 2 节考试、第 3 节借用、第 4 节停用
    const monday: Array<string | null> = [
      'onteaching',
      'onexam',
      'onborrowed',
      'ondisabled',
      null,
      null,
    ];
    const room1 = monday.concat(Array.from({length: 36}, () => null));
    const html = `
      <html><body>
        <select id="weeknumber">
          <option value="1">第1周</option>
          <option value="2">第2周</option>
        </select>
        <table>
          <tr><td colspan="6">周一(12-04)</td><td colspan="6">周二(12-05)</td><td colspan="6">周三(12-06)</td><td colspan="6">周四(12-07)</td><td colspan="6">周五(12-08)</td><td colspan="6">周六(12-09)</td><td colspan="6">周日(12-10)</td></tr>
        </table>
        <div id="scrollContent">
          <table>
            <tbody>
              ${buildRow('6A101:60(人)', room1)}
              ${buildRow('6A102:120(人)', allAvailable)}
            </tbody>
          </table>
        </div>
      </body></html>
    `;
    const result = parseClassroomState(html, 1);
    expect(result.validWeekNumbers).toEqual([1, 2]);
    expect(result.currentWeekNumber).toBe(1);
    expect(result.datesOfCurrentWeek).toEqual([
      '12-04',
      '12-05',
      '12-06',
      '12-07',
      '12-08',
      '12-09',
      '12-10',
    ]);
    expect(result.classroomStates).toHaveLength(2);

    const r1 = result.classroomStates[0];
    expect(r1.name).toBe('6A101:60(人)');
    expect(r1.status).toHaveLength(7 * PERIODS_PER_DAY);
    // 周一 6 节按预期映射
    expect(r1.status.slice(0, 6)).toEqual([
      ClassroomStatus.TEACHING,
      ClassroomStatus.EXAM,
      ClassroomStatus.BORROWED,
      ClassroomStatus.DISABLED,
      ClassroomStatus.AVAILABLE,
      ClassroomStatus.AVAILABLE,
    ]);
    // 其他天全空
    expect(r1.status.slice(6).every(s => s === ClassroomStatus.AVAILABLE)).toBe(
      true,
    );

    const r2 = result.classroomStates[1];
    expect(r2.name).toBe('6A102:120(人)');
    expect(r2.status.every(s => s === ClassroomStatus.AVAILABLE)).toBe(true);
  });

  it('treats colBound-only cells as AVAILABLE separators', () => {
    const cells: Array<string | null> = Array.from({length: 42}, (_, i) =>
      // 每 6 个加一个 colBound 分隔（其实和正经状态混合）
      i === 5 ? 'colBound' : null,
    );
    const html = `
      <div id="scrollContent">
        <table>
          <tbody>
            ${buildRow('A:10(人)', cells)}
          </tbody>
        </table>
      </div>
    `;
    const result = parseClassroomState(html, 1);
    expect(result.classroomStates[0].status[5]).toBe(ClassroomStatus.AVAILABLE);
  });

  it('throws when scrollContent missing entirely (session likely dead)', () => {
    expect(() =>
      parseClassroomState('<html><body>nope</body></html>', 1),
    ).toThrow(/scrollContent/);
  });
});
