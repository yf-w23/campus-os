# 清华大学统一身份认证登录指南

> 本文档说明 Campus OS 当前使用的登录、SSO 和会话恢复实现。清华认证端点和页面结构可能变化；它不是官方协议规范，也不保证第三方实现长期可用。

**适用版本：v2.1.1 · 最后核对：2026-07-10**

## 1. 传输模型

Campus OS 使用两条官方访问路径：

```
App
 ├─ WebVPN → OAuth → ID：初始认证、信息门户及多数校园子系统 roam
 └─ 直接 SSO 域：learn.tsinghua.edu.cn / zhjw.cic.tsinghua.edu.cn
     （先由 ID / SSO ticket 建立会话，再直接请求官方域名）
```

因此「所有请求都经 WebVPN」并不准确。必须严格串行的是**认证启动链与单个 roam 链**，因为每一步依赖前一步写入 Cookie；已建立会话后的独立业务读取可以按各服务需要执行。

WebVPN 不只是 URL 代理：它维护 WebVPN Cookie 与部分子系统后端会话。React Native 的 `CookieManager`、`fetch` 和用于 callback 的 XHR 必须共享同一份 Cookie 状态。

## 2. 实现位置与前置条件

| 文件 | 职责 |
| --- | --- |
| `src/services/auth/tsinghuaAuth.ts` | 主登录、2FA、roam、会话校验与恢复 |
| `src/services/auth/sm2.ts` | SM2 密码加密与公钥提取 |
| `src/services/auth/htmlParse.ts` | SM2 公钥、callback 与错误文本抽取 |
| `src/services/webvpn/transport.ts` | Cookie 同步、HTTP、GBK 解码、CSRF 与默认 roam |
| `src/services/webvpn/constants.ts` | 官方域名、端点、yyfwid 与学习 / 教务 URL |
| `src/storage/secureStorage.ts` | Keychain 凭证、API Key 与邮箱专用密码 |
| `src/domain/session.ts`、`src/domain/campus.ts` | 认证状态和凭证类型 |

前置要求：

- Cookie 必须持久化并在响应后同步；WebView 需要时也要同步 Cookie。
- HTTP 客户端要支持 URL-encoded 表单、重定向和 GBK / GB2312 解码。
- 使用当前 `USER_AGENT`，并且绝不在日志中输出密码、SM2 密文、Cookie、ticket 或完整 callback URL。
- 学号在提交前仅接受数字；设备指纹为去掉连字符的 UUID，并随凭证保存在 Keychain。

## 3. 当前登录链

`TsinghuaAuthService.login()` 的启动链如下。除明确的失败分支外，顺序不可调整。

1. 清空 Cookie，避免旧会话污染。
2. 连续两次 `GET WEBVPN_OAUTH_LOGIN_URL`，使 WebVPN → OAuth → ID 链落到登录表单。
3. 从 `id="sm2publicKey"` 元素文本提取 SM2 公钥。
4. 用 `sm-crypto` 加密密码，并在密文前加 `04` 前缀。
5. 向 `ID_LOGIN_URL` 以 `application/x-www-form-urlencoded` 提交 `i_user`、`i_pass`、`fingerPrint`、`fingerGenPrint: ''`、`fingerGenPrint3: ''` 和 `i_captcha: ''`。
6. 如果响应含 `二次认证`，暂停为 `pendingTwoFactor`；由 UI 完成 2FA 后再继续主链。
7. 从登录成功页取第一个 callback href，**仅用一次** `syncCookiesViaXhr()` 跟随，换取 WebVPN Cookie。
8. 用 `roamIdPolicy(credentials, INFO_PORTAL_YYFWID)` 建立信息门户会话；roam 期间也可能再次要求 2FA。
9. 获取 CSRF，调用 `infoUserData`，确认 JSON 的 `object.ryh` 等于学号。
10. 尝试激活 learn：为 learn yyfwid 再走 ID 登录，提取 callback 中 ticket，调用 `learnAuthRoam`，最后从学生首页提取 `_csrf`。

第 10 步失败不会使主登录失败：校园功能仍可使用，学习页会在后续同步时反映该失败。

### 关键代码

```typescript
const encryptedPassword = encryptPassword(password, publicKey);
await webvpnTransport.fetchText(ID_LOGIN_URL, {
  body: {
    i_user: studentId,
    i_pass: encryptedPassword,
    fingerPrint: fingerprint,
    fingerGenPrint: '',
    fingerGenPrint3: '',
    i_captcha: '',
  },
});
```

`sm-crypto` 返回的密文不含所需前缀，当前实现固定为：

```typescript
return '04' + sm2.doEncrypt(password, publicKey);
```

## 4. 二次认证（2FA）

2FA 可在主登录、子系统 roam 或会话恢复中出现。当前实现支持微信、短信和 TOTP；可用方式由 `FIND_APPROACHES` 返回。提交逻辑位于 `fetchTwoFactorApproaches()`、`sendTwoFactorCode()` 和 `submitTwoFactorCode()`。

