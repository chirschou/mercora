-- FEAT-20261109-01：发布 Melt Party 自有的页脚页面与 Blog 内容（内容迁移，无表结构变更）。
--
-- 用途：重写 about、privacy-policy、terms-of-service 三个 CMS 页面，新增 contact 页面，
-- 新增 2 个 Blog 分类与 5 篇已发布的原创文章。
--
-- 写法约定：
-- - expand-only：只有 INSERT 与 UPSERT，不改表结构，不删除任何行。
-- - 三个已有页面按 slug 直接覆盖。覆盖前若当前版本没有 page_versions 记录，先把当前内容
--   快照进 page_versions；覆盖后为新版本再写一条 page_versions。全新库与已有生产库得到
--   同样的页面内容，后台改过的旧内容可以在版本记录中找回。
-- - 页面 UPSERT 带 WHERE 条件，文章与分类用 ON CONFLICT(slug) DO NOTHING，重复执行是空操作；
--   库里已有同 slug 的文章时不覆盖。
-- - 正文日期写死为 November 9, 2026，不使用 date('now')。
-- - 不可下迁移。回滚内容：在后台 Pages 中按 page_versions 取回旧版本；文章在后台 Blog 中编辑或下线。

-- 1. 覆盖前快照：当前版本尚无版本记录的页面，先保存现有内容。

INSERT INTO page_versions (page_id, title, content, excerpt, meta_title, meta_description, meta_keywords, version, change_summary, created_by)
SELECT p.id, p.title, p.content, p.excerpt, p.meta_title, p.meta_description, p.meta_keywords, p.version, 'Snapshot before FEAT-20261109-01 content rewrite', 'system'
FROM pages p
WHERE p.slug IN ('about', 'privacy-policy', 'terms-of-service', 'contact')
  AND NOT EXISTS (SELECT 1 FROM page_versions v WHERE v.page_id = p.id AND v.version = p.version);

-- 2. 页面 UPSERT：已有页面覆盖并递增 version，contact 新建为 version 1。

INSERT INTO pages (title, slug, content, excerpt, meta_title, meta_description, meta_keywords, status, published_at, template, sort_order, show_in_nav, nav_title, is_protected)
VALUES (
'About Us',
'about',
'<p><strong>Last Updated:</strong> November 9, 2026</p>
<h2>What we do</h2>
<p>Melt Party is an online store for technical outdoor and emergency gear. We put together a focused range of equipment for people who spend time on trails, at camp or on the road, and for anyone who wants a household or vehicle kit that is ready before it is needed.</p>
<p>Our range centers on gear that earns its place in a pack: tools that handle more than one job, light and navigation that work after dark and away from cell service, and pouches and kits that keep the essentials organized. We sell online through melt.party and ship to the destinations offered at checkout.</p>
<h2>What you''ll find</h2>
<p>The catalog is organized around the situations our customers plan for:</p>
<ul>
<li><strong>Packs and pouches</strong> for a day''s carry or an emergency stash, from the roll-top <a href="/product/coastal-track-pack">Coastal Track Pack</a> to the clip-on <a href="/product/rapid-wave-kit">Rapid Wave Kit</a>.</li>
<li><strong>Tools and multi-tools</strong> for field adjustments and repairs, such as the <a href="/product/twin-dune-tool">Twin Dune Tool</a>. See the full range in <a href="/category/tools">Tools</a>.</li>
<li><strong>Fire starters</strong>, including the ferrocerium-rod <a href="/product/dusty-fire-tool">Dusty Fire Tool</a>, the solar-charged <a href="/product/solar-arc-tool">Solar Arc Tool</a> and the windproof <a href="/product/nova-flame-device">Nova Flame Device</a>.</li>
<li><strong>Lighting</strong> for hands-free, pocket and long-range use, such as the wrist-mounted <a href="/product/storm-orbit-device">Storm Orbit Device</a>.</li>
<li><strong>Navigation and communication devices</strong>: GPS, a digital compass, a weather-alert radio and signaling units. Browse <a href="/category/navigation">Navigation</a> and <a href="/category/tech">Tech</a>.</li>
<li><strong>Emergency kits</strong> and organizer pouches such as the <a href="/product/wild-harbor-kit">Wild Harbor Kit</a>.</li>
<li><strong>Provisions</strong>, including shelf-stable rations in the <a href="/product/field-ration-resupply">Field Ration Resupply</a> box. See <a href="/category/provisions">Provisions</a>.</li>
<li><strong>Digital gift cards</strong> in $25, $50, $100 and $200 amounts, delivered by email. See the <a href="/product/gift-card">Melt Party Gift Card</a>.</li>
</ul>
<h2>How we help you choose</h2>
<p>Every product page describes what the item is designed for and what it includes. If you still have a question, ask Floe, our shopping assistant. Floe answers from our product catalog and store policies and can suggest products that match what you describe. Like any automated assistant, Floe can make mistakes, so the product page and our published policies are always the final word.</p>
<p>Product reviews come only from customers who bought the item through Melt Party. Each one carries a Verified purchase label, is checked before it is published, and is shown without the reviewer''s name.</p>
<h2>How we run the store</h2>
<ul>
<li><strong>Payments by Stripe.</strong> Card details are entered into Stripe''s secure payment form and never pass through our servers.</li>
<li><strong>Hosted on Cloudflare.</strong> The store, its database and its images run on Cloudflare''s network.</li>
<li><strong>Prices confirmed before you pay.</strong> Product prices, discounts, taxes and shipping are calculated by our servers at checkout and shown to you before payment.</li>
<li><strong>Policies in plain language.</strong> Our <a href="/privacy-policy">Privacy Policy</a> explains how we handle your information, and our <a href="/terms-of-service">Terms of Service</a> cover orders, shipping, returns, gift cards, subscriptions and warranty.</li>
</ul>
<h2>Who we are</h2>
<p>Melt Party is operated by [COMPANY LEGAL NAME]. Our registered address is [REGISTERED ADDRESS].</p>
<p>That address is for official correspondence only. Please do not send returns there; return instructions are provided by email for each request.</p>
<h2>Get in touch</h2>
<p>Questions about an order, a product or this website? Email <a href="mailto:support@melt.party">support@melt.party</a>, or visit our <a href="/contact">Contact page</a> for support hours, response times and what to include in your message.</p>',
'Melt Party is an online store for technical outdoor and emergency gear, chosen for people who spend time on the trail and want to be ready when plans change.',
'About Melt Party',
'Melt Party is an online store for technical outdoor and emergency gear: packs, tools, fire starters, lighting, navigation devices, kits and provisions.',
NULL,
'published',
NULL,
'about',
1,
1,
NULL,
0
)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  content = excluded.content,
  excerpt = excluded.excerpt,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description,
  meta_keywords = excluded.meta_keywords,
  status = excluded.status,
  published_at = excluded.published_at,
  template = excluded.template,
  sort_order = excluded.sort_order,
  show_in_nav = excluded.show_in_nav,
  nav_title = excluded.nav_title,
  is_protected = excluded.is_protected,
  updated_at = unixepoch(),
  version = pages.version + 1
WHERE pages.title IS NOT excluded.title
   OR pages.content IS NOT excluded.content
   OR pages.excerpt IS NOT excluded.excerpt
   OR pages.meta_title IS NOT excluded.meta_title
   OR pages.meta_description IS NOT excluded.meta_description
   OR pages.meta_keywords IS NOT excluded.meta_keywords
   OR pages.status IS NOT excluded.status
   OR pages.published_at IS NOT excluded.published_at
   OR pages.template IS NOT excluded.template
   OR pages.sort_order IS NOT excluded.sort_order
   OR pages.show_in_nav IS NOT excluded.show_in_nav
   OR pages.nav_title IS NOT excluded.nav_title
   OR pages.is_protected IS NOT excluded.is_protected;

