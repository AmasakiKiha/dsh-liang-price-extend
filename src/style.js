// 侧边栏底栏样式：使用 DSH 主题变量，深浅色自动跟随。
export const STYLE = [
      '.lw-row,.lw-mini{--lw-accent:var(--dsw-alias-state-success-primary)}',
      '.lw-row[data-peak="true"],.lw-mini[data-peak="true"]{--lw-accent:var(--dsw-alias-state-warn-primary)}',
      '.lw-row{display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0;box-sizing:border-box;margin:0 0 2px;padding:6px 0;border-radius:10px;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:18px}',
      '.lw-avatar{display:block;width:36px;height:36px;flex:none;border-radius:50%;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 2px rgba(0,0,0,.10)}',
      '.lw-frame{display:block;width:100%;height:100%;object-fit:cover}',
      '.lw-main{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}',
      '.lw-name{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;line-height:18px;white-space:nowrap;overflow:hidden}',
      '.lw-status{flex:none;padding:0 5px;border:1px dashed var(--lw-accent);border-radius:999px;color:var(--lw-accent);font-size:10px;font-weight:400;line-height:14px}',
      '.lw-count{font-size:10px;line-height:14px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}',
      '.lw-num{color:var(--dsw-alias-label-primary);font-weight:500}',
      '.lw-track{position:relative;height:3px;margin:5px 2px 1px 0;border-radius:999px;background:var(--dsw-alias-border-l1);overflow:hidden}',
      '.lw-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:var(--lw-accent);opacity:.78;transition:width 1s linear}',
      '.lw-mini{display:flex;align-items:center;justify-content:center;width:36px;height:36px;padding:3px}',
      '.lw-mini .lw-avatar{width:32px;height:32px}',
      '@media (prefers-reduced-motion:reduce){.lw-fill{transition:none}}',
    ].join('\n');
