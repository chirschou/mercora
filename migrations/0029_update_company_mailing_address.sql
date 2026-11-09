-- FEAT-20261109-06：将公司通信地址改为丹佛地址，不改变注册主体或适用法律。
-- 旧地址仅作为匹配源；只更新含旧地址或目标地址旧称谓的正文，保留后台其他编辑。
-- 在同一迁移事务内先保存旧版本和待写入的新版本，再更新 pages，避免为未修改页面补写历史。
-- 重跑时匹配条件不成立，pages 与 page_versions 均不写入；回滚内容通过后台页面历史恢复。

INSERT INTO page_versions (page_id, title, content, excerpt, meta_title, meta_description, meta_keywords, version, change_summary, created_by)
SELECT p.id, p.title, p.content, p.excerpt, p.meta_title, p.meta_description, p.meta_keywords,
       p.version, '覆盖前快照：FEAT-20261109-06 更新公司通信地址', 'system'
FROM pages p
WHERE (instr(p.content, 'Unit 1523A, 15/F, Star House, 3 Salisbury Road, Tsim Sha Tsui, Kowloon, Hong Kong') > 0
    OR instr(p.content, 'Our registered address is 1521 Blake St Ste 47009, Denver, Colorado 80202, United States') > 0
    OR instr(p.content, 'located at 1521 Blake St Ste 47009, Denver, Colorado 80202, United States') > 0)
  AND NOT EXISTS (SELECT 1 FROM page_versions v WHERE v.page_id = p.id AND v.version = p.version);

INSERT INTO page_versions (page_id, title, content, excerpt, meta_title, meta_description, meta_keywords, version, change_summary, created_by)
SELECT p.id, p.title,
  REPLACE(REPLACE(REPLACE(REPLACE(p.content,
    'Unit 1523A, 15/F, Star House, 3 Salisbury Road, Tsim Sha Tsui, Kowloon, Hong Kong',
    '1521 Blake St Ste 47009, Denver, Colorado 80202, United States'),
    'Our registered address is 1521 Blake St Ste 47009, Denver, Colorado 80202, United States',
    'Our mailing address is 1521 Blake St Ste 47009, Denver, Colorado 80202, United States'),
    'located at 1521 Blake St Ste 47009, Denver, Colorado 80202, United States',
    'whose mailing address is 1521 Blake St Ste 47009, Denver, Colorado 80202, United States'),
    'DONG LU LIMITED<br />1521 Blake St Ste 47009, Denver, Colorado 80202, United States',
    'DONG LU LIMITED<br />Mailing address: 1521 Blake St Ste 47009, Denver, Colorado 80202, United States'),
  p.excerpt, p.meta_title, p.meta_description, p.meta_keywords,
  p.version + 1, 'FEAT-20261109-06 更新公司通信地址', 'system'
FROM pages p
WHERE (instr(p.content, 'Unit 1523A, 15/F, Star House, 3 Salisbury Road, Tsim Sha Tsui, Kowloon, Hong Kong') > 0
    OR instr(p.content, 'Our registered address is 1521 Blake St Ste 47009, Denver, Colorado 80202, United States') > 0
    OR instr(p.content, 'located at 1521 Blake St Ste 47009, Denver, Colorado 80202, United States') > 0)
  AND NOT EXISTS (SELECT 1 FROM page_versions v WHERE v.page_id = p.id AND v.version = p.version + 1);

UPDATE pages AS p
SET content = REPLACE(REPLACE(REPLACE(REPLACE(p.content,
    'Unit 1523A, 15/F, Star House, 3 Salisbury Road, Tsim Sha Tsui, Kowloon, Hong Kong',
    '1521 Blake St Ste 47009, Denver, Colorado 80202, United States'),
    'Our registered address is 1521 Blake St Ste 47009, Denver, Colorado 80202, United States',
    'Our mailing address is 1521 Blake St Ste 47009, Denver, Colorado 80202, United States'),
    'located at 1521 Blake St Ste 47009, Denver, Colorado 80202, United States',
    'whose mailing address is 1521 Blake St Ste 47009, Denver, Colorado 80202, United States'),
    'DONG LU LIMITED<br />1521 Blake St Ste 47009, Denver, Colorado 80202, United States',
    'DONG LU LIMITED<br />Mailing address: 1521 Blake St Ste 47009, Denver, Colorado 80202, United States'),
    updated_at = unixepoch(),
    version = version + 1
WHERE instr(p.content, 'Unit 1523A, 15/F, Star House, 3 Salisbury Road, Tsim Sha Tsui, Kowloon, Hong Kong') > 0
    OR instr(p.content, 'Our registered address is 1521 Blake St Ste 47009, Denver, Colorado 80202, United States') > 0
    OR instr(p.content, 'located at 1521 Blake St Ste 47009, Denver, Colorado 80202, United States') > 0;