INSERT INTO pages (title, slug, content, excerpt, meta_title, meta_description, meta_keywords, status, published_at, template, sort_order, show_in_nav, nav_title, is_protected)
VALUES (
'Privacy Policy',
'privacy-policy',
'<p><strong>Last Updated:</strong> November 9, 2026</p>
<p>This Privacy Policy explains what personal information Melt Party collects when you visit melt.party, create an account, place an order or otherwise use our services, and how we use, share and protect that information.</p>
<h2>1. Who We Are</h2>
<p>Melt Party is operated by [COMPANY LEGAL NAME] (registration number [COMPANY REGISTRATION NUMBER]), located at [REGISTERED ADDRESS]. In this policy, “Melt Party”, “we” and “us” refer to that company.</p>
<p>We decide how and why the personal information described here is processed, so we act as its controller under applicable data protection laws. You can reach us about anything in this policy at <a href="mailto:support@melt.party">support@melt.party</a>.</p>
<h2>2. Information We Collect</h2>
<p>We collect only what we need to run the store. Depending on how you use it, that includes the following.</p>
<h3>Account information</h3>
<p>If you create an account, our authentication provider, Clerk, collects your email address, your name and the sign-in method you choose. If you sign in with a password, Clerk handles it and we never see it.</p>
<h3>Order and checkout information</h3>
<ul>
<li>The recipient''s full name, your email address and the shipping address: address lines 1 and 2, city, state, ZIP code and country. We do not ask for a phone number.</li>
<li>What you ordered, prices, discounts, taxes, the shipping method, order status and status history, and any refunds.</li>
</ul>
<p>You can check out as a guest without creating an account; we still collect the information above to fulfill the order.</p>
<h3>Payment information</h3>
<p>Card details are collected and stored by our payment processor, Stripe, and do not pass through our servers. If you choose to save a card, Stripe stores it. We keep only the link between your account and your Stripe customer record, plus the card brand, last four digits and expiry date so we can show you which card is saved.</p>
<h3>Saved addresses and profile settings</h3>
<p>If you are signed in, we store the addresses you save to your account and the first and last name in your profile settings.</p>
<h3>Subscriptions</h3>
<p>If you subscribe to a product, we store the plan and its price at the time you subscribed, the quantity, the delivery address, a record of your consent including the version of our recurring-purchase terms you accepted, and the subscription status reported by Stripe. Your payment method stays with Stripe; we do not store its identifier.</p>
<h3>Gift cards</h3>
<p>If you buy a gift card, we collect the recipient''s email address and, if you add them, the recipient''s name, your personal message and a delivery date. Please only give us someone else''s details if you have their permission to do so.</p>
<h3>Reviews</h3>
<p>If you review a product you bought, we store your rating, the review title and text, and the date you submitted it. Published reviews show the rating, title, text, date and a Verified purchase label. They do not show your name.</p>
<h3>Conversations with Floe</h3>
<p>When you use Floe, our shopping assistant, your browser sends us your question, your first name if you are signed in, recent messages from the conversation and, if you are signed in, a short summary of your recent orders. We also receive the approximate country and region that Cloudflare derives from your connection. Section 7 explains how this is handled.</p>
<h3>Performance data</h3>
<p>To keep pages fast, your browser reports page performance measurements (Web Vitals). We record only the metric name, its rating, the page template with query strings and dynamic values removed, and whether the device is mobile. These records contain no cookies and no user identifiers.</p>
<h3>Technical data</h3>
<p>Like any website, our hosting provider, Cloudflare, processes your IP address and request details such as browser type to deliver pages, secure the site and apply rate limits. Rate limits are counted per account or per IP address. We do not store IP addresses in our store database.</p>
<h3>Communications</h3>
<p>If you email us, we keep your message, your email address and our reply so we can help you and keep a record of the request.</p>
<h2>3. How We Use Information</h2>
<p>We use personal information to:</p>
<ul>
<li>process orders and payments, and calculate taxes and shipping;</li>
<li>ship orders, provide tracking, and handle returns, refunds and warranty claims;</li>
<li>create and maintain your account, saved addresses and saved cards;</li>
<li>bill and fulfill subscriptions you set up;</li>
<li>deliver gift cards to the recipient you choose;</li>
<li>send transactional emails about your orders, and review reminders you can opt out of;</li>
<li>answer your questions through Floe and through our support team;</li>
<li>prevent fraud and abuse and keep the site secure, including through rate limiting and automated bot protection;</li>
<li>measure and improve site performance; and</li>
<li>meet our legal, tax and accounting obligations.</li>
</ul>
<h2>4. Legal Bases (EEA/UK)</h2>
<p>If you are in the European Economic Area or the United Kingdom, we rely on the following legal bases:</p>
<ul>
<li><strong>Performance of a contract</strong>: to process your orders, provide your account, run subscriptions and deliver gift cards.</li>
<li><strong>Legitimate interests</strong>: to keep the site secure and prevent fraud, to measure performance, to send review reminders (which you can opt out of at any time) and for internal operational reporting. We balance these interests against your rights.</li>
<li><strong>Legal obligation</strong>: to keep tax and accounting records.</li>
<li><strong>Consent</strong>: where we ask for it. You can withdraw consent at any time without affecting processing that took place before.</li>
</ul>
<h2>5. How We Share Information</h2>
<p><strong>We do not sell your personal information.</strong> We do not share it for cross-context behavioral advertising.</p>
<p>We share personal information only with the service providers that help us run the store, and only for the purposes below:</p>
<table>
<thead>
<tr><th>Provider</th><th>What they do for us</th></tr>
</thead>
<tbody>
<tr><td>Clerk</td><td>Sign-in, authentication and account management</td></tr>
<tr><td>Stripe</td><td>Payment processing, saved cards, subscription billing and fraud prevention</td></tr>
<tr><td>Cloudflare</td><td>Website hosting and content delivery, our database and file storage, the AI models and search index behind Floe, email delivery, performance analytics, rate limiting and bot protection</td></tr>
<tr><td>Shipping carriers</td><td>Delivering your order; they receive the recipient''s name and shipping address</td></tr>
</tbody>
</table>
<p>We may also disclose information when required by law or to protect our rights, our customers or the public, and it may be transferred as part of a merger, acquisition or sale of all or part of our business, subject to this policy.</p>
<h2>6. Cookies and Browser Storage</h2>
<p>We use only the cookies and browser storage needed to run the store and remember your cart and conversations. <strong>We do not use advertising cookies or third-party analytics cookies.</strong></p>
<table>
<thead>
<tr><th>Name</th><th>Provider</th><th>Purpose</th><th>Type</th></tr>
</thead>
<tbody>
<tr><td>__session, __client_uat (and variants with a suffix)</td><td>Clerk, on melt.party</td><td>Keeps you signed in</td><td>Strictly necessary</td></tr>
<tr><td>__client</td><td>Clerk, on clerk.melt.party</td><td>Maintains your sign-in session with Clerk</td><td>Strictly necessary</td></tr>
<tr><td>__stripe_mid, __stripe_sid</td><td>Stripe, on melt.party</td><td>Fraud prevention for payments; set only on pages that load Stripe</td><td>Strictly necessary</td></tr>
<tr><td>Cloudflare security cookies, such as __cf_bm and cf_clearance</td><td>Cloudflare</td><td>Bot protection and security challenges; set only when needed</td><td>Strictly necessary</td></tr>
<tr><td>cart-storage (local storage)</td><td>Melt Party</td><td>Remembers the items in your cart</td><td>Functional</td></tr>
<tr><td>chat-storage (local storage)</td><td>Melt Party</td><td>Keeps your Floe conversation and suggested products</td><td>Functional</td></tr>
<tr><td>melt-party:pending-checkout: followed by a payment ID (local storage)</td><td>Melt Party</td><td>Lets an interrupted checkout resume, using the order ID, payment ID and time saved; removed when checkout completes</td><td>Strictly necessary</td></tr>
</tbody>
</table>
<p>You can clear cookies and site data in your browser settings at any time. Clearing them signs you out and empties your cart and your Floe conversation.</p>
<h2>7. Floe, Our AI Shopping Assistant</h2>
<ul>
<li>Floe''s answers are generated by AI models running on Cloudflare Workers AI, using our product catalog and store policies.</li>
<li>Our servers do not save your conversations. The conversation is kept only in your own browser, in the chat-storage entry described above, and is deleted when you clear it.</li>
<li>Please do not share sensitive information with Floe, such as card numbers, passwords or health information.</li>
<li>Floe can make mistakes. For order details and policies, rely on your order pages and the policies published on this site.</li>
</ul>
<h2>8. Emails</h2>
<ul>
<li><strong>Transactional emails</strong> are sent because they are part of the service you asked for: order confirmations, shipping confirmations, refund confirmations, updates on reviews you submitted, gift card delivery, and orders created by your subscription. You will still receive them if you opt out of reminders.</li>
<li><strong>Review reminders</strong> are not transactional. Every reminder includes an unsubscribe link, and opting out stops future reminders.</li>
<li>Our emails are sent through Cloudflare Email Sending from orders@mail.melt.party.</li>
</ul>
<h2>9. How Long We Keep Information</h2>
<ul>
<li><strong>Account information</strong> is kept while your account is open, and afterward only as long as needed to meet legal, tax and accounting obligations and to resolve disputes.</li>
<li><strong>Order records</strong> are kept for as long as tax and accounting rules require.</li>
<li><strong>Guest order status links</strong> expire 7 days after they are issued by default, and never last longer than 30 days.</li>
<li><strong>Browser storage</strong> stays on your device until you clear it.</li>
<li><strong>Operational logs</strong> are kept for a short period by our hosting provider. Our own commerce monitoring is designed to exclude payment details, email and postal addresses, and order and customer identifiers.</li>
</ul>
<h2>10. Your Rights and Choices</h2>
<p>You can do the following yourself at any time:</p>
<ul>
<li>update your name and saved addresses in your account;</li>
<li>remove a saved card; and</li>
<li>unsubscribe from review reminders using the link in any reminder email.</li>
</ul>
<p>Depending on where you live, you may also have the right to access, correct, delete or receive a portable copy of your personal information, to restrict or object to how we use it, and to withdraw consent. Account deletion and data export are not available as self-service options at the moment; please request them by email.</p>
<p>To make a request, email <a href="mailto:support@melt.party">support@melt.party</a> from the address linked to your account with the subject line <strong>Privacy request</strong>. We will verify your identity before acting on the request and respond within the time required by applicable law: one month under the GDPR, or 45 days under California law.</p>
<p>If you are not satisfied with our response, you have the right to complain to your local data protection authority.</p>
<h2>11. U.S. State Privacy Rights (including California)</h2>
<p>If you live in California or another U.S. state with a consumer privacy law, this section applies to you in addition to the rest of this policy.</p>
<ul>
<li><strong>Categories we collect</strong>: identifiers (such as name, email address and account details); customer records and commercial information (such as shipping addresses, orders, payment card brand and last four digits, subscriptions and gift cards); internet or network activity (such as performance measurements and request data); approximate location (country and region); the content of reviews, messages to us and questions to Floe. The sources are you, your browser, and our service providers, as described in Section 2.</li>
<li><strong>Purposes</strong>: the business purposes listed in Section 3.</li>
<li><strong>Your rights</strong>: to know what personal information we collect, use and disclose; to delete it; to correct it; and not to be discriminated against for exercising these rights. You may use an authorized agent, and we may ask the agent for proof of authorization and ask you to verify your identity.</li>
<li><strong>Sale and sharing</strong>: we do not sell personal information or share it for cross-context behavioral advertising, so we do not offer a “Do Not Sell or Share” link. If your browser sends a Global Privacy Control signal, we treat it as a valid request to opt out of sale and sharing.</li>
</ul>
<p>To exercise these rights, follow the steps in Section 10.</p>
<h2>12. Children</h2>
<p>Melt Party is not directed to children under 13, or under 16 in the EEA and the UK, and we do not knowingly collect their personal information. You must be at least 18 years old, or the age of majority where you live, to place an order. If we learn that we have collected information from a child, we will delete it.</p>
<h2>13. International Transfers</h2>
<p>We and our service providers process personal information in the United States and in other countries where those providers operate. Where the law requires it, we rely on appropriate safeguards offered by our providers, such as the European Commission''s Standard Contractual Clauses.</p>
<h2>14. Security</h2>
<p>We protect personal information with measures that fit the risk:</p>
<ul>
<li>the whole site is served over HTTPS;</li>
<li>card fields are hosted by Stripe, so card numbers never reach our servers;</li>
<li>access to the store''s administration area is restricted by permissions; and</li>
<li>guest order status links are signed and expire.</li>
</ul>
<p>No method of transmission or storage is completely secure, so we cannot guarantee absolute security. If you believe your account has been compromised, contact us right away.</p>
<h2>15. Changes to This Policy</h2>
<p>We may update this policy from time to time. When we do, we will change the Last Updated date at the top. If a change is significant, we will also post a notice on the site and, where appropriate, let you know by email.</p>
<h2>16. Contact Us</h2>
<p>Questions or requests about this policy or your personal information:</p>
<p>Email: <a href="mailto:support@melt.party">support@melt.party</a><br />[COMPANY LEGAL NAME]<br />[REGISTERED ADDRESS]</p>',
NULL,
NULL,
'How Melt Party collects, uses, shares and protects personal information, including cookies, Floe, emails, data retention and your privacy rights.',
NULL,
'published',
NULL,
'legal',
100,
1,
NULL,
0
)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  content = excluded.content,
  excerpt = excluded.excerpt,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description,
  meta_keywords = excluded.meta_keywords,
  status = excluded.status,
  published_at = excluded.published_at,
  template = excluded.template,
  sort_order = excluded.sort_order,
  show_in_nav = excluded.show_in_nav,
  nav_title = excluded.nav_title,
  is_protected = excluded.is_protected,
  updated_at = unixepoch(),
  version = pages.version + 1
