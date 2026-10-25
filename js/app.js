/* =========================================================
 * مواقيت الصلاة — مسجد السنة، المحمدية، ولاية معسكر
 * الحساب محلي داخل المتصفح بمكتبة adhan — لا يحتاج خادماً
 * ========================================================= */
(function () {
  'use strict';

  /* ---------- أدوات مساعدة ---------- */
  const TZ = SITE_CONFIG.timeZone;

  const timeFmt = new Intl.DateTimeFormat('fr-DZ', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ
  });
  const gregFmt = new Intl.DateTimeFormat('ar-DZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ
  });
  const hijriFmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ
  });
  const monthFmt = new Intl.DateTimeFormat('ar-DZ', {
    month: 'long', year: 'numeric', timeZone: TZ
  });
  const weekdayFmt = new Intl.DateTimeFormat('ar-DZ', { weekday: 'long', timeZone: TZ });
  const dayNumFmt = new Intl.DateTimeFormat('ar-DZ', { day: 'numeric', month: 'numeric', timeZone: TZ });

  /** يرجع "HH:MM" في توقيت المسجد من كائن تاريخ */
  function fmt(date) {
    return timeFmt.format(date);
  }

  /** يبني كائن Date عند ساعة/دقيقة محددة في التوقيت المحلي للمسجد */
  function atTime(base, hours, minutes) {
    const s = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: TZ
    }).formatToParts(base).reduce(function (acc, p) {
      acc[p.type] = p.value;
      return acc;
    }, {});
    // Africa/Algiers has no DST since 1981 — offset is fixed +01:00
    return new Date(s.year + '-' + s.month + '-' + s.day + 'T' +
      String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':00+01:00');
  }

  /** مواقيت يوم معيّن كائن {fajr, sunrise, dhuhr, asr, maghrib, isha} */
  function timesFor(date) {
    const coords = new adhan.Coordinates(SITE_CONFIG.latitude, SITE_CONFIG.longitude);
    const params = adhan.CalculationMethod[SITE_CONFIG.calculationMethod]();
    params.madhab = SITE_CONFIG.madhab === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
    const t = new adhan.PrayerTimes(coords, date, params);
    return {
      fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr,
      asr: t.asr, maghrib: t.maghrib, isha: t.isha
    };
  }

  const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

  /* ---------- عناصر الصفحة ---------- */
  const $ = function (id) { return document.getElementById(id); };

  function renderHeader() {
    const now = new Date();
    $('date-hijri').textContent = hijriFmt.format(now) + ' هـ';
    $('date-gregorian').textContent = gregFmt.format(now);
  }

  /* ---------- مواقيت اليوم ---------- */
  let todayTimes = null;
  let todayDateKey = '';

  function dateKey(d) {
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }

  function renderToday() {
    const now = new Date();
    todayDateKey = dateKey(now);
    todayTimes = timesFor(now);

    const grid = $('times-grid');
    grid.innerHTML = '';
    PRAYER_KEYS.forEach(function (key) {
      const card = document.createElement('div');
      card.className = 'prayer-card';
      card.id = 'card-' + key;
      card.innerHTML =
        '<span class="prayer-icon" aria-hidden="true">' + SITE_CONFIG.prayerIcons[key] + '</span>' +
        '<span class="prayer-name">' + SITE_CONFIG.prayerNames[key] + '</span>' +
        '<div class="prayer-time">' + fmt(todayTimes[key]) + '</div>';
      grid.appendChild(card);
    });

    // وقت الجمعة: يوم الجمعة فقط، يعرض مكان الظهر
    const isFriday = weekdayFmt.format(now) === 'الجمعة';
    const jumuaNote = $('jumua-note');
    if (isFriday && SITE_CONFIG.jumua) {
      const dhuhrCard = $('card-dhuhr');
      dhuhrCard.querySelector('.prayer-time').textContent = SITE_CONFIG.jumua.time;
      jumuaNote.textContent = '🕌 ' + SITE_CONFIG.jumua.note;
    } else {
      jumuaNote.textContent = '🕌 ' + SITE_CONFIG.jumua.note;
    }

    $('jumua-about').textContent =
      'جمعة المسجد: ' + SITE_CONFIG.jumua.time + ' م — ' + SITE_CONFIG.jumua.note.replace('صلاة الجمعة في مسجد السنة: ', '') + '.';

    // أوقات السنن: ثلثا الليل وآخره
    const sunnah = new adhan.SunnahTimes(new adhan.PrayerTimes(
      new adhan.Coordinates(SITE_CONFIG.latitude, SITE_CONFIG.longitude),
      now,
      (function () {
        const p = adhan.CalculationMethod[SITE_CONFIG.calculationMethod]();
        p.madhab = adhan.Madhab.Shafi;
        return p;
      })()
    ));
    $('sunnah-row').innerHTML =
      '<div class="sunnah-chip"><span>منتصف الليل</span><strong>' + fmt(sunnah.middleOfTheNight) + '</strong></div>' +
      '<div class="sunnah-chip"><span>الثلث الأخير (قيام)</span><strong>' + fmt(sunnah.lastThirdOfTheNight) + '</strong></div>';
  }

  /* ---------- الصلاة القادمة + العدّاد ---------- */
  function nextPrayerInfo(now) {
    const order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    for (const key of order) {
      if (todayTimes[key] > now) {
        let time = todayTimes[key];
        let name = SITE_CONFIG.prayerNames[key];
        // الجمعة: وقت الظهر يوم الجمعة يصبح وقت الجمعة
        if (key === 'dhuhr' && weekdayFmt.format(now) === 'الجمعة') {
          name = 'الجمعة';
          time = atTime(now,
            parseInt(SITE_CONFIG.jumua.time.split(':')[0], 10),
            parseInt(SITE_CONFIG.jumua.time.split(':')[1], 10));
          if (time <= now) { time = todayTimes[key]; }
        }
        return { key: key, name: name, time: time };
      }
    }
    // بعد العشاء: فجر الغد
    const tomorrow = new Date(now.getTime() + 86400000);
    const t = timesFor(tomorrow);
    return { key: 'fajr', name: SITE_CONFIG.prayerNames.fajr, time: t.fajr, isTomorrow: true };
  }

  function updateCountdown() {
    const now = new Date();
    // تغيّر اليوم؟ أعد رسم كل شيء
    if (dateKey(now) !== todayDateKey) {
      renderHeader();
      renderToday();
      markNext();
      return;
    }
    const next = nextPrayerInfo(now);
    let diff = next.time - now;
    if (diff < 0) diff = 0;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    $('next-prayer-name').textContent = next.name + (next.isTomorrow ? ' (غداً)' : '');
    $('next-prayer-time').textContent = fmt(next.time);
    $('countdown').textContent =
      String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function markNext() {
    const now = new Date();
    const next = nextPrayerInfo(now);
    document.querySelectorAll('.prayer-card').forEach(function (c) {
      c.classList.remove('current', 'next-flash');
    });
    const card = $('card-' + next.key);
    if (card) {
      card.classList.add('next-flash');
      // الصلاة "الحالية": آخر صلاة مضت
      const order = ['isha', 'maghrib', 'asr', 'dhuhr', 'sunrise', 'fajr'];
      for (const key of order) {
        if (todayTimes[key] <= now) {
          $('card-' + key).classList.add('current');
          break;
        }
      }
    }
  }

  /* ---------- جدول الشهر ---------- */
  let viewMonth = new Date();

  function renderCalendar() {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    const nowKey = dateKey(now);

    $('month-label').textContent = monthFmt.format(viewMonth);

    const head = $('table-head');
    head.innerHTML = '<tr><th scope="col">التاريخ</th><th scope="col">اليوم</th>' +
      ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map(function (k) {
        return '<th scope="col">' + SITE_CONFIG.prayerNames[k] + '</th>';
      }).join('') + '</tr>';

    const body = $('table-body');
    body.innerHTML = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d, 12);
      const t = timesFor(date);
      const tr = document.createElement('tr');
      if (dateKey(date) === nowKey) tr.className = 'today';
      tr.innerHTML = '<td class="day-col">' + dayNumFmt.format(date) + '</td>' +
        '<td>' + weekdayFmt.format(date) + '</td>' +
        PRAYER_KEYS.map(function (k) {
          // يوم الجمعة: الظهر يظهر بلون مميز (وقت الجمعة في config)
          let cell = fmt(t[k]);
          if (k === 'dhuhr' && weekdayFmt.format(date) === 'الجمعة') {
            cell = '<strong>' + SITE_CONFIG.jumua.time + '</strong>';
          }
          return '<td>' + cell + '</td>';
        }).join('');
      tr.setAttribute('data-date', date.toISOString());
      body.appendChild(tr);
    }
  }

  // نسخ أوقات صف عند الضغط عليه
  $('prayer-table').addEventListener('click', function (e) {
    const tr = e.target.closest('tr');
    if (!tr || !tr.hasAttribute('data-date')) return;
    const cells = Array.from(tr.cells).map(function (td) {
      return td.textContent.trim();
    });
    const text = cells.join(' — ');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        showToast('✅ تم نسخ أوقات اليوم');
      }, function () {
        showToast('تعذّر النسخ');
      });
    }
  });

  let toastTimer = null;
  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* ---------- التنقل بين الأشهر ---------- */
  $('prev-month').addEventListener('click', function () {
    viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  $('next-month').addEventListener('click', function () {
    viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  /* ---------- الإقلاع ---------- */
  function init() {
    if (typeof adhan === 'undefined') {
      document.body.innerHTML =
        '<div style="text-align:center;padding:4rem 1rem;font-family:sans-serif;color:#faf7ef;background:#071c12;min-height:100vh">' +
        '<h1>تعذّر تحميل مكتبة الحساب</h1>' +
        '<p>تحقق من اتصال الإنترنت ثم أعد تحديث الصفحة.</p></div>';
      return;
    }
    renderHeader();
    renderToday();
    markNext();
    updateCountdown();
    renderCalendar();
    setInterval(updateCountdown, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
