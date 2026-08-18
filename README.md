# 海加尔 · ZOO 团本档案

国服海加尔公会 **ZOO** 的专属周档案，给 IC Raid Companion / IC Raid Lead 用。不指挥当场需求轮，只登记意向、存分配、看进度。

周起始与插件相同：**上海时间周四 5 点**，编号为那天的 `YYYY-MM-DD`。登录可只填角色名，默认补 `-海加尔`。分配按 `uid` 去重。

## 启动

```
node server.js
```

浏览器打开 http://127.0.0.1:8765

默认邀请码：团长 `ic-lead`，队员 `ic-raid`。改 `data/store.json` 里的 `config`。

局域网：`HOST=0.0.0.0 PORT=8765 node server.js`

云服务器 Docker 部署、反代、备份见 [docs/deploy.md](docs/deploy.md)。健康检查：`GET /api/health`。

## 游戏里

- 队员：`/icrc export` → 全选复制 → 网站「本周」导入意向
- 团长：`/icrl boss 名字` 记下 Boss，`/icrl export` → 网站导入分配
- 团长也可 `/icrl export all` 导出全部历史

## 分页

- **首页**：本周开团、进度、未登记、备忘摘要
- **本周**：导入/手填意向、Boss、名册、分配
- **周历**：团长按日期设开团时间；队员按那场报名；名单所有人可见
- **记录 / 公平 / 覆盖**：跨周汇总与名单对照
- **备忘**：本周指挥备忘、下次优先、银行/分解
- **团规 / 战术**：团规共用；战术页带 12.1《剧毒深渊》手册，团长备注另存

名册写在 `guild.roster`，新周会拷过去。赛季起始默认 `2026-08-13`。不接 Discord / WCL，不改插件导出格式。

掉落只覆盖当前团本（剧毒深渊），表在 `data/raid-loot.json`。导入分配时按物品 ID / itemLink 回填名字，不是全服装备库。外链走中文 Wowhead。

12.1 手册在 `data/raid-journal.json`，战术页只读展示。团长备注仍写在 `guild.tactics`。