WHERE pages.title IS NOT excluded.title
   OR pages.content IS NOT excluded.content
   OR pages.excerpt IS NOT excluded.excerpt
   OR pages.meta_title IS NOT excluded.meta_title
   OR pages.meta_description IS NOT excluded.meta_description
   OR pages.meta_keywords IS NOT excluded.meta_keywords
   OR pages.status IS NOT excluded.status
   OR pages.published_at IS NOT excluded.published_at
   OR pages.template IS NOT excluded.template
   OR pages.sort_order IS NOT excluded.sort_order
   OR pages.show_in_nav IS NOT excluded.show_in_nav
   OR pages.nav_title IS NOT excluded.nav_title
   OR pages.is_protected IS NOT excluded.is_protected;

INSERT INTO pages (title, slug, content, excerpt, meta_title, meta_description, meta_keywords, status, published_at, template, sort_order, show_in_nav, nav_title, is_protected)
VALUES (
'Terms of Service',
'terms-of-service',
'<p><strong>Last Updated:</strong> November 9, 2026</p>
<p>These Terms of Service govern your use of melt.party and every purchase you make from Melt Party. Please read them carefully, together with our <a href="/privacy-policy">Privacy Policy</a>.</p>
<h2>1. About These Terms</h2>
<p>These terms are an agreement between you and [COMPANY LEGAL NAME] (registration number [COMPANY REGISTRATION NUMBER]), located at [REGISTERED ADDRESS], which operates Melt Party (“Melt Party”, “we”, “us”).</p>
<p>By using the site or placing an order, you accept these terms. If you do not agree with them, please do not use the site. Our <a href="/privacy-policy">Privacy Policy</a> explains how we handle your personal information.</p>
<h2>2. Eligibility and Accounts</h2>
<ul>
<li>You must be at least 18 years old, or the age of majority where you live, to place an order.</li>
<li>Accounts are provided through our authentication provider, Clerk. Keep your sign-in details secure; you are responsible for activity under your account.</li>
<li>You can also check out as a guest without creating an account.</li>
<li>We may suspend or close an account that is used for fraud or abuse or that breaks these terms.</li>
</ul>
<h2>3. Products and Information</h2>
<p>We work to describe every product accurately. Product images and descriptions are for illustration, and small differences in color or finish can occur. Answers from Floe, our shopping assistant, are general guidance and not a promise about a product; if Floe and a product page disagree, the product page applies.</p>
<p>Some products are regulated in certain places, including bladed tools such as the tanto-style Eagle Shadow Tool, impact and breaching tools such as the Iron Echo Tool, and ignition devices. You are responsible for making sure you may legally buy, carry and use them where you live and travel. We may decline to ship a product to a place where its sale or possession is restricted.</p>
<h2>4. Orders, Pricing and Taxes</h2>
<ul>
<li>Prices are shown in U.S. dollars.</li>
<li>Product prices, discounts, taxes and shipping charges are calculated by our servers at checkout and shown to you before you pay.</li>
<li>We accept your order when your payment succeeds and we send an order confirmation.</li>
<li>We may cancel an order and refund it in full if a price or product description contains an obvious error, an item is out of stock, or we suspect fraud.</li>
<li>Promotional codes apply only under their stated conditions, may be withdrawn at any time, and have no cash value.</li>
</ul>
<h2>5. Payment</h2>
<p>Payments are processed by Stripe. You can choose to save a card for future purchases; saved cards are stored by Stripe, and you can remove them from your account at any time.</p>
<p>You can use a Melt Party Gift Card to pay for all or part of an order. If the gift card does not cover the full total, the remaining balance is charged to your card.</p>
<h2>6. Shipping and Delivery</h2>
<ul>
<li>We ship only to the countries offered at checkout. Currently this is the United States unless checkout shows otherwise.</li>
<li>The available shipping methods, their prices, estimated delivery times and any free-shipping threshold are shown at checkout before you pay.</li>
<li>Delivery times are estimates, not guarantees, and carrier delays or weather can affect them.</li>
<li>When your order ships, we email you tracking information.</li>
<li>To the extent permitted by law, risk of loss passes to you when we hand your order to the carrier.</li>
<li>Please check your shipping address carefully. We are not responsible for delays or losses caused by an incorrect address. If you notice a mistake, contact us as soon as possible.</li>
</ul>
<h2>7. Order Changes and Cancellations</h2>
<p>If you need to change or cancel an order, email <a href="mailto:support@melt.party">support@melt.party</a> with your order number as soon as possible. We can change or cancel an order only before it ships. Once an order has shipped, it can be returned under Section 8.</p>
<h2>8. Returns and Refunds</h2>
<ul>
<li><strong>Return window</strong>: you may return unused items in their original packaging within 30 days of delivery.</li>
<li><strong>How to return</strong>: email <a href="mailto:support@melt.party">support@melt.party</a> with your order number. We will reply with return instructions and, for eligible returns within the United States, a prepaid return label.</li>
<li><strong>Not returnable</strong>: clearance and final-sale items, gift cards, and opened food or other consumable items.</li>
<li><strong>Damaged, defective or incorrect items</strong>: contact us as soon as possible after delivery. We will cover the return shipping and, at your choice, replace the item or refund it.</li>
<li><strong>Refunds</strong>: once we receive and inspect your return, we issue the refund to your original payment method within 5–7 business days. Any amount you paid with a gift card is returned to that gift card. Your bank may take additional time to show the credit.</li>
</ul>
<h2>9. Gift Cards</h2>
<ul>
<li>Melt Party Gift Cards are available in $25, $50, $100 and $200 amounts.</li>
<li>Gift cards are delivered by email to the recipient address you enter, either as soon as payment completes or at the start of the delivery date you choose, up to one year ahead. Scheduled delivery runs on Coordinated Universal Time (UTC), so a card may arrive the evening before the chosen date in time zones behind UTC.</li>
<li>Gift cards never expire. They cannot be redeemed for cash, transferred or resold, and the balance can be used across multiple orders until it runs out.</li>
<li>Treat the gift card code like cash. We cannot replace a lost or stolen code or a balance used by someone else, except where the law requires it.</li>
</ul>
<h2>10. Subscriptions (Recurring Purchase Terms, version 2026-11-09)</h2>
<p>Some products can be bought as a subscription. When you subscribe:</p>
<ul>
<li>You must be signed in to your account.</li>
<li>Your subscription renews automatically, and you authorize us to charge your payment method at the price and interval of the plan you chose, until you cancel.</li>
<li>Each time a payment succeeds, we create an order and ship it to the address on your subscription.</li>
<li>You can pause payments, resume them, or cancel, either at the end of the current billing period or immediately, from <a href="/account/subscriptions">your subscriptions page</a>.</li>
<li>Canceling immediately stops future charges. Amounts already charged are not refunded automatically or prorated. If a renewal order has not shipped yet, you can ask us to refund it.</li>
<li>If a plan''s price changes, we will tell you before the new price applies, and you can cancel before it does.</li>
<li>Returns of subscription orders follow Section 8.</li>
</ul>
<h2>11. Product Warranty</h2>
<p>We offer a one-year limited warranty, starting on the date of delivery, against manufacturing defects in the gear we sell. The warranty does not cover normal wear and tear, damage from misuse or accidents, or cosmetic imperfections.</p>
<p>To make a claim, email <a href="mailto:support@melt.party">support@melt.party</a> with photos of the issue and your order number. We will respond within 3 business days. This warranty is in addition to any rights you have under consumer law and does not limit them.</p>
<h2>12. Safe Use</h2>
<p>Outdoor and emergency gear, especially blades, impact tools and anything that produces a flame or spark, can cause injury or damage if misused. Follow the instructions supplied with each product, keep it away from children, and obey local laws, fire restrictions and burn bans.</p>
<p>Content on this site, including our Blog and answers from Floe, is general information. It is not professional safety, medical or survival training, and it does not replace a qualified course or the advice of local authorities.</p>
<h2>13. Acceptable Use</h2>
<p>When using the site, you agree not to:</p>
<ul>
<li>commit fraud or use a payment method you are not authorized to use;</li>
<li>misuse promotional codes or gift cards;</li>
<li>interfere with the site or its security, or scrape it with automated tools in a way that exceeds our rate limits; or</li>
<li>try to make Floe reveal information or take actions it is not meant to.</li>
</ul>
<p>Reviews must reflect your genuine experience with the product. We may moderate reviews and remove any that break these terms.</p>
<h2>14. Intellectual Property</h2>
<p>The site and its content, including text, images, the Melt Party name and Blog articles, belong to Melt Party or its licensors and are protected by law. You may not copy or reuse them for commercial purposes without our written permission.</p>
<p>When you submit a review, you keep ownership of it and grant us a non-exclusive, royalty-free license to display, reproduce and adapt it on the site and in connection with our products.</p>
<h2>15. Disclaimers</h2>
<p>To the fullest extent permitted by law, the site and its content are provided “as is” and “as available”, without warranties of any kind beyond those stated in these terms. Nothing in these terms limits any rights you have under consumer protection laws that cannot be waived.</p>
<h2>16. Limitation of Liability</h2>
<p>To the fullest extent permitted by law, our total liability for any claim relating to an order is limited to the amount you paid for that order, and we are not liable for indirect or consequential losses.</p>
<p>Nothing in these terms excludes or limits liability for death or personal injury caused by negligence, for fraud, or for any other liability that cannot be excluded or limited by law.</p>
<h2>17. Governing Law and Disputes</h2>
<p>If you have a concern, please email <a href="mailto:support@melt.party">support@melt.party</a> first. We will try to resolve it informally within 30 days.</p>
<p>These terms are governed by the laws of [GOVERNING JURISDICTION], and the courts of [GOVERNING JURISDICTION] have jurisdiction over any dispute that we cannot resolve informally. If you are a consumer, you also keep the protection of the mandatory laws of the place where you live, and nothing in this section takes away those rights.</p>
<h2>18. Changes to These Terms</h2>
<p>We may update these terms from time to time. When we do, we will change the Last Updated date at the top. We will announce significant changes on the site in advance and, where appropriate, by email. Orders placed before a change are governed by the terms in effect when you placed them.</p>
<h2>19. Contact</h2>
<p>Questions about these terms:</p>
<p>Email: <a href="mailto:support@melt.party">support@melt.party</a><br />[COMPANY LEGAL NAME]<br />[REGISTERED ADDRESS]</p>',
NULL,
NULL,
'The terms for using melt.party and buying from Melt Party: orders, payment, shipping, returns, gift cards, subscriptions, warranty and disputes.',
NULL,
'published',
NULL,
'legal',
101,
1,
NULL,
0
)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  content = excluded.content,
  excerpt = excluded.excerpt,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description,
  meta_keywords = excluded.meta_keywords,
  status = excluded.status,
  published_at = excluded.published_at,
  template = excluded.template,
  sort_order = excluded.sort_order,
  show_in_nav = excluded.show_in_nav,
  nav_title = excluded.nav_title,
  is_protected = excluded.is_protected,
  updated_at = unixepoch(),
  version = pages.version + 1
