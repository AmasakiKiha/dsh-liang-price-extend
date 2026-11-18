// 峰谷判定 —— 数据源优先取宿主（dsh-whale-widget 的 /dsh-whale/balance.json），
// 取不到时退回"周末 + 时段"这一条永不过期的规则。
//
// 为什么不再自带节假日表：官方口径是「周一至周五（不含法定节假日）9–12、14–18 为高峰，
// 其余时段包括周末及法定节假日全天为空闲」。调休补班的周六/周日仍属"周末"，照样谷价，
// 所以补班日根本不需要数据；真正需要年份表的只有"法定放假日"，那份表由鲸鱼挂件统一维护。

export const VERSION = '1.3.0';
export const TZ_OFFSET_MS = 8 * 3600 * 1000;
export const PEAK_WINDOWS = [[9 * 60, 12 * 60], [14 * 60, 18 * 60]];
export const LEVELS = 30;

export function pad(n) {
  return String(n).padStart(2, '0');
}

/** 把 epoch 毫秒拆成北京时间日历分量（用 UTC 读数模拟 +8 平移，不依赖宿主时区）。 */
export function beijingParts(nowMs) {
  const d = new Date(Number(nowMs) + TZ_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

export function dateKey(nowMs) {
  const p = beijingParts(nowMs);
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
}

/** 北京时间某日的某个整点对应的 epoch 毫秒。 */
export function epochAt(year, month, day, hour) {
  return Date.UTC(year, month, day, hour, 0, 0) - TZ_OFFSET_MS;
}

export function isWeekend(nowMs) {
  const w = beijingParts(nowMs).weekday;
  return w === 0 || w === 6;
}

/**
 * 本地兜底规则：周末全天谷价；工作日只看 9–12、14–18。
 * 不含法定节假日（那需要年份表），所以遇到法定假日会误判成高峰 —— 这是有意的降级，
 * 由界面上的「未接入」标记明示，而不是假装知道。
 */
export function isPeakLocal(nowMs) {
  if (isWeekend(nowMs)) return false;
  const p = beijingParts(nowMs);
  const minutes = p.hour * 60 + p.minute;
  for (const [start, end] of PEAK_WINDOWS) {
    if (minutes >= start && minutes < end) return true;
  }
  return false;
}

const EDGE_HOURS = [0, 9, 12, 14, 18];

function dayBase(nowMs) {
  const p = beijingParts(nowMs);
  return Date.UTC(p.year, p.month, p.day);
}

/**
 * 边界 = 该时刻与前一秒状态相反。
 * 不能拿"与当前时刻状态不同"当判据：谷价段起点（如 12:00）本身已经是谷价，
 * 与 13:00 同态，用同态判据会一路退回 09:00，段起点就算错。
 */
export function isBoundary(at) {
  return isPeakLocal(at) !== isPeakLocal(at - 1000);
}

/** 下一次峰谷翻转的 epoch 毫秒（只扫北京时间整点边界 0/9/12/14/18）。 */
export function nextBoundaryLocal(nowMs) {
  const base = dayBase(nowMs);
  for (let d = 0; d <= 14; d++) {
    for (const hour of EDGE_HOURS) {
      const cand = base + d * 86400000 + hour * 3600000 - TZ_OFFSET_MS;
      if (cand <= nowMs) continue;
      if (isBoundary(cand)) return cand;
    }
  }
  return nowMs + 3600000;
}

/**
 * 上一次峰谷翻转的 epoch 毫秒（用于进度条的段起点）。
 * 边界本身算作"已到达"（原版即 `<= now`）：正踩在 18:00 上时起点就是 18:00，
 * 不能退回 14:00，否则整段被拉长近一倍、档位节奏跟着变慢。
 */
export function prevBoundaryLocal(nowMs) {
  const base = dayBase(nowMs);
  for (let d = 0; d <= 14; d++) {
    for (let i = EDGE_HOURS.length - 1; i >= 0; i--) {
      const cand = base - d * 86400000 + EDGE_HOURS[i] * 3600000 - TZ_OFFSET_MS;
      if (cand > nowMs) continue;
      if (isBoundary(cand)) return cand;
    }
  }
  return nowMs - 3600000;
}

export function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** 宿主载荷是否可用：isPeak 必须是布尔，切换点必须是未来的毫秒时间戳。 */
export function usableHost(host, nowMs) {
  if (!host) return null;
  if (typeof host.isPeak !== 'boolean') return null;
  const next = Number(host.nextChangeAt);
  if (!Number.isFinite(next) || next <= Number(nowMs)) return null;
  return { isPeak: host.isPeak, nextChangeAt: next, holidays: Array.isArray(host.holidays) ? host.holidays : null };
}

/**
 * 一次算清界面要用的全部数值。
 * host 可用时以宿主为准（覆盖法定节假日与跨年规则），否则退回本地规则。
 * seg 是组件维护的"当前时段起止"，用来画连进度条；缺省用本地边界推。
 */
export function describe(nowMs, host, seg) {
  const now = Number(nowMs);
  const local = isPeakLocal(now);
  const useHost = usableHost(host, now);
  const isPeak = useHost ? useHost.isPeak : local;
  const nextChangeAt = useHost ? useHost.nextChangeAt : nextBoundaryLocal(now);
  const remainMs = Math.max(0, nextChangeAt - now);

  let start = seg && Number.isFinite(seg.start) ? seg.start : prevBoundaryLocal(now);
  let end = seg && Number.isFinite(seg.end) && seg.end > now ? seg.end : nextChangeAt;
  if (!(end > start)) {
    start = now;
    end = nextChangeAt;
  }
  const progress = clamp01((now - start) / (end - start));
  // 档位口径照原版：Math.round 让两端真正落到 0 和 30（floor 永远够不到 30）。
  const level = Math.min(LEVELS, Math.max(0, Math.round(progress * LEVELS)));
  // 方向也必须照原版：峰段 0→30（梁文锋 → 梁祖），谷段倒放 30→0（梁祖 → 梁文锋）。
  // 有了方向，每次峰谷切换头像就从一端跳到另一端，肉眼一定看得到"在变"；
  // 丢掉这一项（v1.2 的 bug）会让谷段也从 0 起步，切换时两头都停在梁文锋附近，观感就是不动。
  const frameIndex = Math.min(LEVELS, Math.max(0, isPeak ? level : LEVELS - level));

  return {
    isPeak,
    local,
    source: useHost ? 'host' : 'local',
    disagrees: useHost ? useHost.isPeak !== local : false,
    nextChangeAt,
    remainMs,
    totalSeconds: Math.floor(remainMs / 1000),
    hours: Math.floor(remainMs / 3600000),
    minutes: Math.floor((remainMs % 3600000) / 60000),
    seconds: Math.floor((remainMs % 60000) / 1000),
    progress,
    level,
    frameIndex,
    dateKey: dateKey(now),
  };
}
