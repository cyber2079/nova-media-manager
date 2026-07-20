import fs from "node:fs";

const BAK = "server/static/index.html.bak";
const OUT = "server/static/index.html";
let c = fs.readFileSync(BAK, "utf8");

// ═══════════════ CSS ═══════════════
c = c.replace(/\.pricing-tabs\{[^}]+\}\n/g, "");
c = c.replace(/\.pricing-tab\{[^}]+\}\n/g, "");
c = c.replace(/\.pricing-tab\.active\{[^}]+\}\n/g, "");
c = c.replace(/\.light-mode \.pricing-tab\{[^}]+\}\n/g, "");
c = c.replace(/\.light-mode \.pricing-tab\.active\{[^}]+\}\n/g, "");
c = c.replace("max-width:1100px", "max-width:1200px");
c = c.replace(".pricing-cards{display:none;grid-template-columns:repeat(3,1fr);gap:1.5rem;align-items:stretch}", ".pricing-cards{display:grid;grid-template-columns:repeat(5,1fr);gap:.75rem;align-items:stretch}");
c = c.replace(".pricing-cards.active{display:grid}", "");
c = c.replace("font-size:3.25rem", "font-size:2.2rem");
c = c.replace(".plan-main-price sub{font-size:.85rem", ".plan-main-price sub{font-size:.7rem");
c = c.replace("padding:2.5rem 2rem;border-radius:1.25rem", "padding:1.5rem 1rem;border-radius:1rem");
c = c.replace(".plan-card-header{text-align:center;margin-bottom:2rem", ".plan-card-header{text-align:center;margin-bottom:1rem");
c = c.replace(".plan-divider{height:1px;background:var(--border);margin:0 0 1.5rem", ".plan-divider{height:1px;background:var(--border);margin:0 0 .75rem");
c = c.replace(".plan-card ul{list-style:none;font-size:.8rem;color:var(--text);flex:1;margin-bottom:2rem", ".plan-card ul{list-style:none;font-size:.72rem;color:var(--text);flex:1;margin-bottom:1rem");
c = c.replace(".features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem}", ".features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem}");
c = c.replace(".feat-card{padding:2rem;", ".feat-card{padding:1.5rem;");
c = c.replace('.theme-opt{display:flex;align-items:center;gap:.4rem;padding:.3rem .6rem;border-radius:999px;border:none;background:transparent;color:var(--muted);font-size:.68rem;font-weight:600;cursor:pointer;transition:all .25s;font-family:inherit}', '.theme-opt{display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border-radius:50%;border:none;background:transparent;cursor:pointer;transition:all .25s}');
c = c.replace('.theme-opt:hover{color:var(--heading)}.theme-opt.active{background:rgba(127,127,127,.15);color:var(--heading)}', '.theme-opt:hover{background:rgba(255,255,255,.08)}.theme-opt.active{background:rgba(255,255,255,.15)}');
c = c.replace('.theme-opt .t-dot{width:12px;height:12px;border-radius:50%}', '.theme-opt .t-dot{width:11px;height:11px;border-radius:50%}');
c = c.replace('.light-mode .theme-opt{color:#555}.light-mode .theme-opt.active{background:rgba(0,0,0,.06);color:#000}', '.light-mode .theme-opt:hover{background:rgba(0,0,0,.06)}.light-mode .theme-opt.active{background:rgba(0,0,0,.08)}');
c = c.replace("</style>", `.cmp-table{width:100%;border-collapse:collapse;font-size:.85rem}\n.cmp-table th{padding:.75rem 1rem;color:var(--heading);font-weight:700}\n.cmp-table td{border-bottom:1px solid var(--border);padding:.5rem 1rem}\n.cmp-sect td{padding:.7rem 1rem .3rem;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--accent2);border-bottom:1px solid var(--accent-glow)}\n.cmp-sub td:first-child{padding-left:2rem;font-size:.82rem}\n</style>`);
c = c.replace("@media(max-width:900px){.pricing-cards.active{grid-template-columns:1fr;max-width:400px;margin-left:auto;margin-right:auto}}", "@media(max-width:1100px){.pricing-cards{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}}");
c = c.replace("@media(max-width:768px){.nav-links .hide-mobile{display:none}.hero h1{font-size:2rem}}", "@media(max-width:768px){.nav-links .hide-mobile{display:none}.hero h1{font-size:2rem}.features-grid{grid-template-columns:1fr}}");