WHERE pages.title IS NOT excluded.title
   OR pages.content IS NOT excluded.content
   OR pages.excerpt IS NOT excluded.excerpt
   OR pages.meta_title IS NOT excluded.meta_title
   OR pages.meta_description IS NOT excluded.meta_description
   OR pages.meta_keywords IS NOT excluded.meta_keywords
   OR pages.status IS NOT excluded.status
   OR pages.published_at IS NOT excluded.published_at
   OR pages.template IS NOT excluded.template
   OR pages.sort_order IS NOT excluded.sort_order
   OR pages.show_in_nav IS NOT excluded.show_in_nav
   OR pages.nav_title IS NOT excluded.nav_title
   OR pages.is_protected IS NOT excluded.is_protected;

INSERT INTO pages (title, slug, content, excerpt, meta_title, meta_description, meta_keywords, status, published_at, template, sort_order, show_in_nav, nav_title, is_protected)
VALUES (
'Contact Us',
'contact',
'<p><strong>Last Updated:</strong> November 9, 2026</p>
<h2>Email support</h2>
<p>Write to <a href="mailto:support@melt.party">support@melt.party</a>. So we can help in one reply, include your order number, the product involved and, if something arrived damaged or is not working, a photo.</p>
<h2>Support hours</h2>
<p>Monday–Friday, 9 a.m.–5 p.m. Pacific Time, excluding U.S. federal holidays.</p>
<p>We reply within one business day. Messages that arrive on a weekend or holiday are answered on the next business day.</p>
<h2>Orders, shipping and returns</h2>
<p>If you have an account, your orders and their status are in <a href="/account/orders">your account</a>. If you checked out as a guest, use the order status link in your confirmation email. For security those links expire; if yours has, email us with your order number.</p>
<p>To start a return, email us with your order number and we will send return instructions. Return windows, refunds and warranty claims are explained in our <a href="/terms-of-service">Terms of Service</a>.</p>
<h2>Privacy requests</h2>
<p>To access, correct, export or delete your personal information, email us from the address linked to your account with the subject line <strong>Privacy request</strong>. Our <a href="/privacy-policy">Privacy Policy</a> explains your rights and how we verify requests.</p>
<h2>Ask Floe anytime</h2>
<p>Floe, our shopping assistant, is available at any hour to answer questions about products, shipping options and store policies. For anything involving your account, a refund or your personal information, email our team so a person can help.</p>
<h2>Company details</h2>
<p>[COMPANY LEGAL NAME]<br />[REGISTERED ADDRESS]<br />Registration number: [COMPANY REGISTRATION NUMBER]</p>
<p>This address is for official correspondence only. It is not open to visitors and does not accept returns; return instructions are sent by email.</p>',
'Email support@melt.party and our team will reply within one business day, Monday through Friday.',
'Contact Melt Party',
'Contact Melt Party support by email for help with orders, shipping, returns, warranty and privacy requests. We reply within one business day.',
NULL,
'published',
NULL,
'contact',
102,
0,
NULL,
0
)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  content = excluded.content,
  excerpt = excluded.excerpt,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description,
  meta_keywords = excluded.meta_keywords,
  status = excluded.status,
  published_at = excluded.published_at,
  template = excluded.template,
  sort_order = excluded.sort_order,
  show_in_nav = excluded.show_in_nav,
  nav_title = excluded.nav_title,
  is_protected = excluded.is_protected,
  updated_at = unixepoch(),
  version = pages.version + 1
