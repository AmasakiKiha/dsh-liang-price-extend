# 梁文峰 / 梁文谷 峰谷价提示器 扩展鲸鱼联动版

> DeepSeek Harness 侧边栏插件：显示当前是高峰还是空闲、距离切换的倒计时，以及空闲时段的 5 折提示。扩展版增加了与小鲸鱼挂件的联动，不再有需要每年手改的数据文件，保证与小鲸鱼的峰谷价完全同步，也不会出现日历没写，峰谷价判断错误。

## 它做什么

在侧边栏底部常驻一行，实时回答三件事：

| 问题 | 显示 |
| --- | --- |
| 现在贵不贵 | `省钱中`（空闲）/ `挨宰中`（高峰） |
| 还有多久变 | 秒级倒计时到下一次切换 |
| 能省多少 | 空闲时段 5 折（官方：空闲价为高峰价的一半） |

时段规则取自 [dsh-whale-widget]小鲸鱼挂件，相比原版做了与小鲸鱼挂件的联动 [dsh-whale-widget]。推荐安装小鲸鱼。
![whale](assets/whale.png)

## 峰谷数据从哪来

v1.2.0 起不再自带节假日表，改成**lind到 [dsh-whale-widge](https://github.com/moonlight328/dsh-whale-widget) 。**

```
GET /dsh-whale/balance.json
→ { isPeak: boolean, peakNextChangeAt: <unix 秒>, peakHolidays: [...], version: "0.4.2", ... }
```

- `isPeak`：对方按官方口径（周末 + 法定节假日 + 两个窗口）算好的结论；
- `peakNextChangeAt`：对方算好的下一次切换时刻；
- `peakHolidays`：它内置的法定节假日清单，本插件只用它做展示。

节日数据的年度维护交给 whale-widget（它每年 11 月需要补下一年），本插件不再有需要每年手改的数据文件。

### 降级路径

whale-widget 没装、被关、返回 401、或者载荷不合法，都会**静默退回本地规则**：周末 → 空闲；工作日只看两个窗口。这条本地规则在官方口径下对周末与工作日永远成立，唯一会错的情形是法定放假日落在工作日（元旦、春节、清明这类）——那天会显示成"高峰"，实际是谷价。

所以界面上有三种可见状态：

| 状态 | 表现 | 含义 |
| --- | --- | --- |
| 徽章正常 | 实线 | 数据来自 whale-widget |
| 徽章灰色虚线 | 悬停提示「本地推算」 | 没拿到宿主数据，用本地规则 |
| 徽章点状 | 悬停提示「与宿主不一致」 | 双方判断相左，按宿主为准 |

想确认到底接上没有：把鼠标停在那行字上，title 会写明数据源；走本地规则时后面还会带上原因（`HTTP 401` / `payload` / 网络错误），照着它就能定位是哪一环断了。

### 元数据的鉴权

`/dsh-whale/*` 全部在 DSH 的信任栅栏后面：Host/Origin 必须同源，并且需要一个签名的会话 cookie（`dsh-client-connection` 的 `BrowserAuth`，`isAuthenticated` 校验的就是它）。页面里的同源请求会自动带上这个 cookie，所以插件在侧边栏里能取到；从 shell 里 `curl` 同一个地址会得到 401 —— 那是没有 cookie，不是插件写错了。

## 安装

本包是 DSH bundle（`dsh.bundle.patch` + `dsh.client`），Host 半是空实现，界面全在构建产物 `client.js` 里。

1. 克隆本仓库到本机；
2. 用 DSH 的插件管理器（`plugin_manager` / Plugins 页的本地安装）指向该目录；
3. 侧边栏底部出现提示条，无需重启 Host。

换机器重新安装一次即可。

## 目录结构

```
src/logic.mjs        峰谷判定、边界推算、宿主载荷校验、describe() 聚合（纯函数，可测）
src/frames.js        31 张 base64 档位图
src/style.js         样式（跟随 DSH 主题变量）
src/ui.template.js   组件与注册逻辑，构建时把上面三块内联进来
build.mjs            内联构建 → client.js
test.mjs             逻辑自测（76 项）
```

`client.js` 是构建产物，不要手改；改 `src/` 后跑 `node build.mjs` 重建，再 `node test.mjs` 自测。

## 显示效果

峰价（工作日 9:00–12:00、14:00–18:00）：

![峰价实机截图](assets/peak.jpg)

谷价（其余时段，含周末和法定节假日）：

![谷价实机截图](assets/valley.jpg)

- 谷价：`省钱中`，倒计时告诉你还有多久进峰；
- 峰价：`挨宰中`，倒计时告诉你还有多久回谷；
- 侧边栏收成 56px 图标条时只留头像。

## 为什么头像会变

31 张档位图（`00` 普通人 → `30` 梁祖），按当前时段的进度线性切换，**并且带方向**：

- 峰段：档位从 `0` 走到 `30`，人像一路"梁祖化"；
- 谷段：档位从 `30` 退回 `0`，人像一路退烧。

所以每次峰谷切换，头像都会从一端跳到另一端（峰起 → 档 0，谷起 → 档 30），段内再一档一档挪。谷段（尤其跨夜那段 15 小时）一档要走半小时，看着慢是正常的——它不是动画，是进度指示器。它只是视觉反馈，不参与任何判断；不看头像也不影响使用。

## 其他配置

`src/logic.mjs` 顶部还有两个常量：

- `PEAK_WINDOWS`：高峰时段（分钟数，默认 `[9:00–12:00]`、`[14:00–18:00]`）；
- `TZ_OFFSET_MS`：计价时区偏移，默认 UTC+8（中国 1991 年后无夏令时，固定偏移安全）。

时区按北京时间算，与宿主机时区设置无关。

## 副作用

- 13:59 会莫名焦虑；
- 可能为了看「梁祖」故意拖到 17:59；
- 不会让你的 token 变便宜，一分都不会。

## 版权与致谢

- 代码：MIT（见 `LICENSE`）；
- **本项目是 [sukholovskyyy/dsh-liang-price-badge](https://github.com/sukholovskyyy/dsh-liang-price-badge)（MIT）的改版**，上游版权与许可声明完整保留在 `THIRD-PARTY-NOTICES.md`；
- 31 张档位图（`frame-00` … `frame-30`）：来自 [Lichtspektrum/liang-intensity-calibrator](https://github.com/Lichtspektrum/liang-intensity-calibrator)（MIT，Copyright (c) 2026 Lichtspektrum），经 [TerryYu12/dsh-liang-calibrator](https://github.com/TerryYu12/dsh-liang-calibrator)（MIT-0）取用，裁脸缩到 72×72 后内联；完整许可见 `THIRD-PARTY-NOTICES.md`；
- 本仓库**不含真人照片**，档位图是 AI 生成的网络梗图。
- 非 DeepSeek / Harness 官方项目，与官方无隶属关系。

## 免责声明

纯属网络恶搞与视觉玩梗，不代表梁文锋、DeepSeek 或任何机构的真实观点，也不构成对真实人物或机构的事实陈述。档位图涉及真实人物形象，仅作梗图演示；权利人若提出异议，会立刻删除相关素材。

## License

MIT

---

点个 Star，梁祖保佑你这个月 token 不超支。

这个是由宽宽的大肥鱼自动上传的项目。本分支做了两轮本地改造：v1.1.0 抽出可测逻辑并接入年度数据；v1.2.0 把峰谷判断改为向 dsh-whale-widget 取数、弃用自带节假日表，并把官方口径修正为「周末全天空闲，调休补班日不例外」。