- 短信和微信验证码时效较短；过期后应重新发送。
- 用户选择信任设备时，`saveFinger` 失败不应中断认证。
- roaming 再次触发 2FA 时，`LoginScreen` 通过 `setTwoFactorHandler()` 提供同一套交互；不要把它视为异常成功。
- 认证方式和服务器字段可能变化，应该以 `tsinghuaAuth.ts` 的解析和错误提示为准，不能将示例 JSON 当作稳定契约。

## 5. 子系统 roam

### 信息门户与多数校园子系统

`roamIdPolicy()` 为目标 yyfwid 重新取得登录表单和 SM2 公钥、提交一次 ID 登录，随后把 callback 包装为 `oauth.tsinghua.edu.cn/lb-auth/lbredirect` 并跟随一次。最终 HTML 若仍含 `id="sm2publicKey"`，代表回落到了登录页，不能视为会话建立成功。

当前常用 yyfwid 在 `constants.ts` 中维护：

| 子系统 | 常量 |
| --- | --- |
| 信息门户 | `INFO_PORTAL_YYFWID` |
| 网络学堂登录 | `LEARN_LOGIN_YYFWID` |
| 宿舍电费 / 健康 | `SUBSYSTEM_YYFWID.dormElectricity` / `.dormHealth` |
| 图书馆座位 | `SUBSYSTEM_YYFWID.librarySeat` |
| 清华邮箱门户入口 | `SUBSYSTEM_YYFWID.mail` |

### 特殊路径

- **校园卡**：`roamCardPolicy()` 直接跟随 callback，保证 Cookie 写入校园卡域；不要套用普通 `lbredirect` 规则。
- **研读间**：`cabLogin()` 先从 `authAddress` 得到动态 payload，再走 CAB roam 并用 `userInfo` 校验。
- **网络学堂 / 教务**：通过 SSO ticket 激活后，分别直接请求 `learn.tsinghua.edu.cn` 和 `zhjw.cic.tsinghua.edu.cn`，并非普通 WebVPN URL 包装。

## 6. 会话恢复

`withSessionRecovery()` 是两层兜底：

1. 先执行原业务操作。
2. 失败时使用目标子系统的 `onReroam`（默认为信息门户）重建会话并重试。
3. 再失败时，从 Keychain hydrate 凭证，执行一次完整 `login()`、重建子系统会话并重试。
4. 三次仍失败时抛出第一次业务错误，保留最接近用户操作的错误上下文。

`ensureFullReLogin()` 用 `reloginInflight` 合并并发重登录；不要在业务服务中自行并发调用完整登录。

## 7. 字符编码

`WebVPNTransport` 按以下顺序决定响应编码：

1. 优先使用 `Content-Type` 的 `charset`。
2. 命中已知 GBK 子系统 token（教务、电费、选课、体育）时按 GBK 读取。
3. 直连 `zhjw.cic.tsinghua.edu.cn` 时按 GBK 读取。
4. 其余按 UTF-8 读取。

React Native Android 的非 UTF-8 响应使用 `FileReader.readAsText(blob, charset)`。向 GBK 子系统提交中文参数时使用 `utils/encoding.ts` 的 `gb2312PercentEncode()`，避免 UTF-8 percent-encode 导致服务端解析错误。

## 8. 排障清单

| 症状 | 优先检查 |
| --- | --- |
| `登录页无 sm2publicKey` | 两次 OAuth 预热是否都完成；网络、Cookie 和登录页结构是否变化 |
| `msg_note` 提示账号错误 | 学号、密码和数字学号校验 |
| callback 后仍未登录 | callback 是否被重复消费；必须只走一次 XHR |
| `USER_DATA` 非 JSON 或 `ryh` 不符 | 信息门户 roam 是否成功；重建会话 |
| `learn: no _csrf in student home` | learn ticket、学生首页和会话是否有效；主登录本身仍可成功 |
| `lbredirect` 落回登录页 | yyfwid、一次性 ticket、2FA 状态或 Cookie 同步 |
| 中文乱码 | 响应 URL 是否命中 GBK 规则；是否错误使用 UTF-8 解码 |

排障时使用 `tsinghuaAuthService.getLastTrace()` 获取最近十个步骤。日志仅应记录阶段名和长度，严禁记录敏感材料。

## 9. 维护边界

- 常量、端点、yyfwid 和页面字段以 `src/services/webvpn/constants.ts` 与当前实现为唯一维护源。
- 认证协议变更后，应先用真实账号在隔离调试环境逐步验证，再更新本指南和测试；不要根据过期文档猜测写操作。
- 参考实现和许可证范围见 [`SOURCE-REUSE-LOG.md`](SOURCE-REUSE-LOG.md)。上游协议可提供设计参照，但本项目并不直接依赖 `@thu-info/lib` 或 `thu-learn-lib`。