WHERE pages.title IS NOT excluded.title
   OR pages.content IS NOT excluded.content
   OR pages.excerpt IS NOT excluded.excerpt
   OR pages.meta_title IS NOT excluded.meta_title
   OR pages.meta_description IS NOT excluded.meta_description
   OR pages.meta_keywords IS NOT excluded.meta_keywords
   OR pages.status IS NOT excluded.status
   OR pages.published_at IS NOT excluded.published_at
   OR pages.template IS NOT excluded.template
   OR pages.sort_order IS NOT excluded.sort_order
   OR pages.show_in_nav IS NOT excluded.show_in_nav
   OR pages.nav_title IS NOT excluded.nav_title
   OR pages.is_protected IS NOT excluded.is_protected;

-- 3. 为新写入的版本补版本记录。

INSERT INTO page_versions (page_id, title, content, excerpt, meta_title, meta_description, meta_keywords, version, change_summary, created_by)
SELECT p.id, p.title, p.content, p.excerpt, p.meta_title, p.meta_description, p.meta_keywords, p.version, 'FEAT-20261109-01 content', 'system'
FROM pages p
WHERE p.slug IN ('about', 'privacy-policy', 'terms-of-service', 'contact')
  AND NOT EXISTS (SELECT 1 FROM page_versions v WHERE v.page_id = p.id AND v.version = p.version);

-- 4. Blog 分类。

INSERT INTO blog_categories (name, slug, description)
VALUES
('Gear Guides', 'gear-guides', 'Practical guides to choosing and using outdoor gear, from navigation and fire starting to lighting.'),
('Preparedness', 'preparedness', 'Planning advice and checklists for staying safe, reachable and ready when conditions change.')
ON CONFLICT(slug) DO NOTHING;

-- 5. Blog 文章：published_at = created_at = updated_at，均为整分钟（UTC）。

INSERT INTO blog_posts (title, slug, author, excerpt, tags, cover_image_url, cover_image_alt, status, editor_json, html, reading_time, category_id, meta_title, meta_description, published_at, created_at, updated_at)
VALUES (
'Build a Navigation Kit That Still Works When Your Phone Doesn''t',
'navigation-kit-that-works-without-your-phone',
'Melt Party Gear Team',
'Phones fail outdoors in ordinary ways: dead batteries, no signal, cold fingers. Here is how to layer a GPS, a compass and a paper map so you always know where you are.',
'["navigation","backcountry","guides"]',
'/products/polar-leaf-device-5.png',
'Polar Leaf Device, an olive-green handheld GPS unit with an antenna, a map display and tactile buttons',
'published',
NULL,
'<p>Most of us navigate with a phone now, and on a well-marked trail with full bars that works fine. The trouble starts when conditions change. A phone is a single device doing many jobs, and in the backcountry it can let you down in several ordinary ways at once. This guide walks through a layered navigation kit that keeps you oriented when the screen in your pocket cannot.</p>
<h2>Why phones fail outdoors</h2>
<p>A phone rarely fails because of one dramatic event. It is usually a slow pile-up of small problems:</p>
<ul>
<li><strong>Battery.</strong> Navigation apps keep the screen, the location chip and often the data connection busy. Photos, messages and a cold pocket drain the battery further. By mid-afternoon on a long day, many hikers are rationing the last few percent.</li>
<li><strong>Signal.</strong> Map apps that stream tiles stop showing detail as soon as you leave coverage. If you did not download the area in advance, you may be left with a blue dot on a blank screen.</li>
<li><strong>Cold and wet.</strong> Batteries lose capacity in the cold, touchscreens are hard to use with gloves or wet fingers, and rain on the glass can make the screen respond unpredictably.</li>
<li><strong>Damage.</strong> One slip on a rock can crack the screen of the device that also holds your map, your light and your way to call for help.</li>
</ul>
<p>None of this means leaving the phone at home. It means not relying on it alone.</p>
<h2>Build your kit in layers</h2>
<p>A reliable navigation setup has independent layers, so that the failure of one does not take the others with it. Think of three: a dedicated GPS device, a digital compass, and a paper map with a baseplate compass.</p>
<h3>Layer one: a dedicated GPS device</h3>
<p>A standalone GPS unit does one job, and that is its strength. It is not competing with your messages or camera for battery, and it is built to be used outdoors. The <a href="/product/polar-leaf-device">Polar Leaf Device</a> is a rugged GPS navigation unit designed for low-visibility terrain and remote use. It has tactile buttons you can press by feel, a high-contrast display that is easier to read in difficult light, and a reinforced housing.</p>
<p>Physical buttons matter more than they sound. With gloves on, in rain, or when your hands are cold, pressing a real button is far more dependable than tapping glass. Before your trip, load your route and the waypoints that matter most: trailheads, junctions, water sources, campsites and bail-out points.</p>
<h3>Layer two: a digital compass</h3>
<p>A GPS tells you where you are. A compass tells you which way you are facing, and that is often the more urgent question at a trail junction or in fog. The <a href="/product/quantum-ash-device">Quantum Ash Device</a> is a tactical digital compass in a rugged, charcoal-toned case, with tactile arrow keys and an OK button for making selections.</p>
<p>Carrying a separate compass gives you a second, independent source of direction. If the GPS screen and the compass agree, you can move on with confidence. If they disagree, stop and work out why before you take another step.</p>
<h3>Layer three: paper map and baseplate compass</h3>
<p>The final layer has no battery at all. A paper map of your area, kept in a waterproof bag, together with a simple baseplate compass, will keep working when everything electronic has given up. It also shows you the bigger picture in a way a small screen cannot: ridgelines, drainages, and the roads and trails that could get you out.</p>
<p>A map only helps if you can read it. Practice the basics close to home before you need them: orienting the map to north, identifying features around you, and taking a bearing to follow.</p>
<h2>Plan before you go</h2>
<p>Good navigation starts at the kitchen table, not at the trailhead.</p>
<ol>
<li><strong>Study the route.</strong> Look at the whole trip on a map. Note where the trail is easy to lose, where it crosses water, and where you could turn back or exit early.</li>
<li><strong>Set waypoints.</strong> Enter key points into your GPS and mark the same points on your paper map, so the two layers tell the same story.</li>
<li><strong>Download offline maps.</strong> If you will use your phone as a backup, download the area so the map works without signal.</li>
<li><strong>Charge and test everything.</strong> Start with full batteries and switch on each device at home to confirm it works. Carry spare power for the devices that need it.</li>
<li><strong>Set a turnaround time.</strong> Decide in advance when you will turn back, whether or not you have reached your goal, so daylight does not make the decision for you.</li>
</ol>
<h2>Tell someone your plan</h2>
<p>Navigation gear helps you find your own way. A trip plan helps other people find you if something goes wrong. Before you leave, give a trusted person your route, where you will park, who is with you, and the time you expect to be back. Agree on a check-in time, and on what they should do and whom they should call if they have not heard from you by then.</p>
<p>When you get back, check in as promised, even if you are tired. A trip plan only works if the person holding it knows when to act.</p>
<h2>Practice on easy ground</h2>
<p>The time to learn your GPS menus and practice with your compass is on a familiar trail on a clear day, not in fog at an unmarked junction. Use your full kit on a few short outings. Follow a bearing to a landmark, mark a waypoint and navigate back to it, and compare what each layer tells you. Those repetitions turn the kit into a habit, and habits hold up when conditions get difficult.</p>
<h2>Putting your kit together</h2>
<p>You do not need a lot of gear to navigate well, but you do need more than one way to do it. Start with a dedicated GPS like the <a href="/product/polar-leaf-device">Polar Leaf Device</a>, add a second source of direction such as the <a href="/product/quantum-ash-device">Quantum Ash Device</a>, and keep a paper map in your pack. You can browse more options in our <a href="/category/navigation">Navigation</a> collection, and if you have questions about which device fits your trips, ask Floe, our shopping assistant, or email our team.</p>',
5,
(SELECT id FROM blog_categories WHERE slug = 'gear-guides'),
'Build a Navigation Kit That Works Without Your Phone',
'Build a layered backcountry navigation kit with a dedicated GPS, a digital compass and a paper map, plus the trip planning that keeps you found.',
1781625600,
1781625600,
1781625600
)
ON CONFLICT(slug) DO NOTHING;

