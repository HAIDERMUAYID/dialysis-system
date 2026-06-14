# مهارات تصميم Claude / Cursor

مراجع لتحسين واجهات المشروع عند العمل مع Agent في Cursor.

## 1) Awesome Claude Design

مجموعة ملفات `DESIGN.md` جاهزة لبناء design system من inspiration marks معروفة.

- **Repo:** https://github.com/VoltAgent/awesome-claude-design
- **الفهرس:** https://getdesign.md/
- **Claude Design:** https://claude.ai/design
- **Skill في المشروع:** `.cursor/skills/awesome-claude-design/`

## 2) Impeccable Design

إرشادات تصميم + 23 أمر (`/impeccable audit`, `polish`, `critique`, …) + 41 قاعدة كشف anti-patterns.

- **Repo:** https://github.com/pbakaus/impeccable
- **الموقع:** https://impeccable.style/
- **Skill في المشروع:** `.cursor/skills/impeccable/`
- **البداية:** `/impeccable init` داخل المحادثة بعد تفعيل Agent Skills

**إعادة التثبيت:**

```bash
npx impeccable skills install --providers=cursor
```

## 3) Taste Skill

Anti-slop frontend — typography، motion، spacing، dials للتنويع.

- **Repo:** https://github.com/Leonxlnx/taste-skill
- **الموقع:** https://www.tasteskill.dev/
- **Skill في المشروع:** `.cursor/skills/design-taste-frontend/`

**إعادة التثبيت:**

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend" -y
cp -R .agents/skills/design-taste-frontend .cursor/skills/design-taste-frontend
```

## تفعيل في Cursor

1. **Settings → Beta** — Nightly (إن لزم)
2. **Settings → Rules** — تفعيل **Agent Skills**
3. أعد تحميل النافذة بعد التثبيت

## ترتيب مقترح للمشروع

1. **`/impeccable init`** — تم: راجع `PRODUCT.md` و `DESIGN.md` في جذر المشروع
2. Awesome Claude Design — inspiration إذا احتجت قالب `DESIGN.md` إضافي
3. Taste Skill — عند بناء landing أو polish بصري
4. `/impeccable audit` أو `/impeccable polish` قبل merge واجهات كبيرة
