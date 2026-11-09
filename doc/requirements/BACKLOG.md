# 待办台账（非阻断项）

按合并提交正文回填审查首轮非阻断项与交付遗留项。

| 来源 | 模块 | 事项 | 位置 |
|---|---|---|---|
| PR #10 / FEAT-20261109-01 | 内容 / 隐私政策 | 隐私政策写 Floe 收到「first name」，代码为 firstName 回退 fullName，措辞宜改为「your name」 | migrations/0027_publish_storefront_pages_and_blog.sql:133；components/agent/AgentDrawer.tsx:160 |
| PR #10 / FEAT-20261109-01 | 内容 / Cookie 表 | 「automated bot protection」与 `__cf_bm`/`cf_clearance` 来自领域常识，代码无 Turnstile；需线上实测 Cookie 后定稿 | migrations/0027_publish_storefront_pages_and_blog.sql:150,187 |
| PR #10 / FEAT-20261109-01 | 页脚 | 每次布局渲染新增一次 D1 查询（contact 页），可并入导航页查询 | components/Footer.tsx:28 |
| PR #10 / FEAT-20261109-01 | 订阅 | 部署后未刷新的商品页以旧条款版本 2026-09-07 请求 setup-intent 会得 409，需刷新；历史同意记录不追溯 | app/api/setup-intent/route.ts:133 |
| FEAT-20261109-01 | Floe 知识库 | 知识库仍有 `support@example.com`、虚构电话、不存在的退货门户，与新条款不一致；修改需写生产 R2/Vectorize，待用户确认 | Floe 知识库（R2/Vectorize） |
| FEAT-20261109-01 | 运行时配置 | `STORE_POSTAL_ADDRESS` 未配置，邮件页脚显示占位句；`STORE_SUPPORT_HOURS` 建议与 Contact 页一致 | lib/store-config.ts:93；lib/email/footer.ts:15,25 |
| FEAT-20261109-01 | 法务 | 隐私政策与服务条款按通行电商做法起草，未经律师审阅 | about / privacy-policy / terms-of-service 页面 |
| PR #14 / FEAT-20261109-06 | 迁移 / 页面 | 0029 第四条 REPLACE（Mailing address: 前缀）不在 WHERE 内，后台已手改为新地址但无前缀的页面不补前缀 | migrations/0029_update_company_mailing_address.sql:24 |
| PR #14 / FEAT-20261109-06 | SEO / 部署 | 未设 workers_dev:false，workers.dev 域同样可索引；首页等无 canonical，存在重复收录风险 | wrangler.jsonc |
| PR #14 / FEAT-20261109-06 | 文档 | runtime-configuration.md 英文文档内插入中文段落，风格不一致 | docs/runtime-configuration.md:178 |
| PR #14 / FEAT-20261109-06 | Floe 知识库 | 向量 metadata 只存前 1000 字，support.md 公司地址段在截断之后，检索上下文看不到 | app/api/admin/vectorize/route.ts:290 |