INSERT INTO blog_posts (title, slug, author, excerpt, tags, cover_image_url, cover_image_alt, status, editor_json, html, reading_time, category_id, meta_title, meta_description, published_at, created_at, updated_at)
VALUES (
'Fire Starting in Wet Weather: Ferro Rods, Arc Lighters and Windproof Torches',
'fire-starting-in-wet-weather',
'Melt Party Gear Team',
'Damp wood and wind make fire starting hard. Learn how the fire triangle works, how three ignition tools compare, and how to put a fire out completely.',
'["fire","survival","guides"]',
'/products/dusty-fire-tool-1.png',
'Dusty Fire Tool ferrocerium rod with a textured grip, a paracord lanyard and a metal striker',
'published',
NULL,
'<p>Starting a fire on a dry summer evening is easy. Starting one after a day of rain, with damp wood and gusting wind, is a different skill. The difference usually comes down to preparation: the right ignition tool, dry tinder you packed yourself, and a method that does not depend on luck. This guide covers how fire works, how three common ignition tools compare, and how to stay safe and responsible when you build one.</p>
<h2>Start with the fire triangle</h2>
<p>Every fire needs three things: heat, fuel and oxygen. Remove any one and the fire goes out. Wet weather attacks all three at once:</p>
<ul>
<li><strong>Heat.</strong> Water absorbs heat. Before damp tinder can catch, your spark or flame has to drive off the moisture, which takes far more energy than lighting dry material.</li>
<li><strong>Fuel.</strong> Wet wood smolders and smokes instead of burning. You need small, dry material to start, then larger pieces that can dry out as the fire grows.</li>
<li><strong>Oxygen.</strong> Wind can blow out a small flame, but a fire packed too tightly suffocates. Shelter the flame without smothering it.</li>
</ul>
<p>Keeping the triangle in mind helps you work out what is going wrong when a fire will not catch.</p>
<h2>Three ways to make the first flame</h2>
<p>There is no single best ignition tool. Each type has strengths, and many people carry two so that one can back up the other.</p>
<h3>Ferrocerium rod</h3>
<p>A ferrocerium rod, or ferro rod, throws hot sparks when you scrape it with a striker. It has no fuel to run out and no battery to drain, and it still sparks after it gets wet; just dry it on your clothing first. The <a href="/product/dusty-fire-tool">Dusty Fire Tool</a> pairs a long-lasting ferrocerium rod with an ergonomic grip and an integrated striker, and it is designed for reliable ignition in wet and windy conditions.</p>
<p>The trade-off is technique. Sparks need fine, dry tinder to catch, and you need practice to land them where you want. Instead of moving the striker toward your tinder, try holding the striker still and pulling the rod back. That keeps the tip close to the tinder and avoids scattering your tinder bundle.</p>
<h3>Solar-charged arc lighter</h3>
<p>An arc lighter makes a small electrical arc instead of a flame, so there is nothing for the wind to blow out. The <a href="/product/solar-arc-tool">Solar Arc Tool</a> uses an internal rechargeable arc system that can be topped up with its built-in solar panel, and it has a weather-resistant body and a single arc ignition button.</p>
<p>The arc needs to touch your tinder directly, so it works best with material that catches easily, such as dry paper, cotton or fine wood shavings. Because it runs on a rechargeable battery, charge it fully before a trip and give the solar panel time in the sun whenever you can.</p>
<h3>Windproof torch</h3>
<p>A jet-flame torch produces a strong, focused flame that holds up in wind and can dry and light damp material more easily than a spark can. The <a href="/product/nova-flame-device">Nova Flame Device</a> is a windproof torch with a safety lock, an angled burner and an impact-resistant housing, plus a carabiner clip for secure carry.</p>
<p>A torch is the most forgiving option when conditions are bad, but it depends on fuel. Check that it lights before you leave, and keep a non-fuel backup such as a ferro rod in your kit.</p>
<h2>Tinder is the real secret</h2>
<p>In wet weather, the tinder you bring matters more than the tool you use. Natural tinder may be soaked after rain, so carry your own in a waterproof bag or container. Good options include cotton balls, dryer lint, strips of paper and fine wood shavings.</p>
<p>Once you are in camp, look for dry fuel in sheltered places: dead twigs still attached to the lower branches of trees, and the dry inner wood of fallen branches that you split open. Collect more small material than you think you need. Most failed fires run out of kindling just as the flame is catching.</p>
<h2>A step-by-step method</h2>
<ol>
<li><strong>Check the rules.</strong> Confirm that fires are allowed where and when you are camping. Fire restrictions and burn bans change with conditions.</li>
<li><strong>Pick your spot.</strong> Use an existing fire ring if there is one. Choose a place sheltered from the wind and away from overhanging branches, tents and gear.</li>
<li><strong>Build a dry base.</strong> On wet ground, lay a platform of sticks so your tinder is not sitting in water.</li>
<li><strong>Prepare everything first.</strong> Sort tinder, kindling and larger fuel into piles within reach before you make a single spark.</li>
<li><strong>Light the tinder.</strong> Shield it with your body or pack, ignite it, and blow gently at the base if it needs air.</li>
<li><strong>Feed it slowly.</strong> Add the smallest kindling first and work up in size. Leave gaps so air can move through.</li>
</ol>
<h2>Leave no trace, and put it out completely</h2>
<p>Keep fires small and use only dead wood found on the ground. Do not cut live trees or branches. Never leave a fire unattended, and keep water nearby while it burns.</p>
<p>When you are done, drown the fire with water, stir the ashes and drown it again. Hold the back of your hand close to the ashes: if you feel any heat, it is not out. Repeat until everything is cool to the touch. Where fires are not allowed, cook on a stove and save the campfire for another trip.</p>
<h2>Building your fire kit</h2>
<p>A dependable wet-weather kit pairs two different ignition methods with dry tinder you packed yourself. A ferro rod like the <a href="/product/dusty-fire-tool">Dusty Fire Tool</a> makes a reliable base that never runs out of fuel. Add the <a href="/product/solar-arc-tool">Solar Arc Tool</a> for flameless ignition or the <a href="/product/nova-flame-device">Nova Flame Device</a> for a strong flame in wind. You will find more options in our <a href="/category/tools">Tools</a> collection. Practice at home first, so the first time you use your kit is not the night you really need it.</p>',
4,
(SELECT id FROM blog_categories WHERE slug = 'gear-guides'),
'Fire Starting in Wet Weather: Tools and Technique',
'How to start a fire in rain and wind: the fire triangle, ferro rods, arc lighters and windproof torches compared, dry tinder and Leave No Trace safety.',
1784044800,
1784044800,
1784044800
)
ON CONFLICT(slug) DO NOTHING;

