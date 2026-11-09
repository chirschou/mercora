-- FIX-20261109-03：在已发布的 CMS 页面中填入运营主体信息和客服电话（内容迁移，无表结构变更）。
--
-- 用途：
-- - 所有页面中，把 0027 留下的四个占位符换成实际值：
--   [COMPANY LEGAL NAME] → DONG LU LIMITED
--   [COMPANY REGISTRATION NUMBER] → 3293783（按上下文写作 Hong Kong Company Registration No. 3293783）
--   [REGISTERED ADDRESS] → Unit 1523A, 15/F, Star House, 3 Salisbury Road, Tsim Sha Tsui, Kowloon, Hong Kong
--   [GOVERNING JURISDICTION] → the Hong Kong Special Administrative Region（条款第 17 节的法院写作 the courts of Hong Kong）
-- - contact 页在 Support hours 前加一节 Phone support；privacy-policy 和 terms-of-service 的联系方式段落
--   在邮箱后加一行电话。电话为纯文本：页面清洗器只放行 http、https、mailto，tel: 链接会被去掉 href。
--
-- 写法约定：
-- - expand-only：只有 INSERT 与 UPDATE，不改表结构，不删除任何行。
-- - 用 REPLACE 原地替换，后台改过的正文其余文字保持不变。先替换带上下文的整句，再替换剩余的裸占位符。
-- - 第 1、2 步用同一个条件判断页面「仍需修改」：还有占位符，或者电话尚未写入且锚点仍在。
--   改完后条件不再成立，重复执行是空操作；后台删掉锚点的页面不加电话。
-- - 覆盖前若当前版本没有 page_versions 记录，先快照；覆盖后为新版本再写一条 page_versions（同 0027）。
-- - 不可下迁移。回滚内容：在后台 Pages 中按 page_versions 取回旧版本。

-- 1. 覆盖前快照。

INSERT INTO page_versions (page_id, title, content, excerpt, meta_title, meta_description, meta_keywords, version, change_summary, created_by)
SELECT p.id, p.title, p.content, p.excerpt, p.meta_title, p.meta_description, p.meta_keywords, p.version, 'Snapshot before FIX-20261109-03 company details and support phone', 'system'
FROM pages p
WHERE (
    instr(p.content, '[COMPANY LEGAL NAME]') > 0
    OR instr(p.content, '[COMPANY REGISTRATION NUMBER]') > 0
    OR instr(p.content, '[REGISTERED ADDRESS]') > 0
    OR instr(p.content, '[GOVERNING JURISDICTION]') > 0
    OR (p.slug = 'contact'
        AND instr(p.content, '+1 (929) 206-2531') = 0
        AND instr(p.content, '<h2>Support hours</h2>') > 0)
    OR (p.slug IN ('privacy-policy', 'terms-of-service')
        AND instr(p.content, '+1 (929) 206-2531') = 0
        AND instr(p.content, '<p>Email: <a href="mailto:support@melt.party">support@melt.party</a><br />') > 0)
  )
  AND NOT EXISTS (SELECT 1 FROM page_versions v WHERE v.page_id = p.id AND v.version = p.version);

-- 2. 替换占位符并加入电话，version 递增。