// ═══════════════ NAV ═══════════════
const themeNames = { navy: "Navy", wine: "Wine", brown: "Brown", purple: "Purple" };
for (const [clr, title] of Object.entries(themeNames)) {
  c = c.replace(new RegExp(`(<span class="t-dot ${clr}"></span>)[^<]+(</button>)`, 'g'), `$1</button>`);
  c = c.replace(new RegExp(`setTheme\\('${clr}'\\)">`, 'g'), `setTheme('${clr}')" title="${title}">`);
}
c = c.replace('<a href="#faq" data-zh="常见问题" data-en="FAQ">常见问题</a>', '');

// ═══════════════ HERO ═══════════════
c = c.replace(/<h1>[\s\S]*?<\/h1>/, '<h1><span data-zh="让桌面" data-en="Your Desktop,">让桌面</span><span class="grad" data-zh=" 配得上你的热爱" data-en=" Your World"> 配得上你的热爱</span></h1>');
c = c.replace(/<p data-zh="[^"]*" data-en="[^"]*">[^<]*<\/p>/, '<p data-zh="电影 · 音乐 · 图片 · 游戏 — 四合一，基础全功能免费。" data-en="Movies · Music · Images · Games — all in one, all core features free.">电影 · 音乐 · 图片 · 游戏 — 四合一，基础全功能免费。</p>');

// ═══════════════ FEATURES ═══════════════
let fStart = c.indexOf('<section id="features">');
let fEnd = c.indexOf('<section id="pricing">');
let features = `<section id="features"><div class="container">\n<h2 class="section-title" data-zh="影音游戏，一站搞定" data-en="Movies · Music · Images · Games">影音游戏，一站搞定</h2>\n<p class="section-sub" data-zh="海报墙、LRC歌词、频谱、图片浏览、Steam同步 — 基础全功能免费。" data-en="Poster wall, LRC lyrics, visualizer, image browser, Steam sync — all core features free.">海报墙、LRC歌词、频谱、图片浏览、Steam同步 — 基础全功能免费。</p>\n<div class="features-grid">\n<div class="feat-card"><div class="feat-icon">🎬</div><h3 data-zh="电影" data-en="Movies">电影</h3><p data-zh="海报墙自动刮削、豆瓣/TMDB 匹配、外接播放器、壁纸设置。" data-en="Auto-scraping poster wall, Douban/TMDB matching, external player, wallpaper mode.">海报墙自动刮削、豆瓣/TMDB 匹配、外接播放器、壁纸设置。</p></div>\n<div class="feat-card"><div class="feat-icon">🎵</div><h3 data-zh="音乐" data-en="Music">音乐</h3><p data-zh="LRC 歌词逐字同步、可视化频谱、网易云热歌推荐、自定义播放器背景。" data-en="LRC lyric sync, visual spectrum, trending music, custom player background.">LRC 歌词逐字同步、可视化频谱、网易云热歌推荐、自定义播放器背景。</p></div>\n<div class="feat-card"><div class="feat-icon">🖼️</div><h3 data-zh="图片" data-en="Images">图片</h3><p data-zh="本地图片浏览、设为壁纸、幻灯片轮播、懒加载高性能预览。" data-en="Local image browser, set as wallpaper, slideshow, lazy-loaded high-perf preview.">本地图片浏览、设为壁纸、幻灯片轮播、懒加载高性能预览。</p></div>\n<div class="feat-card"><div class="feat-icon">🎮</div><h3 data-zh="游戏" data-en="Games">游戏</h3><p data-zh="Steam 热销榜、游戏库管理、一键启动、时段热力图统计。" data-en="Steam trending, game library management, one-click launch, hourly heatmap.">Steam 热销榜、游戏库管理、一键启动、时段热力图统计。</p></div>\n<div class="feat-card"><div class="feat-icon">📊</div><h3 data-zh="数据仪表盘" data-en="Dashboard">数据仪表盘</h3><p data-zh="活跃热力图、时段统计、签到记录 — 你的使用习惯一目了然。" data-en="Activity heatmap, hourly stats, check-in streaks — your habits at a glance.">活跃热力图、时段统计、签到记录 — 你的使用习惯一目了然。</p></div>\n<div class="feat-card"><div class="feat-icon">🧩</div><h3 data-zh="桌面小部件" data-en="Desktop Widgets">桌面小部件</h3><p data-zh="系统监控、时钟、日历、倒计时 — 自由开关，任意摆放。" data-en="System monitor, clock, calendar, countdown — toggle on/off, drag anywhere.">系统监控、时钟、日历、倒计时 — 自由开关，任意摆放。</p></div>\n</div>\n<p style="text-align:center;margin-top:2rem;font-size:0.95rem;color:var(--muted)" data-zh="想要更多？解锁 Premium 主题 ↓" data-en="Want more? Unlock premium themes ↓">想要更多？解锁 Premium 主题 ↓</p>\n</div></section>`;
c = c.slice(0, fStart) + features + "\n\n" + c.slice(fEnd);