INSERT INTO blog_posts (title, slug, author, excerpt, tags, cover_image_url, cover_image_alt, status, editor_json, html, reading_time, category_id, meta_title, meta_description, published_at, created_at, updated_at)
VALUES (
'Staying Reachable Off-Grid: Weather Alerts, Signal Devices and a Simple Comms Plan',
'staying-reachable-off-grid',
'Melt Party Gear Team',
'Out of cell range, staying reachable takes the right devices and a plan the people at home understand. Here is how to put both together.',
'["communication","safety","backcountry"]',
'/products/echo-sky-kit-2.png',
'Echo Sky Kit handheld radio with an antenna, a speaker grille and a carabiner on a paracord loop',
'published',
NULL,
'<p>Heading somewhere without cell service is part of the appeal of the backcountry. It also means the usual ways of checking the weather or asking for help may not be there when you need them. Staying reachable off-grid is less about one perfect gadget and more about combining the right devices with a simple plan that the people at home understand. This guide covers both.</p>
<h2>Know what you are planning for</h2>
<p>Before choosing gear, think about what could realistically happen on your trip:</p>
<ul>
<li><strong>The weather turns.</strong> A storm builds faster than forecast, a cold front arrives early, or heavy rain raises streams you need to cross.</li>
<li><strong>Your group gets separated.</strong> Someone takes a wrong turn, or the group splits up to scout a route.</li>
<li><strong>Plans change.</strong> An injury, a closed trail or slow progress means you will be out longer than expected, and someone at home needs to know.</li>
</ul>
<p>Each of these calls for a slightly different tool, which is why a layered approach works best.</p>
<h2>Weather alerts and radio</h2>
<p>When you lose cell service, you also lose weather apps and alerts. A radio that receives weather broadcasts fills that gap. The <a href="/product/echo-sky-kit">Echo Sky Kit</a> combines NOAA weather alerts with FM/AM tuning and a powerful built-in flashlight. It comes with a rugged carabiner and a durable antenna, and it is designed for backcountry treks, storms and power outages.</p>
<p>Because it covers both weather alerts and regular broadcasts, the same device is just as useful at home during a power outage as it is at camp. Get into the habit of checking the forecast each morning and evening on longer trips, and before you commit to an exposed section such as a ridgeline or a river crossing.</p>
<h2>Signaling and staying in touch</h2>
<p>Being able to signal your position and share basic information helps both within your group and with others nearby. The <a href="/product/signal-glade-tool">Signal Glade Tool</a> is a rugged, palm-sized unit built for communication, beaconing and emergency data relay. It has a bright display and textured grips, and it is designed for field teams that need connectivity and signal clarity in wilderness or off-grid areas.</p>
<p>For groups, agree before the trip on how you will use your devices: who carries what, how often you will check in with each other, and what you will do if someone does not respond.</p>
<h2>Gear for cold-weather trips</h2>
<p>Cold weather is hard on electronics. Batteries lose capacity, screens slow down, and gloves make small buttons difficult to use. The <a href="/product/frost-hollow-device">Frost Hollow Device</a> is built for extreme environments, with ruggedized housing, a thermal-safe grip and insulated electronics. It is designed for signaling, location tracking and activating cold-weather gear.</p>
<p>Whatever devices you carry in winter, keep them close to your body during the day, store them in your sleeping bag at night, and carry spare power where the device supports it.</p>
<h2>An important limit</h2>
<p><strong>The devices in this guide are not a substitute for a certified personal locator beacon or for calling emergency services.</strong> They can help you get weather information, signal your position and stay organized, but they are not certified emergency equipment. If you are heading into remote terrain where you may need rescue, research and carry a certified emergency device appropriate for where you are going, and know how to reach emergency services.</p>
<h2>Make a simple communication plan</h2>
<p>The best device in the world will not help if nobody knows you are overdue. A communication plan is free and takes ten minutes to set up.</p>
<h3>Write a trip plan</h3>
<p>Leave your plan with a trusted person who is not on the trip. Include:</p>
<ul>
<li>where you are going, your planned route and any alternatives;</li>
<li>where you will park, and a description of your vehicle;</li>
<li>who is in your group;</li>
<li>what gear you are carrying, including any communication devices;</li>
<li>when you expect to be back.</li>
</ul>
<h3>Set check-in times</h3>
<p>Agree on specific times when you will make contact, such as when you reach the trailhead and when you are back at the car. Be realistic and leave room for slow progress, so that a small delay does not cause unnecessary alarm.</p>
<h3>Agree on what happens if you miss one</h3>
<p>Decide in advance how long your contact should wait after a missed check-in, and exactly whom they should call. Write down the phone number for the relevant local authority, such as the ranger station or sheriff''s office for the area, so they are not searching for it under stress.</p>
<h3>Choose emergency contacts</h3>
<p>Every person in your group should have an emergency contact who knows the plan. Keep those contacts'' details written on paper as well as in your phone.</p>
<h2>Keep your devices ready</h2>
<ul>
<li><strong>Charge everything before you leave</strong>, and test each device at home so you know it works and how to use it.</li>
<li><strong>Carry spare power</strong> for devices that need it, and protect devices and batteries from water in a dry bag.</li>
<li><strong>Know the controls</strong> well enough to use them with cold hands, in the dark, or while stressed.</li>
<li><strong>Review your kit</strong> after each trip, and replace or recharge anything you used.</li>
</ul>
<h2>Building your off-grid kit</h2>
<p>Staying reachable comes down to three things: knowing the weather, being able to signal, and making sure someone knows your plan. A weather radio like the <a href="/product/echo-sky-kit">Echo Sky Kit</a>, a signaling unit like the <a href="/product/signal-glade-tool">Signal Glade Tool</a> and, for winter trips, the <a href="/product/frost-hollow-device">Frost Hollow Device</a> cover the gear side. You can explore more in our <a href="/category/tech">Tech</a> collection. The plan side costs nothing, so make one before every trip.</p>',
4,
(SELECT id FROM blog_categories WHERE slug = 'preparedness'),
'Staying Reachable Off-Grid: Devices and a Comms Plan',
'Stay reachable beyond cell service with a weather alert radio, signaling devices and cold-weather gear, plus a simple trip plan and check-in routine.',
1787068800,
1787068800,
1787068800
)
ON CONFLICT(slug) DO NOTHING;

INSERT INTO blog_posts (title, slug, author, excerpt, tags, cover_image_url, cover_image_alt, status, editor_json, html, reading_time, category_id, meta_title, meta_description, published_at, created_at, updated_at)
VALUES (
'Choosing Trail Lighting: Wrist Lights, Pocket Torches and High-Lumen Beams',
'choosing-trail-lighting',
'Melt Party Gear Team',
'Longer nights mean more time on the trail in the dark. Compare wrist-mounted lights, pocket flashlights and high-lumen beams, and learn how to plan your power.',
'["lighting","night","guides"]',
'/products/storm-orbit-device-8.png',
'Storm Orbit Device wrist-mounted flashlight with a round LED lens and a black strap',
'published',
NULL,
'<p>When the sun drops earlier in fall, more of every trip happens in the dark: the last mile back to the car, setting up camp, or a pre-dawn start. The right light makes those hours safer and much less frustrating. But no single light is perfect for every job. This guide compares three common forms, wrist-mounted lights, pocket flashlights and high-lumen beams, and explains how to choose and use them well.</p>
<h2>Start with the job, not the light</h2>
<p>Before comparing products, think about what you actually do after dark:</p>
<ul>
<li><strong>Close-up tasks</strong> such as pitching a tent, cooking or sorting gear, where you need both hands free.</li>
<li><strong>Moving on a trail</strong>, where you need to see your footing and the trail ahead.</li>
<li><strong>Searching and signaling</strong>, where you need to see far, find a trail marker or a landmark, or be seen by others.</li>
</ul>
<p>Most people need to cover more than one of these, which is why many carry two lights of different types.</p>
<h2>Wrist-mounted lights: hands-free work</h2>
<p>A light strapped to your wrist goes wherever your hands go, which makes it ideal for close work. When you reach into a pack, tie a knot or adjust a stove, the light points at the task without you having to hold it. The <a href="/product/storm-orbit-device">Storm Orbit Device</a> is a rugged, wrist-mounted flashlight built for hands-free illumination. It has an ultra-bright LED core, a water-resistant housing and a durable strap, and it is designed for night operations, search and rescue and utility work.</p>
<p>A wrist light is also useful on the trail, where it lights the ground in front of you as you walk. Because it moves with your arm, it suits tasks and short walks more than long stretches of steady trail.</p>
<h2>Pocket flashlights: always with you</h2>
<p>The best light is the one you have with you, and a small flashlight is easy to carry every day. It slips into a pocket or clips to a pack strap, ready for an unexpected late return or a power outage at home. The <a href="/product/stealth-brook-device">Stealth Brook Device</a> is a lightweight, pocket-sized tactical flashlight built for nighttime navigation. It has textured grip zones, a recessed power switch and a rugged clip.</p>
<p>A recessed switch helps prevent the light from turning on by accident in a pocket or pack, which is one of the most common ways to find a dead light at the moment you need it.</p>
<h2>High-lumen beams: seeing far</h2>
<p>Sometimes you need to see well beyond your feet: to pick out a trail marker across a clearing, scan a slope, find the next cairn or signal your position to someone at a distance. A focused, high-output beam does that job. The <a href="/product/prism-blaze-device">Prism Blaze Device</a> is a high-lumen tactical flashlight with a dual-tone rugged casing for a secure grip and a focused reflector cone that concentrates the beam. It is designed for search, signaling and field navigation.</p>
<p>A powerful beam is a tool for specific moments rather than constant use. Use it to look ahead, then switch back to a lower light for walking and camp tasks.</p>
<h2>Plan your power</h2>
<p>Lights fail most often because of power, not because of the light itself. A little planning avoids that:</p>
<ol>
<li><strong>Start full.</strong> Charge or replace batteries before every trip, and check each light at home.</li>
<li><strong>Carry a backup.</strong> Bring a second light, or spare batteries or a charging option for your main light, on any trip that might run into darkness.</li>
<li><strong>Use only the light you need.</strong> Bright settings drain batteries faster. Save maximum output for when you really need it.</li>
<li><strong>Keep batteries warm.</strong> Cold reduces battery capacity, so carry lights and spares in an inside pocket in cold weather.</li>
<li><strong>Prevent accidental activation.</strong> Lock or store lights so they cannot switch on inside your pack.</li>
</ol>
<h2>Light etiquette on the trail and in camp</h2>
<p>A light that helps you can easily dazzle someone else. A few simple habits make nights better for everyone:</p>
<ul>
<li><strong>Do not shine a light in people''s faces.</strong> Point it down when talking to someone, and warn others before switching to a bright beam.</li>
<li><strong>Protect night vision.</strong> Your eyes take time to adjust to darkness. Use the lowest practical setting in camp so you and others can still see the stars and your surroundings.</li>
<li><strong>Be considerate of other campers.</strong> Avoid sweeping bright beams across other tents, and keep lights low late at night.</li>
<li><strong>Respect wildlife.</strong> Bright lights can disturb animals. Use only as much light as you need.</li>
</ul>
<h2>Choosing your setup</h2>
<p>For most people, a practical lighting kit includes one hands-free light for tasks and short walks, and one compact flashlight that is always in a pocket or pack. If your trips include route-finding in the dark, or you want to be able to signal over distance, add a high-output beam.</p>
<ul>
<li>For hands-free work: the <a href="/product/storm-orbit-device">Storm Orbit Device</a>.</li>
<li>For everyday carry: the <a href="/product/stealth-brook-device">Stealth Brook Device</a>.</li>
<li>For seeing and signaling far: the <a href="/product/prism-blaze-device">Prism Blaze Device</a>.</li>
</ul>
<p>Whatever you choose, practice with your lights at home and on short evening walks before relying on them on a longer trip. You can browse more gear in our <a href="/category/outdoor-utility">Outdoor Utility</a> collection, and Floe, our shopping assistant, can help you compare options.</p>',
4,
(SELECT id FROM blog_categories WHERE slug = 'gear-guides'),
'Choosing Trail Lighting: Wrist, Pocket and Beam',
'Compare wrist-mounted lights, pocket flashlights and high-lumen beams for trail and camp, with tips on battery planning and light etiquette at night.',
1790092800,
1790092800,
1790092800
)
ON CONFLICT(slug) DO NOTHING;

