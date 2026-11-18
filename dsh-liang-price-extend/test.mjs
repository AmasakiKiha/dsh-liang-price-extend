// 逻辑自测：node test.mjs
// 只测纯函数（src/logic.mjs）；界面与鲸鱼挂件的联调靠肉眼验。
import {
  VERSION, LEVELS, pad, beijingParts, dateKey, epochAt, isWeekend, isPeakLocal,
  nextBoundaryLocal, prevBoundaryLocal, usableHost, describe, clamp01, TZ_OFFSET_MS,
} from './src/logic.mjs';

let n = 0;
const fails = [];
function ok(cond, msg) {
  n++;
  if (!cond) fails.push(msg);
}
function eq(actual, expected, msg) {
  ok(Object.is(actual, expected), `${msg} → 期望 ${expected}，实际 ${actual}`);
}

/** 北京时间 → epoch 毫秒（月份按 1 起，方便照日历念）。 */
function cst(y, mo, d, hh = 0, mm = 0) {
  return Date.UTC(y, mo - 1, d, hh, mm, 0) - TZ_OFFSET_MS;
}
/** 取样日自证：先确认这天真的是我以为的星期几，避免整组用例测错日子。 */
function dayOf(y, mo, d) {
  const p = beijingParts(cst(y, mo, d, 12));
  return ['日', '一', '二', '三', '四', '五', '六'][p.weekday];
}

// ── 取样日自证 ─────────────────────────────────────────────────
eq(dayOf(2026, 11, 18), '三', '2026-11-18 是周三');
eq(dayOf(2026, 11, 21), '六', '2026-11-21 是周六');
eq(dayOf(2026, 11, 22), '日', '2026-11-22 是周日');
eq(dayOf(2026, 11, 23), '一', '2026-11-23 是周一');
eq(dayOf(2026, 10, 10), '六', '2026-10-10 是周六（国庆调休补班日）');

// ── 时区与日历分量 ──────────────────────────────────────────────
eq(TZ_OFFSET_MS, 8 * 3600 * 1000, '固定按 UTC+8');
const p1 = beijingParts(cst(2026, 11, 18, 13, 23));
eq(p1.year, 2026, '年份');
eq(p1.month, 10, '月份是 0 基');
eq(p1.day, 18, '日');
eq(p1.hour, 13, '时');
eq(p1.minute, 23, '分');
eq(p1.weekday, 3, '周三 = 3');
eq(dateKey(cst(2026, 11, 18, 0, 0)), '2026-11-18', 'dateKey');
eq(dateKey(cst(2026, 12, 31, 23, 59)), '2026-12-31', 'dateKey 跨年前一刻');
eq(dateKey(cst(2026, 12, 31, 0, 0)), '2026-12-31', 'dateKey 当天零点');

// epochAt 精确到北京整点
eq(epochAt(2026, 10, 18, 9), Date.UTC(2026, 10, 18, 1), 'epochAt 9 点 = UTC 1 点');

// ── 周末判定 ───────────────────────────────────────────────────
ok(isWeekend(cst(2026, 11, 21, 10)), '周六算周末');
ok(isWeekend(cst(2026, 11, 22, 10)), '周日算周末');
ok(!isWeekend(cst(2026, 11, 18, 10)), '周三不算周末');

// ── 本地峰谷规则（工作日窗口）────────────────────────────────────
ok(isPeakLocal(cst(2026, 11, 18, 9, 0)), '周三 09:00 高峰');
ok(!isPeakLocal(cst(2026, 11, 18, 8, 59)), '周三 08:59 谷价');
ok(isPeakLocal(cst(2026, 11, 18, 11, 59)), '周三 11:59 高峰');
ok(!isPeakLocal(cst(2026, 11, 18, 12, 0)), '周三 12:00 谷价');
ok(!isPeakLocal(cst(2026, 11, 18, 13, 59)), '周三 13:59 谷价');
ok(isPeakLocal(cst(2026, 11, 18, 14, 0)), '周三 14:00 高峰');
ok(isPeakLocal(cst(2026, 11, 18, 17, 59)), '周三 17:59 高峰');
ok(!isPeakLocal(cst(2026, 11, 18, 18, 0)), '周三 18:00 谷价');
ok(!isPeakLocal(cst(2026, 11, 18, 0, 0)), '周三 00:00 谷价');

