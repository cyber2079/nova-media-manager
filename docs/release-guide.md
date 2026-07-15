# Nova Media Manager — 发布行动指南

> 2026-07-15 · 代替 commercial-evaluation / marketing-plan / operations-strategy / product-design-assessment / test-cases / test-report

---

## 定价 & 产品

**唯一定价**：Free（全功能免费 + default 主题）+ ¥199 永久 Member（全部 premium 主题 + 自动更新）。一机一码。

## P0 阻塞缺陷（发布前必须修）

| BUG | 模块 | 修法 |
|---|---|---|
| 无音频设备播放崩溃 | 音乐 | ✅ timeupdate NaN guard + error listener |
| 电影导入 status 卡死 | 电影 | ✅ catch_unwind → status=error 兜底 |

## 发布 checklist（T-7 天）

- [ ] scm-think.cn 定价页更新为 Free + ¥199
- [ ] 爱发电通过认证 → 管理后台生成激活码 → 上传卡密库
- [ ] 宣传视频 (3 分钟 B站 + 30s 抖音版)
- [ ] GitHub README 中文置顶 + GIF demo
- [ ] 测试两台 Windows 机器 (Win10 22H2 + Win11 24H2)
- [ ] 宣传渠道: B站发布 + V2EX 发布帖 + 少数派投稿

## B站视频模板

```
0-5s   角色特写 + 打字机一句话
5-15s  主题切换展示 (3个各3s)
15-25s 功能切换 (播放器/可视化/组件)
25-30s Logo + scm-think.cn
```

## 前 3 个月目标

| 月份 | 安装量 | 付费数 | 收入 |
|---|---|---|---|
| M1 | 500 | 25 | ¥4,975 |
| M2 | 2,000 | 100 | ¥19,900 |
| M3 | 5,000 | 250 | ¥49,750 |

## 定价心理学

- 锚定效应：免费全功能 → ¥199 只是解锁主题
- 一机一码：杜绝共享
- 无试用：买了就是永久

---

> 其余 docs/ 文件均为历史草稿，以此文件为准。