// ═══════════════ PRICING ═══════════════
c = c.replace('data-zh="简单透明的定价" data-en="Simple &amp; Transparent Pricing">简单透明的定价', 'data-zh="定价" data-en="Pricing">定价');
c = c.replace(/<p class="section-sub" data-zh="[^"]*" data-en="[^"]*">[^<]*<\/p>/, '<p class="section-sub" data-zh="基础全功能免费。付费解锁全套 Premium 主题。" data-en="All core features free. Pay for full premium themes.">基础全功能免费。付费解锁全套 Premium 主题。</p>');

// Find pricing-wrapper ... the bak file has: <section id="pricing"> ... <div class="pricing-wrapper"> ... OLD CARDS ... </div></div></div></section>
// Then: <section id="faq"> ... </section> or <footer>
// Strategy: find '<div class="pricing-wrapper">', find the FIRST '</section>' after it that closes pricing section
// Then replace everything in between.
let pwIdx = c.indexOf('<div class="pricing-wrapper">');
// The pricing section closes with </section> right before FAQ or footer
// Find the first </section> after pwIdx
let secEnd = c.indexOf('</section>', pwIdx);
if (secEnd === -1) { console.error("Pricing section close not found"); process.exit(1); }
// pwReplaceEnd = position after the > of this </section>
let pwReplaceEnd = c.indexOf('>', secEnd) + 1;