UPDATE pages
SET content = CASE
      WHEN slug IN ('privacy-policy', 'terms-of-service') AND instr(content, '+1 (929) 206-2531') = 0 THEN REPLACE(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(content,
          '(registration number [COMPANY REGISTRATION NUMBER])', '(Hong Kong Company Registration No. 3293783)'),
          'Registration number: [COMPANY REGISTRATION NUMBER]', 'Hong Kong Company Registration No. 3293783'),
          '[COMPANY REGISTRATION NUMBER]', '3293783'),
          '[COMPANY LEGAL NAME]', 'DONG LU LIMITED'),
          '[REGISTERED ADDRESS]', 'Unit 1523A, 15/F, Star House, 3 Salisbury Road, Tsim Sha Tsui, Kowloon, Hong Kong'),
          'governed by the laws of [GOVERNING JURISDICTION], and the courts of [GOVERNING JURISDICTION] have jurisdiction', 'governed by the laws of the Hong Kong Special Administrative Region, and the courts of Hong Kong have jurisdiction'),
          '[GOVERNING JURISDICTION]', 'the Hong Kong Special Administrative Region'),
        '<p>Email: <a href="mailto:support@melt.party">support@melt.party</a><br />',
        '<p>Email: <a href="mailto:support@melt.party">support@melt.party</a><br />Phone: +1 (929) 206-2531<br />')
      WHEN slug = 'contact' AND instr(content, '+1 (929) 206-2531') = 0 THEN REPLACE(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(content,
          '(registration number [COMPANY REGISTRATION NUMBER])', '(Hong Kong Company Registration No. 3293783)'),
          'Registration number: [COMPANY REGISTRATION NUMBER]', 'Hong Kong Company Registration No. 3293783'),
          '[COMPANY REGISTRATION NUMBER]', '3293783'),
          '[COMPANY LEGAL NAME]', 'DONG LU LIMITED'),
          '[REGISTERED ADDRESS]', 'Unit 1523A, 15/F, Star House, 3 Salisbury Road, Tsim Sha Tsui, Kowloon, Hong Kong'),
          'governed by the laws of [GOVERNING JURISDICTION], and the courts of [GOVERNING JURISDICTION] have jurisdiction', 'governed by the laws of the Hong Kong Special Administrative Region, and the courts of Hong Kong have jurisdiction'),
          '[GOVERNING JURISDICTION]', 'the Hong Kong Special Administrative Region'),
        '<h2>Support hours</h2>',
        '<h2>Phone support</h2>
<p>Call +1 (929) 206-2531 during our support hours.</p>
<h2>Support hours</h2>')
      ELSE
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(content,
          '(registration number [COMPANY REGISTRATION NUMBER])', '(Hong Kong Company Registration No. 3293783)'),
          'Registration number: [COMPANY REGISTRATION NUMBER]', 'Hong Kong Company Registration No. 3293783'),
          '[COMPANY REGISTRATION NUMBER]', '3293783'),
          '[COMPANY LEGAL NAME]', 'DONG LU LIMITED'),
          '[REGISTERED ADDRESS]', 'Unit 1523A, 15/F, Star House, 3 Salisbury Road, Tsim Sha Tsui, Kowloon, Hong Kong'),
          'governed by the laws of [GOVERNING JURISDICTION], and the courts of [GOVERNING JURISDICTION] have jurisdiction', 'governed by the laws of the Hong Kong Special Administrative Region, and the courts of Hong Kong have jurisdiction'),
          '[GOVERNING JURISDICTION]', 'the Hong Kong Special Administrative Region')
    END,
    updated_at = unixepoch(),
    version = version + 1
WHERE instr(content, '[COMPANY LEGAL NAME]') > 0
   OR instr(content, '[COMPANY REGISTRATION NUMBER]') > 0
   OR instr(content, '[REGISTERED ADDRESS]') > 0
   OR instr(content, '[GOVERNING JURISDICTION]') > 0
   OR (slug = 'contact'
       AND instr(content, '+1 (929) 206-2531') = 0
       AND instr(content, '<h2>Support hours</h2>') > 0)
   OR (slug IN ('privacy-policy', 'terms-of-service')
       AND instr(content, '+1 (929) 206-2531') = 0
       AND instr(content, '<p>Email: <a href="mailto:support@melt.party">support@melt.party</a><br />') > 0);

-- 3. 为新写入的版本补版本记录。

INSERT INTO page_versions (page_id, title, content, excerpt, meta_title, meta_description, meta_keywords, version, change_summary, created_by)
SELECT p.id, p.title, p.content, p.excerpt, p.meta_title, p.meta_description, p.meta_keywords, p.version, 'FIX-20261109-03 company details and support phone', 'system'
FROM pages p
WHERE (instr(p.content, 'DONG LU LIMITED') > 0 OR instr(p.content, '+1 (929) 206-2531') > 0)
  AND NOT EXISTS (SELECT 1 FROM page_versions v WHERE v.page_id = p.id AND v.version = p.version);