// 周末全天谷价 —— 含"调休补班的周六"：官方口径是"其余时段包括周末全天空闲"，
// 补班不改变周末身份，所以这里必须仍是谷价（v1.1.0 曾把它算成高峰，是错的）。
ok(!isPeakLocal(cst(2026, 11, 21, 10, 0)), '周六 10:00 谷价');
ok(!isPeakLocal(cst(2026, 10, 10, 10, 0)), '调休补班的周六 10:00 仍谷价');
ok(!isPeakLocal(cst(2026, 11, 22, 15, 0)), '周日 15:00 谷价');

// 本地规则不知道法定节假日：元旦当天若落在周三会被算成高峰（这是有意降级）
ok(isPeakLocal(cst(2027, 1, 1, 10, 0)), '2027-01-01 周五 10:00 本地算高峰（需宿主纠正）');

// ── 边界推算 ───────────────────────────────────────────────────
eq(nextBoundaryLocal(cst(2026, 11, 18, 8, 0)), cst(2026, 11, 18, 9, 0), '08:00 → 09:00');
eq(nextBoundaryLocal(cst(2026, 11, 18, 10, 0)), cst(2026, 11, 18, 12, 0), '10:00 → 12:00');
eq(nextBoundaryLocal(cst(2026, 11, 18, 12, 0)), cst(2026, 11, 18, 14, 0), '12:00 → 14:00');
eq(nextBoundaryLocal(cst(2026, 11, 18, 17, 0)), cst(2026, 11, 18, 18, 0), '17:00 → 当天 18:00');
eq(nextBoundaryLocal(cst(2026, 11, 18, 18, 0)), cst(2026, 11, 19, 9, 0), '18:00 → 次日 09:00');
eq(nextBoundaryLocal(cst(2026, 11, 20, 18, 0)), cst(2026, 11, 23, 9, 0), '周五 18:00 → 周一 09:00');
eq(nextBoundaryLocal(cst(2026, 11, 21, 10, 0)), cst(2026, 11, 23, 9, 0), '周六 10:00 → 周一 09:00');

eq(prevBoundaryLocal(cst(2026, 11, 18, 13, 0)), cst(2026, 11, 18, 12, 0), '13:00 ← 12:00');
eq(prevBoundaryLocal(cst(2026, 11, 18, 10, 0)), cst(2026, 11, 18, 9, 0), '10:00 ← 09:00');
eq(prevBoundaryLocal(cst(2026, 11, 18, 7, 0)), cst(2026, 11, 17, 18, 0), '周三 07:00 ← 周二 18:00');

// 边界自洽：每个边界点前后状态必须相反
for (const at of [cst(2026, 11, 18, 9), cst(2026, 11, 18, 12), cst(2026, 11, 18, 14), cst(2026, 11, 18, 18)]) {
  ok(isPeakLocal(at) !== isPeakLocal(at - 1000), `边界 ${new Date(at).toISOString()} 前后状态相反`);
}

// ── 宿主载荷校验 ───────────────────────────────────────────────
eq(usableHost(null, 1000), null, 'null 载荷不可用');
eq(usableHost({ isPeak: 'yes', nextChangeAt: 5000 }, 1000), null, 'isPeak 非布尔不可用');
eq(usableHost({ isPeak: true, nextChangeAt: 500 }, 1000), null, '切换点已过不可用');
eq(usableHost({ isPeak: true }, 1000), null, '缺切换点不可用');
const hostOk = usableHost({ isPeak: false, nextChangeAt: 5000, holidays: ['2027-01-01'] }, 1000);
ok(hostOk && hostOk.isPeak === false && hostOk.nextChangeAt === 5000, '合法载荷可用');
ok(hostOk && hostOk.holidays.length === 1, '节假日清单透传');