let pricing = `<div class="pricing-wrapper">\n\t<div class="pricing-cards">\n\n\t\t<div class="plan-card free">\n\t\t<div class="plan-card-header"><div class="plan-tier-name" data-zh="社区版" data-en="Community">社区版</div><div class="plan-main-price" data-zh="免费" data-en="Free">免费</div><div class="plan-price-detail" data-zh="永久使用" data-en="Forever">永久使用</div></div>\n\t\t<div class="plan-divider"></div>\n\t\t<ul>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="全类型影音管理" data-en="All media types">全类型影音管理</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="全功能桌面小部件" data-en="All desktop widgets">全功能桌面小部件</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="default 主题" data-en="Default theme">default 主题</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="完全离线可用" data-en="Fully offline">完全离线可用</span></li>\n\t\t</ul>\n\t\t<a href="#" class="btn btn-ghost" data-zh="免费下载" data-en="Free Download">免费下载</a>\n\t\t</div>\n\n\t\t<div class="plan-card popular">\n\t\t<div class="plan-badge" data-zh="最受欢迎" data-en="Popular">最受欢迎</div>\n\t\t<div class="plan-card-header"><div class="plan-tier-name" data-zh="会员版 月付" data-en="Member Monthly">会员版 月付</div><div class="plan-main-price">¥19.9<sub>/月</sub></div><div class="plan-price-detail" data-zh="30天有效期 · 可续费" data-en="30 days · renewable">30天有效期 · 可续费</div></div>\n\t\t<div class="plan-divider"></div>\n\t\t<ul>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="社区版全部功能" data-en="All Community features">社区版全部功能</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="全部 Premium 主题" data-en="All premium themes">全部 Premium 主题</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="全套主题皮肤" data-en="Full theme skins">全套主题皮肤</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="主题自动更新" data-en="Auto-update">主题自动更新</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="一码一机" data-en="1 code = 1 device">一码一机</span></li>\n\t\t</ul>\n\t\t<a href="https://ifdian.net/a/cyber2079" class="btn btn-primary" data-zh="立即订阅" data-en="Subscribe">立即订阅</a>\n\t\t</div>\n\n\t\t<div class="plan-card">\n\t\t<div class="plan-card-header"><div class="plan-tier-name" data-zh="会员版 年付" data-en="Member Yearly">会员版 年付</div><div class="plan-main-price">¥199<sub>/年</sub></div><div class="plan-price-detail" data-zh="365天 · 月均 ¥16.6 · <strong style='color:var(--accent2)'>省 ¥39</strong>" data-en="365 days · ¥2.4/mo · <strong style='color:var(--accent2)'>save ¥7</strong>">365天 · 月均 ¥16.6 · <strong style='color:var(--accent2)'>省 ¥39</strong></div></div>\n\t\t<div class="plan-divider"></div>\n\t\t<ul>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="月付全部功能" data-en="All monthly features">月付全部功能</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="比月付省 ¥39" data-en="Save ¥7 vs monthly">比月付省 ¥39</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="一次付费，全年无忧" data-en="Pay once, worry-free">一次付费，全年无忧</span></li>\n\t\t</ul>\n\t\t<a href="https://ifdian.net/a/cyber2079" class="btn btn-primary" data-zh="立即订阅" data-en="Subscribe">立即订阅</a>\n\t\t</div>\n\n\t\t<div class="plan-card">\n\t\t<div class="plan-card-header"><div class="plan-tier-name" data-zh="会员版 永久" data-en="Member Lifetime">会员版 永久</div><div class="plan-main-price">¥899</div><div class="plan-price-detail" data-zh="一次买断 · 终身使用" data-en="One-time · Lifetime">一次买断 · 终身使用</div></div>\n\t\t<div class="plan-divider"></div>\n\t\t<ul>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="会员版全部功能" data-en="All Member features">会员版全部功能</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="终身更新，无需续费" data-en="Lifetime updates">终身更新，无需续费</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="微信/支付宝直接购买" data-en="WeChat/Alipay">微信/支付宝直接购买</span></li>\n\t\t</ul>\n\t\t<a href="mailto:contact@scm-think.cn" class="btn btn-ghost" data-zh="联系购买" data-en="Contact">联系购买</a>\n\t\t</div>\n\n\t\t<div class="plan-card" style="border-color:var(--accent2);box-shadow:0 0 24px rgba(255,255,255,.04)">\n\t\t<div class="plan-card-header"><div class="plan-tier-name" style='color:var(--accent2)' data-zh="定制服务" data-en="Custom">定制服务</div><div class="plan-main-price" style="font-size:1.6rem;color:var(--accent2)" data-zh="咨询报价" data-en="Contact">咨询报价</div><div class="plan-price-detail" data-zh="专属开发 · 按需定价" data-en="Custom dev · per project">专属开发 · 按需定价</div></div>\n\t\t<div class="plan-divider"></div>\n\t\t<ul>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="专属主题包定制" data-en="Custom theme packs">专属主题包定制</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="品牌 Logo/色系替换" data-en="Brand rebranding">品牌 Logo/色系替换</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="专属角色与剧情" data-en="Custom characters">专属角色与剧情</span></li>\n\t\t<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-8"/></svg><span data-zh="源码授权（闭源二开）" data-en="Source license">源码授权（闭源二开）</span></li>\n\t\t</ul>\n\t\t<a href="mailto:contact@scm-think.cn" class="btn btn-outline" data-zh="联系我们" data-en="Contact Us">联系我们</a>\n\t\t</div>\n\n\t</div>\n</div>`;

c = c.slice(0, pwIdx) + pricing + "\n" + c.slice(pwReplaceEnd);

// ═══════════════ KILL FAQ + BUILD FOOTER ═══════════════
let ftIdx = c.indexOf('<footer>');
let bodyEnd = c.indexOf('</body>', ftIdx);

