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

  /* ---------- عدّاد رمضان (محسوب من تقويم أم القرى) ---------- */
  const hijriNumFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
    day: 'numeric', month: 'numeric', year: 'numeric', timeZone: TZ
  });
  const DAY_MS = 86400000;

  function hijriParts(date) {
    const parts = hijriNumFmt.formatToParts(date);
    const get = function (type) {
      const p = parts.find(function (x) { return x.type === type; });
      return parseInt(p.value, 10);
    };
    return { d: get('day'), m: get('month'), y: get('year') };
  }

  /** يبحث عن أول 1 رمضان قادم — نمشي 20 يوماً ثم نضبط بيوم واحد */
  function findRamadanStart() {
    const now = new Date();
    let t = now.getTime();
    let h = hijriParts(new Date(t));
    // رمضان جارٍ الآن
    if (h.m === 9) return { active: true, year: h.y, day: h.d };
    const limit = now.getTime() + 430 * DAY_MS;
    while (t < limit) {
      t += 20 * DAY_MS;
      h = hijriParts(new Date(t));
      if (h.m === 9) break;
      if (h.m > 9) { // تجاوزنا رمضان — نرجع ونمشي يوماً بيوم
        t -= 20 * DAY_MS;
        while (hijriParts(new Date(t)).m !== 9) t += DAY_MS;
        break;
      }
    }
    // نضبط على اليوم الأول من الشهر
    while (hijriParts(new Date(t)).d !== 1) t -= DAY_MS;
    return { time: t, active: false, year: hijriParts(new Date(t)).y };
  }

  let ramadanInfo = null;

  function updateRamadan() {
    const el = $('ramadan-chip');
    const tvEl = $('tv-ramadan');
    if (!el && !tvEl) return;
    const now = new Date();
    if (!ramadanInfo) ramadanInfo = findRamadanStart();
    if (ramadanInfo.active) {
      const text = '🌙 رمضان مبارك — اليوم ' + ramadanInfo.day + ' من رمضان ' + ramadanInfo.year + ' هـ';
      if (el) { el.textContent = text; el.hidden = false; }
      if (tvEl) tvEl.textContent = text;
      return;
    }
    // إذا مضى موعد البداية المخزّن نعيد الحساب (سنة جديدة)
    if (ramadanInfo.time && ramadanInfo.time < now.getTime() - DAY_MS) {
      ramadanInfo = findRamadanStart();
      if (ramadanInfo.active) {
        const text = '🌙 رمضان مبارك — اليوم ' + ramadanInfo.day + ' من رمضان ' + ramadanInfo.year + ' هـ';
        if (el) { el.textContent = text; el.hidden = false; }
        if (tvEl) tvEl.textContent = text;
        return;
      }
    }
    const days = Math.ceil((ramadanInfo.time - now.getTime()) / DAY_MS);
    const startStr = new Intl.DateTimeFormat('ar-DZ', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ
    }).format(new Date(ramadanInfo.time));
    const text = '🌙 تبقى ' + days + ' يوماً على رمضان ' + ramadanInfo.year + ' هـ — بإذن الله ' + startStr;
    if (el) { el.textContent = text; el.hidden = false; }
    if (tvEl) tvEl.textContent = text;
  }

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
    // المالكي والشافعي: قياس ظل الشيء (Shafi) — الحنفي: ظل مثلهين
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

  /* ---------- وضع التلفاز ---------- */
  const TV_MODE = new URLSearchParams(location.search).has('tv');
  const timeFmtSec = new Intl.DateTimeFormat('fr-DZ', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: TZ
  });

  function isTv() { return document.body.classList.contains('tv-mode'); }

  let tvActivated = false;
  let soundRowHome = null;

  function activateTv() {
    if (tvActivated) return;
    tvActivated = true;
    document.body.classList.add('tv-mode');
    buildTvTimes();
    updateTvTimes();
    // نقل زر تفعيل الأذان ليظهر في وضع التلفاز
    const soundRow = document.querySelector('.sound-row');
    if (soundRow && !isAdhanUnlocked()) {
      soundRowHome = soundRow.parentNode;
      soundRow.classList.add('tv-fixed');
      document.body.appendChild(soundRow);
    }
    refreshTvFsButton();
  }

  function deactivateTv() {
    document.body.classList.remove('tv-mode');
    if (soundRowHome) {
      const soundRow = document.querySelector('.sound-row');
      if (soundRow) {
        soundRow.classList.remove('tv-fixed');
        soundRowHome.appendChild(soundRow);
      }
      soundRowHome = null;
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
    }
    refreshTvFsButton();
  }

  function refreshTvFsButton() {
    const btn = $('tv-fs');
    if (!btn) return;
    // يظهر زر ملء الشاشة فقط عندما نكون في وضع التلفاز وليس في ملء الشاشة
    btn.hidden = !(isTv() && !document.fullscreenElement);
  }

  function buildTvTimes() {
    const wrap = $('tv-times');
    if (!wrap) return;
    wrap.innerHTML = '';
    PRAYER_KEYS.forEach(function (key) {
      const div = document.createElement('div');
      div.className = 'tv-prayer';
      div.id = 'tv-card-' + key;
      div.innerHTML =
        '<span class="tv-prayer-name">' + SITE_CONFIG.prayerNames[key] + '</span>' +
        '<span class="tv-prayer-time" id="tv-time-' + key + '">—</span>';
      wrap.appendChild(div);
    });
  }

  function updateTvTimes() {
    if (!isTv() || !todayTimes) return;
    const isFriday = weekdayFmt.format(new Date()) === 'الجمعة';
    PRAYER_KEYS.forEach(function (key) {
      const el = $('tv-time-' + key);
      if (!el) return;
      if (key === 'dhuhr' && isFriday && SITE_CONFIG.jumua) {
        el.textContent = SITE_CONFIG.jumua.time + ' (جمعة)';
      } else {
        el.textContent = fmt(todayTimes[key]);
      }
    });
    $('tv-jumua').textContent = '🕌 ' + SITE_CONFIG.jumua.note;
  }

  function updateTvLive(now, next, diff) {
    if (!isTv()) return;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    $('tv-clock').textContent = timeFmtSec.format(now);
    $('tv-next-name').textContent = next.name + (next.isTomorrow ? ' (غداً)' : '');
    $('tv-next-time').textContent = fmt(next.time);
    $('tv-countdown').textContent =
      String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function renderHeader() {
    const now = new Date();
    $('date-hijri').textContent = hijriFmt.format(now) + ' هـ';
    $('date-gregorian').textContent = gregFmt.format(now);
    const tvH = $('tv-date-hijri');
    if (tvH) {
      tvH.textContent = hijriFmt.format(now) + ' هـ';
      $('tv-date-greg').textContent = gregFmt.format(now);
    }
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

    // أوقات السنن: منتصف الليل، الثلث الأخير، ووقت القيام
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
      '<div class="sunnah-chip"><span>الثلث الأخير (قيام)</span><strong>' + fmt(sunnah.lastThirdOfTheNight) + '</strong></div>' +
      '<div class="sunnah-chip qiyam-chip"><span>⏳ وقت القيام — الأفضل</span><strong>من ' + fmt(sunnah.lastThirdOfTheNight) + ' حتى الفجر ' + fmt(todayTimes.fajr) + '</strong></div>';
    updateTvTimes();
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
    updateTvLive(now, next, diff);
    const headerClock = $('header-clock');
    if (headerClock) headerClock.textContent = timeFmtSec.format(now);
    updateRamadan();
    checkAdhan(now);
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
    // بطاقات التلفاز
    document.querySelectorAll('.tv-prayer').forEach(function (c) {
      c.classList.remove('current', 'next-flash');
    });
    const tvCard = $('tv-card-' + next.key);
    if (tvCard) {
      tvCard.classList.add('next-flash');
      const order2 = ['isha', 'maghrib', 'asr', 'dhuhr', 'sunrise', 'fajr'];
      for (const key of order2) {
        if (todayTimes[key] <= now) {
          const el = $('tv-card-' + key);
          if (el) el.classList.add('current');
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

  /* ---------- صوت الأذان ---------- */
  const ADHAN_UNLOCKED = 'adhan-unlocked';
  const ADHAN_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  let adhanAudio = null;
  let lastFiredInstance = '';

  function isAdhanUnlocked() {
    try { return localStorage.getItem(ADHAN_UNLOCKED) === '1'; }
    catch (e) { return false; }
  }

  function refreshSoundUi() {
    const btn = $('enable-sound');
    const hint = $('sound-hint');
    if (isAdhanUnlocked()) {
      btn.hidden = true;
      hint.textContent = '🔊 الأذان مفعّل — سيُسمع عند دخول كل صلاة';
    } else {
      btn.hidden = false;
      hint.textContent = 'اضغط الزر مرة واحدة لتسمع الأذان عند كل صلاة';
    }
  }

  function initAdhanAudio() {
    if (adhanAudio || !(window.Audio || window.webkitAudio)) return;
    adhanAudio = new Audio(SITE_CONFIG.adhan.file);
    adhanAudio.volume = typeof SITE_CONFIG.adhan.volume === 'number' ? SITE_CONFIG.adhan.volume : 0.9;
    adhanAudio.addEventListener('ended', hideAdhanBanner);
    adhanAudio.addEventListener('error', hideAdhanBanner);
  }

  function unlockAdhan() {
    initAdhanAudio();
    if (!adhanAudio) { showToast('المتصفح لا يدعم الصوت'); return; }
    const p = adhanAudio.play();
    if (p && p.then) {
      p.then(function () {
        // فُتح باب الصوت — أوقف فوراً وأخزّن التفعيل
        adhanAudio.pause();
        adhanAudio.currentTime = 0;
        try { localStorage.setItem(ADHAN_UNLOCKED, '1'); } catch (e) {}
        refreshSoundUi();
        showToast('✅ تم تفعيل صوت الأذان');
      }, function () {
        showToast('تعذّر تفعيل الصوت — أعد المحاولة');
      });
    }
  }

  /** أوقات اليوم بعد استبدال الظهر بوقت الجمعة يوم الجمعة */
  function effectivePrayerTimes(now) {
    const t = Object.assign({}, todayTimes);
    if (weekdayFmt.format(now) === 'الجمعة' && SITE_CONFIG.jumua) {
      const parts = SITE_CONFIG.jumua.time.split(':');
      t.dhuhr = atTime(now, parseInt(parts[0], 10), parseInt(parts[1], 10));
    }
    return t;
  }

  function checkAdhan(now) {
    if (!isAdhanUnlocked() || !todayTimes) return;
    initAdhanAudio();
    if (!adhanAudio) return;
    checkTakbirReminder(now);
    const eff = effectivePrayerTimes(now);
    for (const key of ADHAN_PRAYERS) {
      const diff = now - eff[key];
      const instance = dateKey(now) + '|' + key;
      if (diff >= 0 && diff < 30000 && lastFiredInstance !== instance) {
        lastFiredInstance = instance;
        fireAdhan(SITE_CONFIG.prayerNames[key]);
        return;
      }
    }
  }

  function fireAdhan(prayerName) {
    showAdhanBanner('🕌 حان الآن وقت صلاة ' + prayerName + ' — الله أكبر');
    const p = adhanAudio.play();
    if (p && p.catch) {
      p.catch(function () {
        // السياسة منعت الصوت — اطلب التفعيل من جديد
        try { localStorage.removeItem(ADHAN_UNLOCKED); } catch (e) {}
        refreshSoundUi();
      });
    }
  }

  /* ---------- تنبيه "الله أكبر" قبل الأذان ---------- */
  let lastRemindedInstance = '';

  function speakTakbir() {
    if (!window.speechSynthesis) return false;
    try {
      const u = new SpeechSynthesisUtterance('الله أكبر');
      u.lang = 'ar';
      u.rate = 0.8;
      u.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }

  function checkTakbirReminder(now) {
    if (!SITE_CONFIG.takbir || !SITE_CONFIG.takbir.enabled) return;
    if (!isAdhanUnlocked() || !todayTimes) return;
    const eff = effectivePrayerTimes(now);
    const beforeMs = (SITE_CONFIG.takbir.beforeMinutes || 5) * 60000;
    for (const key of ADHAN_PRAYERS) {
      const diff = now - (new Date(eff[key].getTime() - beforeMs));
      const instance = dateKey(now) + '|remind|' + key;
      if (diff >= 0 && diff < 30000 && lastRemindedInstance !== instance) {
        lastRemindedInstance = instance;
        const spoken = speakTakbir();
        showAdhanBanner('⏳ بعد ' + SITE_CONFIG.takbir.beforeMinutes + ' دقائق: صلاة ' +
          SITE_CONFIG.prayerNames[key] + ' — كن مستعداً' + (spoken ? ' (الله أكبر)' : ''));
        // أخف الشريط بعد 40 ثانية إن لم يصله الأذان
        setTimeout(function () {
          if ($('adhan-banner').hidden === false && adhanAudio && adhanAudio.paused) {
            hideAdhanBanner();
          }
        }, 40000);
        return;
      }
    }
  }

  function showAdhanBanner(text) {
    $('adhan-banner-text').textContent = text;
    $('adhan-banner').hidden = false;
  }

  function hideAdhanBanner() {
    $('adhan-banner').hidden = true;
  }

  /* ---------- الأذكار ---------- */
  const ADHKAR_LABELS = {
    morning: 'أذكار الصباح',
    evening: 'أذكار المساء',
    sleep: 'أذكار النوم',
    afterprayer: 'أذكار بعد الصلاة'
  };
  let adhkarCounts = {};
  let adhkarCurrent = 'morning';

  function renderAdhkarPanel(key) {
    adhkarCurrent = key;
    const panel = $('adhkar-panel');
    panel.innerHTML = '';
    document.querySelectorAll('#adhkar-tabs .tab-btn').forEach(function (b) {
      const sel = b.getAttribute('data-panel') === key;
      b.setAttribute('aria-selected', sel ? 'true' : 'false');
      b.classList.toggle('active', sel);
    });
    ADHKAR[key].forEach(function (d, i) {
      const id = key + '-' + i;
      const cnt = Math.min(adhkarCounts[id] || 0, d.count);
      const done = cnt >= d.count;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'dhikr-card' + (done ? ' done' : '');
      card.innerHTML =
        '<p class="dhikr-text">' + d.text + '</p>' +
        (d.note ? '<span class="dhikr-note">' + d.note + '</span>' : '') +
        '<span class="dhikr-badge">' + (done ? '✓ ' : '') + cnt + ' / ' + d.count + '</span>';
      card.addEventListener('click', function () {
        const cur = adhkarCounts[id] || 0;
        if (cur < d.count) {
          adhkarCounts[id] = cur + 1;
          renderAdhkarPanel(key);
        }
      });
      panel.appendChild(card);
    });
  }

  /* ---------- الاستغفار الدائم ---------- */
  let istighfarIdx = 0;

  function rotateIstighfar() {
    istighfarIdx = (istighfarIdx + 1) % ISTIGHFAR.length;
    $('istighfar-text').textContent = ISTIGHFAR[istighfarIdx];
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

  $('enable-sound').addEventListener('click', unlockAdhan);
  $('stop-adhan').addEventListener('click', function () {
    if (adhanAudio) {
      adhanAudio.pause();
      adhanAudio.currentTime = 0;
    }
    hideAdhanBanner();
  });

  document.querySelectorAll('#adhkar-tabs .tab-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      renderAdhkarPanel(b.getAttribute('data-panel'));
    });
  });

  $('tv-btn').addEventListener('click', function () {
    activateTv();
    // ملء الشاشة: يظهر الموقع وحده — يتطلب إيماءة من المستخدم
    const el = document.documentElement;
    if (el.requestFullscreen) {
      const p = el.requestFullscreen();
      if (p && p.catch) p.catch(function () {});
    }
    refreshTvFsButton();
  });

  $('tv-fs').addEventListener('click', function () {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      const p = el.requestFullscreen();
      if (p && p.catch) p.catch(function () {});
    }
  });

  $('tv-exit').addEventListener('click', deactivateTv);

  document.addEventListener('fullscreenchange', refreshTvFsButton);

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
    refreshSoundUi();
    renderAdhkarPanel('morning');
    rotateIstighfar();
    setInterval(rotateIstighfar, 6000);
    renderCalendar();
    setInterval(updateCountdown, 1000);
    if (TV_MODE) {
      activateTv();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