// ── describe：宿主优先 ─────────────────────────────────────────
const holiday = cst(2027, 1, 1, 10, 0); // 周五 10:00，元旦
const local = describe(holiday, null, null);
eq(local.source, 'local', '无宿主 → 本地');
eq(local.isPeak, true, '本地把元旦算成高峰');
eq(local.local, true, 'local 字段与 isPeak 一致');

const hostSays = describe(holiday, { isPeak: false, nextChangeAt: cst(2027, 1, 4, 9, 0) }, null);
eq(hostSays.source, 'host', '有宿主 → 宿主优先');
eq(hostSays.isPeak, false, '以宿主的谷价为准');
eq(hostSays.disagrees, true, '宿主与本地不一致要标出来');
eq(hostSays.hours, 71, '元旦 10:00 到周一 09:00 共 71 小时');

// 过期宿主退回本地
const stale = describe(cst(2026, 11, 18, 10, 0), { isPeak: false, nextChangeAt: cst(2026, 11, 18, 9, 0) }, null);
eq(stale.source, 'local', '宿主切换点已过 → 退回本地');
eq(stale.isPeak, true, '本地判定 10:00 是高峰');

// ── describe：倒计时与进度 ──────────────────────────────────────
const d = describe(cst(2026, 11, 18, 10, 0), null, null);
eq(d.remainMs, 2 * 3600 * 1000, '10:00 距 12:00 剩 2 小时');
eq(d.hours, 2, '小时位');
eq(d.minutes, 0, '分位');
eq(d.seconds, 0, '秒位');
eq(d.dateKey, '2026-11-18', '描述里的日期键');

const mid = describe(cst(2026, 11, 18, 11, 0), null, { start: cst(2026, 11, 18, 9, 0), end: cst(2026, 11, 18, 12, 0) });
eq(Math.round(mid.progress * 100), 67, '11:00 在 9–12 段走完 2/3');
eq(mid.frameIndex, Math.floor((2 / 3) * LEVELS), '峰段档位随进度正放');
ok(mid.frameIndex >= 0 && mid.frameIndex <= LEVELS, '档位在 0..30 内');

// 方向：峰段 0→30，谷段 30→0（原版口径，切换时头像两端跳）
eq(describe(cst(2026, 11, 18, 9, 0), null, null).frameIndex, 0, '峰段起点是梁文锋（档 0）');
eq(describe(cst(2026, 11, 18, 12, 0), null, null).frameIndex, LEVELS, '谷段起点是梁祖（档 30）');
const valleyHalf = describe(cst(2026, 11, 18, 13, 0), null, { start: cst(2026, 11, 18, 12, 0), end: cst(2026, 11, 18, 14, 0) });
eq(valleyHalf.frameIndex, LEVELS - Math.round(0.5 * LEVELS), '谷段档位倒放：半程 30→15');
// 踩在边界上时起点不再退回上一格
eq(prevBoundaryLocal(cst(2026, 11, 18, 18, 0)), cst(2026, 11, 18, 18, 0), '18:00 ← 18:00（含边界）');

const wrap = describe(cst(2026, 11, 18, 11, 0), null, { start: cst(2026, 11, 18, 9, 0), end: cst(2026, 11, 18, 9, 0) });
ok(wrap.progress >= 0 && wrap.progress <= 1, '非法段也要把进度钳在 0..1');

eq(clamp01(-1), 0, 'clamp01 下界');
eq(clamp01(2), 1, 'clamp01 上界');
eq(clamp01(NaN), 0, 'clamp01 非数');
eq(pad(5), '05', 'pad');
eq(pad(12), '12', 'pad 两位数');

// ── 版本 ───────────────────────────────────────────────────────
ok(/^\d+\.\d+\.\d+$/.test(VERSION), 'VERSION 形如 x.y.z');

if (fails.length > 0) {
  console.error(`${fails.length} / ${n} 项失败：`);
  for (const f of fails) console.error('  ✗', f);
  process.exit(1);
}
console.log(`${n} checks passed (v${VERSION})`);