let foot = `<footer><div class="container">
<h2 class="section-title" data-zh="功能对比" data-en="Feature Comparison" style="margin-bottom:2rem">功能对比</h2>
<div style="overflow-x:auto;max-width:900px;margin:0 auto 2.5rem">
<table class="cmp-table">
<thead>
<tr style="border-bottom:2px solid var(--border)">
<th></th>
<th style="text-align:center;width:140px" data-zh="社区版" data-en="Community">社区版</th>
<th style="text-align:center;width:140px;color:var(--accent2)" data-zh="会员版" data-en="Member">会员版</th>
</tr>
</thead>
<tbody>
<tr><td data-zh="电影海报墙 + 外接播放器" data-en="Movie poster wall + external player">电影海报墙 + 外接播放器</td><td style="text-align:center;color:var(--accent2)">✓</td><td style="text-align:center;color:var(--accent2)">✓</td></tr>
<tr><td data-zh="音乐播放 + LRC 歌词 + 频谱" data-en="Music player + LRC lyrics + spectrum">音乐播放 + LRC 歌词 + 频谱</td><td style="text-align:center;color:var(--accent2)">✓</td><td style="text-align:center;color:var(--accent2)">✓</td></tr>
<tr><td data-zh="图片浏览 + 壁纸" data-en="Image browser + wallpaper">图片浏览 + 壁纸</td><td style="text-align:center;color:var(--accent2)">✓</td><td style="text-align:center;color:var(--accent2)">✓</td></tr>
<tr><td data-zh="游戏库 + Steam 热销" data-en="Game library + Steam trending">游戏库 + Steam 热销</td><td style="text-align:center;color:var(--accent2)">✓</td><td style="text-align:center;color:var(--accent2)">✓</td></tr>
<tr><td data-zh="桌面小部件" data-en="Desktop widgets">桌面小部件</td><td style="text-align:center;color:var(--accent2)">✓</td><td style="text-align:center;color:var(--accent2)">✓</td></tr>
<tr><td data-zh="数据仪表盘 + 签到" data-en="Dashboard + check-in">数据仪表盘 + 签到</td><td style="text-align:center;color:var(--accent2)">✓</td><td style="text-align:center;color:var(--accent2)">✓</td></tr>
<tr><td data-zh="自定义调色板" data-en="Custom palette">自定义调色板</td><td style="text-align:center;color:var(--accent2)">✓</td><td style="text-align:center;color:var(--accent2)">✓</td></tr>
<tr class="cmp-sect"><td colspan="3" data-zh="Premium 主题" data-en="Premium Themes">Premium 主题</td></tr>
<tr class="cmp-sub"><td data-zh="全套图标" data-en="Full icon set">全套图标</td><td style="text-align:center;color:var(--muted)">—</td><td style="text-align:center;color:var(--accent2);font-weight:700">✓</td></tr>
<tr class="cmp-sub"><td data-zh="皮肤" data-en="Skins">皮肤</td><td style="text-align:center;color:var(--muted)">—</td><td style="text-align:center;color:var(--accent2);font-weight:700">✓</td></tr>
<tr class="cmp-sub"><td data-zh="小组件皮肤" data-en="Widget skins">小组件皮肤</td><td style="text-align:center;color:var(--muted)">—</td><td style="text-align:center;color:var(--accent2);font-weight:700">✓</td></tr>
<tr class="cmp-sub"><td data-zh="背景视频" data-en="BG video">背景视频</td><td style="text-align:center;color:var(--muted)">—</td><td style="text-align:center;color:var(--accent2);font-weight:700">✓</td></tr>
<tr class="cmp-sub"><td data-zh="自动更新" data-en="Auto-update">自动更新</td><td style="text-align:center;color:var(--muted)">—</td><td style="text-align:center;color:var(--accent2);font-weight:700">✓</td></tr>
</tbody>
</table>
</div>
<p>© 2026 Nova Media Manager · Powered by Tauri · <a href="https://github.com/cyber2079/nova-media-manager">GitHub</a> · <a href="/privacy.html">隐私政策</a> · <a href="/terms.html">使用条款</a></p>
</div></footer>`;

c = c.slice(0, ftIdx) + foot + c.slice(bodyEnd);

// Clean JS
c = c.replace(/function switchPricing\(mode\)\{[\s\S]*?\}\s*/g, '');

// Verify
const issues = [];
if (!c.includes("配得上你的热爱")) issues.push("Hero h1");
if (c.includes("藏蓝")) issues.push("Theme text: 藏蓝");
if ((c.match(/<div class="feat-card">/g) || []).length !== 6) issues.push("Feat cards: " + (c.match(/feat-card"/g) || []).length);
if (!c.includes('data-zh="定价"')) issues.push("Pricing title");
const pc = c.match(/<div class="plan-card /g);
if (!pc || pc.length !== 5) issues.push("Plan cards: " + (pc || []).length);
if (!c.includes("功能对比")) issues.push("Cmp missing");
const ft = c.indexOf("<footer>");
const cmp = c.indexOf("功能对比");
if (cmp < ft) issues.push("Cmp before footer tag");
if (c.includes('id="faq"')) issues.push("FAQ exists");
if (c.includes("Ultra") || c.includes("旗舰版")) issues.push("Old branding");

if (issues.length > 0) {
  console.log("FAILED:", issues.join("; "));
  process.exit(1);
}
fs.writeFileSync(OUT, c, "utf8");
console.log("OK:", c.length, "bytes");