INSERT INTO blog_posts (title, slug, author, excerpt, tags, cover_image_url, cover_image_alt, status, editor_json, html, reading_time, category_id, meta_title, meta_description, published_at, created_at, updated_at)
VALUES (
'Packing a 72-Hour Kit You''ll Actually Keep Ready',
'packing-a-72-hour-kit',
'Melt Party Gear Team',
'A 72-hour kit only helps if it is packed and current. Here is what to include, how to organize it, and a simple routine that keeps it ready.',
'["preparedness","safety","guides"]',
'/products/rapid-wave-kit-6.png',
'Rapid Wave Kit olive-green emergency pouch with a carry handle, a zipper and a carabiner clip',
'published',
NULL,
'<p>A 72-hour kit, sometimes called a go bag, holds what you would need to get through about three days on your own: after a storm knocks out power, during an evacuation, or when roads close and help is slow to arrive. Lots of people start one. Far fewer keep it packed and up to date. This guide covers what to put in a kit, how to organize it, and how to keep it ready without making it a chore.</p>
<h2>Start with the container</h2>
<p>The container decides how easy your kit is to grab, carry and keep organized. Many people use two levels: a main bag for the bulk of the kit and smaller pouches inside it, grouped by job.</p>
<ul>
<li><strong>The main bag.</strong> The <a href="/product/coastal-track-pack">Coastal Track Pack</a> has a roll-top closure that protects contents from the elements, a large capacity, side mesh pockets and front MOLLE webbing. Being able to seal the bag matters if you may have to leave in rain or store the kit somewhere damp.</li>
<li><strong>Pouches for small items.</strong> The <a href="/product/rapid-wave-kit">Rapid Wave Kit</a> is an emergency essentials pouch with a rugged shell, internal compartments and a quick-clip carabiner, designed for organizing quick-access tools, signaling gear or hydration tablets.</li>
</ul>
<p>Grouping items in labeled pouches means you can find what you need quickly, and you can see at a glance when something is missing.</p>
<h2>What to pack</h2>
<p>Every household is different, but most kits cover the same core categories.</p>
<h3>Water</h3>
<p>Water is the most important item and the heaviest. Follow the guidance of your local emergency management agency for how much to store per person. Add a way to treat water, such as a filter or purification tablets, so you are not limited to what you can carry.</p>
<h3>Food</h3>
<p>Choose food that does not need refrigeration or much preparation, and that you will actually eat. The <a href="/product/field-ration-resupply">Field Ration Resupply</a> box includes twelve shelf-stable entrées, six high-calorie snack packs, flameless heater sleeves and a folding spork, packed in a crush-resistant carton. Flameless heaters mean a hot meal is possible without a stove or open flame. If you prefer a regular restock, see the product page for delivery options.</p>
<h3>Light</h3>
<p>Power outages are one of the most common reasons to open a kit. Pack at least one reliable flashlight per person, with spare batteries or a way to recharge it. A hands-free light makes tasks much easier in the dark.</p>
<h3>Communication and information</h3>
<p>When the power is out, a radio that receives weather alerts and local broadcasts can be your main source of information. Include a way to charge your phone, and a written list of important phone numbers in case your phone is not available.</p>
<h3>Tools</h3>
<p>A compact multi-tool handles many small jobs, from opening packaging to adjusting gear. The <a href="/product/twin-dune-tool">Twin Dune Tool</a> combines a dual wrench head with a prying edge and a hex slot, and it is wrapped in durable paracord for extra grip and emergency use. Add duct tape, a fire starter and a whistle.</p>
<h3>First aid and medication</h3>
<p>Pack a first aid kit and know how to use what is in it. Include a supply of any prescription medications your household relies on, plus copies of prescriptions, glasses or contact lenses, and other personal medical items.</p>
<h3>Documents, cash and personal items</h3>
<ul>
<li>copies of important documents such as identification and insurance, in a waterproof bag;</li>
<li>some cash in small bills, in case card payments are unavailable;</li>
<li>a change of clothes, sturdy shoes and a warm layer for each person;</li>
<li>basic hygiene items;</li>
<li>items for children, older relatives and pets.</li>
</ul>
<h2>Make it fit your household</h2>
<p>A generic list is a starting point, not a finished kit. Think about who is in your household and where you live:</p>
<ul>
<li><strong>Climate.</strong> Add warm layers and blankets for cold regions, and extra water and sun protection for hot ones.</li>
<li><strong>Likely events.</strong> Think about the hazards most common where you live, such as storms, wildfires, floods or earthquakes, and adjust the kit accordingly.</li>
<li><strong>Mobility.</strong> If you may have to leave on foot, keep the main bag light enough to carry comfortably. Heavier supplies can stay in a home kit for sheltering in place.</li>
<li><strong>Vehicle.</strong> Consider a smaller second kit in the car.</li>
</ul>
<h2>Keep it ready: rotate and check</h2>
<p>The hardest part of a 72-hour kit is not packing it. It is keeping it useful. Food expires, batteries drain, medications change, and children outgrow clothes. A simple routine keeps the kit ready:</p>
<ol>
<li><strong>Put it on the calendar.</strong> Pick two dates a year, such as when the clocks change, and review the kit on those days.</li>
<li><strong>Check dates.</strong> Look at expiry dates on food, water, medications and batteries. Eat or use items that are close to expiring, and replace them.</li>
<li><strong>Test your gear.</strong> Switch on lights and radios, and charge anything rechargeable.</li>
<li><strong>Update for changes.</strong> Adjust clothing sizes, medications, documents and contact lists as your household changes.</li>
<li><strong>Write it down.</strong> Keep a short contents list with dates inside the bag, so the next check takes minutes.</li>
</ol>
<p>Rotating food into your regular meals means nothing goes to waste, and it keeps the kit fresh without extra spending.</p>
<h2>Store it where you can grab it</h2>
<p>Keep the kit somewhere easy to reach on the way out: near an exit, in a hall closet or by the garage door. Make sure everyone in the household knows where it is and what is inside. A kit that is buried at the back of a closet is a kit that gets left behind.</p>
<h2>Building your kit</h2>
<p>Start with a roll-top bag like the <a href="/product/coastal-track-pack">Coastal Track Pack</a>, organize small items in pouches such as the <a href="/product/rapid-wave-kit">Rapid Wave Kit</a>, and stock up on shelf-stable food like the <a href="/product/field-ration-resupply">Field Ration Resupply</a>. Add a dependable multi-tool such as the <a href="/product/twin-dune-tool">Twin Dune Tool</a>, then fill in the rest from the list above. You can find more in our <a href="/category/provisions">Provisions</a> and <a href="/category/camping">Camping</a> collections. Most importantly, set a reminder to check your kit, so it is ready on the day you need it.</p>',
4,
(SELECT id FROM blog_categories WHERE slug = 'preparedness'),
'Packing a 72-Hour Kit You''ll Actually Keep Ready',
'What to pack in a 72-hour emergency kit, how to organize it in pouches, and a twice-a-year rotation routine that keeps food, batteries and gear ready.',
1793116800,
1793116800,
1793116800
)
ON CONFLICT(slug) DO NOTHING;
