import {parseUrlToWebVPN} from '../src/services/webvpn/parseUrl';
import {mapScheduleRows, normalizeScheduleTime} from '../src/services/campus/scheduleParser';
import {
  buildWeekSliceViews,
  flattenSchedulesToEvents,
  parseScheduleJson,
} from '../src/services/campus/scheduleModel';
import {buildAgentContext} from '../src/services/ai/agentService';
import {demoLearningSnapshot} from '../src/fixtures/demoData';
import {
  gb2312PercentEncode,
  gb2312PercentDecode,
} from '../src/utils/encoding';
import {
  ClassroomStatus,
  PERIODS_PER_DAY,
  parseClassroomList,
  parseClassroomState,
} from '../src/services/campus/classroom';

describe('parseUrlToWebVPN', () => {
  it('maps learn host to webvpn token path', () => {
    const result = parseUrlToWebVPN('https://learn.tsinghua.edu.cn/b/wlxt/kc/xk/xsxk.shtml');
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
  const buildRow = (
    name: string,
    statusClasses: Array<string | null>,
  ): string => {
    const tds = statusClasses
      .map(cls =>
        cls === null ? '<td></td>' : `<td class="${cls}"></td>`,
      )
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
    const allAvailable: Array<string | null> = Array.from({length: 42}, () => null);
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
    expect(r1.status.slice(6).every(s => s === ClassroomStatus.AVAILABLE)).toBe(true);

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
    expect(() => parseClassroomState('<html><body>nope</body></html>', 1)).toThrow(
      /scrollContent/,
    );
  });
});
