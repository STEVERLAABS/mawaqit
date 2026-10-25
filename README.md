# 🕌 مواقيت الصلاة — مسجد السنة، المحمدية (معسكر)

> [!TIP]
> **🌐 الموقع مباشر الآن:** [https://steverlaabs.github.io/mawaqit-masjid-sunna/](https://steverlaabs.github.io/mawaqit-masjid-sunna/)

[![الموقع مباشر](https://img.shields.io/website?url=https%3A%2F%2Fsteverlaabs.github.io%2Fmawaqit-masjid-sunna%2F&label=%D8%A7%D9%84%D9%85%D9%88%D9%82%D8%B9&style=for-the-badge)](https://steverlaabs.github.io/mawaqit-masjid-sunna/)

موقع احترافي لعرض مواقيت الصلاة لمسجد السنة بمدينة المحمدية، ولاية معسكر، الجزائر.

✅ **يعمل بالكامل دون خادم** — حساب الأوقات يتم داخل متصفح الزائر بمكتبة [adhan](https://github.com/batoulapps/adhan-js) حسب إحداثيات المسجد، لذا يمكن استضافته مجاناً على **GitHub Pages** ويظل دقيقاً حتى دون إنترنت بعد أول زيارة.

## الميزات

- 🕐 مواقيت اليوم الستة + عدّاد تنازلي للصلاة القادمة
- 🌙 منتصف الليل والثلث الأخير (قيام الليل)
- 📅 جدول مواقيت الشهر كاملاً مع التنقل بين الأشهر ونسخ أي يوم بضغطة
- 🕌 توقيت الجمعة يظهر تلقائياً يوم الجمعة (12:45 م)
- 🔊 **أذان صوتي** عند دخول وقت كل صلاة (بعد تفعيله بضغطة واحدة)
- 📱 تصميم متجاوب يعمل على الهاتف والحاسوب، بالعربية RTL
- ♿ متوافق مع قارئات الشاشة ووضع الحركة المقلّصة

## الإعدادات

كل ما تحتاج تعديله في ملف واحد: [`js/config.js`](js/config.js)

| الإعداد | الوصف |
|---|---|
| `latitude` / `longitude` | إحداثيات المسجد (الافتراضي: من OpenStreetMap) |
| `jumua.time` | وقت صلاة الجمعة |
| `madhab` | مذهب العصر (`maliki` — قياس ظل شيء، أو `hanafi`) |
| `calculationMethod` | منهج الحساب (الافتراضي: رابطة العالم الإسلامي) |
| `adhan.file` / `adhan.volume` | ملف صوت الأذان ومستوى الصوت |

## التشغيل محلياً

```bash
# أي خادم ثابت، مثلاً:
npx serve .
# ثم افتح http://localhost:3000
```

## النشر على GitHub Pages

```bash
git init
git add .
git commit -m "مواقيت الصلاة — مسجد السنة المحمدية"
gh repo create mawaqit-masjid-sunna --public --source=. --push
gh api repos/{owner}/mawaqit-masjid-sunna/pages -X POST -f build_type=legacy -f source='{"branch":"main","path":"/"}'
```

أو من واجهة GitHub: **Settings → Pages → Source: Deploy from a branch → main / root**.

## معلومات تقنية

- **الإحداثيات**: 35.589562° شمالاً، 0.074046° شرقاً (Mosqué de la Sunna, Rue Pasteur — OpenStreetMap)
- **المنطقة الزمنية**: Africa/Algiers (غرينتش+1، بلا توقيت صيفي)
- **المنهج**: رابطة العالم الإسلامي، الأصرّ على القياس (شافعي)
- **التاريخ الهجري**: تقويم أم القرى عبر `Intl`

> ⚠️ الأوقات تقريبية للتذكير؛ اعتمد أذان المسجد الرسمي.
