# 审查清单（按模块积累的踩坑与审查项）

## 数据迁移 / 内容迁移

- 内容迁移要可重复执行：页面 UPSERT 须带全字段 `IS NOT` 比较的 WHERE，使重跑为空操作；覆盖前后各写一条 page_versions，并用 NOT EXISTS 防重。（PR #10）
- 审查须同时验证全新库（依次应用全部迁移）与已应用旧迁移、后台改过数据的现有库，结果一致且重跑不变。（PR #10）
- 内容迁移的每条 REPLACE 都要核对是否被 WHERE 覆盖；只出现在 SET 里的替换对「已部分修改」的行不生效。（PR #14）
- 生产知识库变更只上传对应 R2 文件并 upsert 受影响的 knowledge-* 向量；/api/admin/vectorize 全量重建会清空商品向量。（PR #14）

## 测试

- Workers 测试池加载不了 sanitize-html，HTML 清洗等价断言须放 node 单测，直接解析迁移 SQL 字面量。（PR #10）
- Workers 集成测试按文件而非按用例隔离存储；依赖「空 Blog」等前提的测试文件须整体切片到对应迁移编号。（PR #10）

## 订阅

- 改 `STORE_SUBSCRIPTION_TERMS_VERSION` 只影响新发起的 setup-intent 校验；续费与对账不读该值，但未刷新的页面会得 409。（PR #10）
