window.__ModuleLoader__.load({
  id: 'dsh-liang-price-extend',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** locale 命名空间（apply 里 ctx.locale.register/bind 都靠它，必须在本文件定义）。 */
    const NS = 'liang-price-extend';

    // ── 纯逻辑（构建时由 src/logic.mjs 内联，勿在此处手改）──────────────────
__LOGIC__
    // ── 头像与样式（构建时由 src/frames.js / src/style.js 内联）──────────────
__FRAMES__
__STYLE__
    // 数据源标记：宿主驱动时正常，本地兜底时虚线灰，两者打架时点状提示。
    const STYLE_EXTRA = [
      '.lw-row[data-src="local"] .lw-status,.lw-mini[data-src="local"]{border-style:dashed;opacity:.85}',
      '.lw-row[data-disagree="true"] .lw-status{border-style:dotted}',
    ].join('\\n');

    const WHALE_ENDPOINT = '/dsh-whale/balance.json';
    const REPOLL_MS = 60000;

    const EN = {
      namePeak: 'Liang Wenfeng',
      nameValley: 'Liang Wengu',
      statusPeak: 'fleecing',
      statusValley: 'saving',
      statusLocal: 'local rule',
      hours: 'h ',
      minutes: 'm ',
      seconds: 's ',
      thenEnter: ' until ',
      toPeak: 'Liang Wenfeng',
      toValley: 'Liang Wengu',
      titlePeak: 'Peak hours: full price until the window closes.',
      titleValley: 'Valley hours: half price until the next peak window opens.',
      titleHost: 'Peak/valley state comes from the whale widget, which owns the statutory holiday table.',
      titleLocal: 'Whale widget not reachable, so only weekends and weekday windows are used. Statutory holidays will be counted as peak here.',
      titleDisagree: 'Whale widget and the local rule disagree — usually a statutory holiday.',
    };

    const ZH = {
      namePeak: '梁文峰',
      nameValley: '梁文谷',
      statusPeak: '挨宰中',
      statusValley: '省钱中',
      statusLocal: '本地推算',
      hours: '小时',
      minutes: '分',
      seconds: '秒',
      thenEnter: '后进入',
      toPeak: '梁文峰',
      toValley: '梁文谷',
      titlePeak: '峰价时段：全价到底。',
      titleValley: '谷价时段：五折到底。',
      titleHost: '峰谷状态取自鲸鱼挂件（法定节假日表由它统一维护）。',
      titleLocal: '没接到鲸鱼挂件，只按周末与工作时段推算，法定节假日会被算成高峰。',
      titleDisagree: '鲸鱼挂件与本地推算不一致，通常是法定节假日。',
    };

    /** 从鲸鱼挂件取峰谷状态；拿不到就返回 null（由本地规则兜底）。 */
    function useWhale() {
      const [host, setHost] = React.useState(undefined);
      const lastAt = React.useRef(0);

      const reload = React.useCallback((force) => {
        const now = Date.now();
        if (!force && now - lastAt.current < 5000) return;
        lastAt.current = now;
        let alive = true;
        (async () => {
          try {
            const res = await fetch(WHALE_ENDPOINT, {
              cache: 'no-store',
              credentials: 'same-origin',
              headers: { accept: 'application/json' },
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (!alive) return;
            const next = Number(data.peakNextChangeAt) * 1000;
            if (typeof data.isPeak === 'boolean' && Number.isFinite(next) && next > Date.now()) {
              setHost({
                isPeak: data.isPeak,
                nextChangeAt: next,
                holidays: Array.isArray(data.peakHolidays) ? data.peakHolidays : null,
                version: typeof data.version === 'string' ? data.version : null,
              });
            } else {
              setHost(null);
            }
          } catch (err) {
            if (alive) setHost(null);
          }
        })();
        return () => {
          alive = false;
        };
      }, []);

      React.useEffect(() => {
        const cancel = reload(true);
        const id = window.setInterval(() => reload(false), REPOLL_MS);
        return () => {
          if (typeof cancel === 'function') cancel();
          window.clearInterval(id);
        };
      }, [reload]);

      return [host, reload];
    }

    function Status(props) {
      const t = props.t || ((key) => key);
      const wide = props.wide !== false;
      const [now, setNow] = React.useState(() => Date.now());
      const [host, reload] = useWhale();

      React.useEffect(() => {
        // 后台标签页不空转：隐藏时跳过 tick，重新可见时立刻对齐一次。
        const tick = () => {
          if (typeof document !== 'undefined' && document.hidden) return;
          setNow(Date.now());
        };
        const id = window.setInterval(tick, 1000);
        const onVisible = () => {
          if (typeof document === 'undefined' || !document.hidden) setNow(Date.now());
        };
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', onVisible);
        }
        return () => {
          window.clearInterval(id);
          if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', onVisible);
          }
        };
      }, []);

      // 段起止：状态翻转时把起点钉在上一段的终点，这样进度条不受"节假日表缺年份"影响。
      const segRef = React.useRef(null);
      const probe = describe(now, host, null);
      let seg = segRef.current;
      if (!seg || seg.isPeak !== probe.isPeak || seg.end !== probe.nextChangeAt) {
        const start = seg && seg.isPeak === probe.isPeak
          ? seg.start
          : (seg ? Math.min(seg.end, now) : prevBoundaryLocal(now));
        seg = { isPeak: probe.isPeak, start, end: probe.nextChangeAt };
        segRef.current = seg;
      }
      const s = describe(now, host, seg);

      // 切换点已过但宿主还没回新值 → 立刻重取一次，别停在过期状态上。
      React.useEffect(() => {
        if (s.source === 'host' && now >= s.nextChangeAt + 1500) reload(true);
      }, [now, s.source, s.nextChangeAt, reload]);

      let title = s.isPeak ? t('titlePeak') : t('titleValley');
      if (s.source === 'host') {
        title += ' ' + t('titleHost');
        if (s.disagrees) title += ' ' + t('titleDisagree');
      } else {
        title += ' ' + t('titleLocal');
      }

      const avatar = h('span', {
        className: 'lw-avatar',
        'data-peak': s.isPeak ? 'true' : 'false',
      }, h('img', {
        key: s.frameIndex,
        className: 'lw-frame',
        src: FRAMES[s.frameIndex],
        alt: '',
        draggable: false,
      }));

      const countdown = [
        h('span', { key: 'h', className: 'lw-num' }, String(s.hours)), t('hours'),
        h('span', { key: 'm', className: 'lw-num' }, pad(s.minutes)), t('minutes'),
        h('span', { key: 's', className: 'lw-num' }, pad(s.seconds)), t('seconds'),
        t('thenEnter'),
        h('span', { key: 'to', className: 'lw-num' }, s.isPeak ? t('toValley') : t('toPeak')),
      ];

      const track = h('span', { className: 'lw-track', 'aria-hidden': true },
        h('span', { className: 'lw-fill', style: { width: (s.progress * 100).toFixed(3) + '%' } }),
      );

      const statusText = s.isPeak ? t('statusPeak') : t('statusValley');
      const attrs = {
        'data-peak': s.isPeak ? 'true' : 'false',
        'data-src': s.source,
        'data-disagree': s.disagrees ? 'true' : 'false',
        title,
      };

      return h(React.Fragment, null,
        h('style', null, STYLE),
        h('style', null, STYLE_EXTRA),
        wide
          ? h('div', Object.assign({ className: 'lw-row' }, attrs),
              avatar,
              h('span', { className: 'lw-main' },
                h('span', { className: 'lw-name' },
                  s.isPeak ? t('namePeak') : t('nameValley'),
                  h('span', { className: 'lw-status' }, statusText),
                ),
                h('span', { className: 'lw-count' }, countdown),
                track,
              ),
            )
          : h('div', Object.assign({ className: 'lw-mini' }, attrs), avatar),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // 一次对象式注册（官方形状：register(namespace, { lang: dict })），失败只降级不炸入口。
        ctx.effect(() => {
          try {
            return ctx.locale.register(NS, { en: EN, zh: ZH, 'zh-Hans': ZH });
          } catch (err) {
            console.warn('[liang-price-extend] locale register failed', err);
            return () => {};
          }
        }, 'liang-price-extend: dictionaries');
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'liang-price-extend',
          order: 0,
          inject: () => ({ t: ctx.locale.bind(NS) }),
        }, Status));
      },
    };
  },
});
