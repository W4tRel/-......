/* ӨМҮР+ — общая логика: язык, доступность, хранилище, шапка/подвал, карточки */
(function () {
  "use strict";

  /* ---------- хранилище (всё только в браузере пользователя) ----------
     Общие ключи (язык, шрифт, контраст, список профилей, сессия) — на всё устройство.
     Остальное (прогресс, записи, результаты) хранится отдельно для каждого профиля. */
  var SHARED = { lang: 1, fs: 1, hc: 1, accounts: 1, session: 1 };
  var uid = null;
  function fullKey(k) { return "omyr." + ((SHARED[k] || !uid) ? "" : "u" + uid + ".") + k; }
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(fullKey(k)); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(fullKey(k), JSON.stringify(v)); } catch (e) {} },
    setUser: function (id) { uid = id; },
    /* удаляет данные текущего профиля (но не сам профиль и не общие настройки) */
    clearAll: function () {
      if (!uid) return;
      try {
        var prefix = "omyr.u" + uid + ".", keys = [];
        for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
        keys.filter(function (k) { return k && k.indexOf(prefix) === 0; })
          .forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) {}
    }
  };

  var OP = window.OP = { LS: LS, lang: LS.get("lang", "ru") === "ky" ? "ky" : "ru", page: null, user: null };

  /* ---------- демо-профили ----------
     ВНИМАНИЕ: это демонстрация. Профили лежат в браузере этого устройства, PIN хранится в виде
     простого хеша, и такая защита не настоящая. Для боевой версии нужен сервер. */
  function hashPin(id, pin) {
    var s = "omyr|" + id + "|" + pin, h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  /* номер хранится как 9 цифр без 0 и без +996 (555123456); ведущий 0 и 996 убираются сами */
  function normPhone(p) {
    var d = digits(p);
    if (d.length === 12 && d.indexOf("996") === 0) d = d.slice(3);
    if (d.length === 10 && d.charAt(0) === "0") d = d.slice(1);
    return d;
  }
  function refreshUser() {
    var a = uid ? LS.get("accounts", {})[uid] : null;
    if (a) OP.user = { id: uid, name: a.name, phone: uid };
    else { OP.user = null; uid = null; }
  }
  try { var sess = JSON.parse(localStorage.getItem("omyr.session")); if (sess && sess.id) uid = String(sess.id); } catch (e) {}
  refreshUser();

  OP.maskPhone = function (p) { return p.length === 9 ? "+996 " + p.slice(0, 3) + "•••" + p.slice(-2) : (p.length > 4 ? p.slice(0, 3) + "•••" + p.slice(-2) : p); };
  OP.validPhone = function (p) { return normPhone(p).length === 9; };
  OP.validPin = function (p) { return /^\d{4}$/.test(p); };
  /* возвращает null при успехе или код ошибки */
  OP.register = function (name, phone, pin) {
    var id = normPhone(phone), all = LS.get("accounts", {});
    if (all[id] || all["0" + id]) return "err_exists";
    all[id] = { name: name.trim().slice(0, 40), pin: hashPin(id, pin), created: new Date().toISOString() };
    LS.set("accounts", all);
    LS.set("session", { id: id }); uid = id; refreshUser();
    return null;
  };
  OP.login = function (phone, pin) {
    var id = normPhone(phone), all = LS.get("accounts", {}), a = all[id];
    if (!a && all["0" + id]) { id = "0" + id; a = all[id]; } /* старые демо-профили с 0 */
    if (!a || a.pin !== hashPin(id, pin)) return "err_login";
    LS.set("session", { id: id }); uid = id; refreshUser();
    return null;
  };
  OP.logout = function () {
    try { localStorage.removeItem("omyr.session"); } catch (e) {}
    location.href = "auth.html";
  };
  OP.deleteAccount = function () {
    if (!uid) return;
    var all = LS.get("accounts", {}); LS.clearAll(); delete all[uid]; LS.set("accounts", all);
    OP.logout();
  };
  /* адрес для возврата после входа (только свои страницы, без чужих ссылок) */
  OP.nextUrl = function () {
    var n = new URLSearchParams(location.search).get("next") || "";
    return /^[a-z]+\.html(\?[A-Za-z0-9=&%._-]*)?$/i.test(n) ? n : "index.html";
  };

  /* ---------- утилиты ---------- */
  OP.t = function (key) {
    var d = window.I18N || {};
    return (d[OP.lang] && d[OP.lang][key]) || (d.ru && d.ru[key]) || key;
  };
  OP.pick = function (o) { return o == null ? "" : (typeof o === "string" ? o : (o[OP.lang] || o.ru || "")); };
  OP.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  OP.$ = function (s, r) { return (r || document).querySelector(s); };
  OP.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var MONTHS = {
    ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
    ky: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]
  };
  OP.fmtDate = function (iso, time) {
    var p = iso.split("-"), d = parseInt(p[2], 10), m = parseInt(p[1], 10) - 1;
    var s = OP.lang === "ky" ? (MONTHS.ky[m] + " " + d) : (d + " " + MONTHS.ru[m]);
    return time ? s + ", " + time : s;
  };

  var toastTimer;
  OP.toast = function (msg) {
    var el = OP.$("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove("show"); }, 3200);
  };

  /* ---------- прогресс, записи, результаты ---------- */
  OP.course = function (id) { return DATA.courses.filter(function (c) { return c.id === id; })[0]; };
  OP.courseState = function (id) {
    var all = LS.get("progress", {});
    return all[id] || { steps: [], quiz: false, done: false };
  };
  OP.saveCourseState = function (id, st) {
    var all = LS.get("progress", {}); all[id] = st; LS.set("progress", all);
    LS.set("lastLesson", id);
  };
  OP.courseProgress = function (c) {
    var st = OP.courseState(c.id), total = c.steps.length + 1;
    var done = st.steps.length + (st.quiz ? 1 : 0);
    return { pct: st.done ? 100 : Math.round(done / total * 100), state: st };
  };
  OP.bookings = function () { return LS.get("bookings", []); };
  OP.isBooked = function (id) { return OP.bookings().indexOf(id) !== -1; };
  OP.toggleBooking = function (id) {
    var b = OP.bookings(), i = b.indexOf(id);
    if (i === -1) { b.push(id); } else { b.splice(i, 1); }
    LS.set("bookings", b);
    return i === -1;
  };
  OP.seatsLeft = function (e) { return e.seats - e.taken - (OP.isBooked(e.id) ? 1 : 0); };

  /* ---------- карточки ---------- */
  OP.courseCard = function (c) {
    var pr = OP.courseProgress(c);
    var label = pr.state.done ? OP.t("lesson_done") : (pr.pct > 0 ? OP.t("continue_lesson") : OP.t("start_lesson"));
    return '<article class="card">' +
      '<span class="tag">' + OP.esc(OP.t("cat_" + c.cat)) + '</span>' +
      '<h3>' + OP.esc(OP.pick(c.title)) + '</h3>' +
      '<p>' + OP.esc(OP.pick(c.desc)) + '</p>' +
      '<p class="meta">' + OP.esc(OP.t("level")) + ": " + OP.esc(OP.t("level_" + c.level)) + " · " + c.minutes + " " + OP.esc(OP.t("min")) + '</p>' +
      (pr.pct > 0 ? '<div class="bar" role="progressbar" aria-valuenow="' + pr.pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + OP.esc(OP.t("progress")) + '"><i style="width:' + pr.pct + '%"></i></div>' : '') +
      '<span class="spacer"></span>' +
      '<a class="btn btn-primary" href="lesson.html?id=' + encodeURIComponent(c.id) + '">' + OP.esc(label) + '</a>' +
      '</article>';
  };

  OP.eventCard = function (e) {
    var left = OP.seatsLeft(e), booked = OP.isBooked(e.id);
    var btn;
    if (booked) btn = '<button class="btn btn-ghost" data-book="' + e.id + '">' + OP.esc(OP.t("cancel_book")) + '</button>';
    else if (left <= 0) btn = '<button class="btn btn-ghost" disabled>' + OP.esc(OP.t("full")) + '</button>';
    else btn = '<button class="btn btn-accent" data-book="' + e.id + '">' + OP.esc(OP.t("book")) + '</button>';
    return '<article class="card">' +
      '<div class="row"><span class="tag">' + OP.esc(OP.t("ec_" + e.cat)) + '</span><span class="tag">' + OP.esc(OP.t("fmt_" + e.format)) + '</span></div>' +
      '<h3>' + OP.esc(OP.pick(e.title)) + '</h3>' +
      '<p><strong>' + OP.esc(OP.fmtDate(e.date, e.time)) + '</strong></p>' +
      '<p>' + OP.esc(OP.pick(e.desc)) + '</p>' +
      '<p class="meta">' + OP.esc(OP.t("place")) + ": " + OP.esc(OP.pick(e.place)) + '<br>' +
        OP.esc(OP.t("organizer")) + ": " + OP.esc(OP.pick(e.organizer)) + '<br>' +
        (booked ? '<strong>' + OP.esc(OP.t("booked")) + '</strong>' : OP.esc(OP.t("seats_left")) + ": " + Math.max(left, 0)) + '</p>' +
      '<span class="spacer"></span>' + btn + '</article>';
  };

  /* делегирование: кнопки записи работают на любой странице */
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-book]");
    if (!b) return;
    var now = OP.toggleBooking(b.getAttribute("data-book"));
    OP.toast(OP.t(now ? "booked_toast" : "canceled_toast"));
    if (OP.page) OP.page();
  });

  /* ---------- доступность ---------- */
  function applyA11y() {
    var fs = LS.get("fs", 0), hc = LS.get("hc", false);
    document.documentElement.classList.remove("fs1", "fs2");
    if (fs > 0) document.documentElement.classList.add("fs" + fs);
    document.body.classList.toggle("hc", !!hc);
  }

  /* ---------- шапка и подвал ---------- */
  var NAV = [["home", "index.html", "nav_home"], ["learn", "learn.html", "nav_learn"], ["events", "events.html", "nav_events"],
             ["safety", "safety.html", "nav_safety"], ["cabinet", "cabinet.html", "nav_cabinet"], ["about", "about.html", "nav_about"]];

  OP.chrome = function () {
    var cur = document.body.getAttribute("data-page");
    var hdr = OP.$("#hdr"), ftr = OP.$("#ftr");
    var lang = OP.lang, hc = LS.get("hc", false);
    var isAuth = cur === "auth";
    var avatar = "";
    if (OP.user) {
      var photo = LS.get("photo", null);
      var inner = photo ? '<img src="' + photo + '" alt="">' :
        '<span aria-hidden="true">' + OP.esc((OP.user.name || "?").charAt(0).toUpperCase()) + '</span>';
      avatar = '<div class="profile-wrap">' +
        '<button type="button" class="avatar" id="avBtn" aria-haspopup="dialog" aria-expanded="false" aria-controls="profPanel" aria-label="' + OP.esc(OP.t("cab_profile")) + '">' + inner + '</button>' +
        '<div class="prof-panel" id="profPanel" role="dialog" aria-label="' + OP.esc(OP.t("cab_profile")) + '" hidden>' +
          '<div class="avatar big">' + inner + '</div>' +
          '<strong>' + OP.esc(OP.user.name) + '</strong>' +
          '<span class="muted">' + OP.esc(OP.t("cab_phone")) + ': ' + OP.esc(OP.maskPhone(OP.user.phone)) + '</span>' +
          '<input type="file" id="photoInp" accept="image/*" hidden>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="photoBtn">' + OP.esc(OP.t("photo_change")) + '</button>' +
          (photo ? '<button type="button" class="btn btn-ghost btn-sm" id="photoDel">' + OP.esc(OP.t("photo_remove")) + '</button>' : "") +
          '<a class="btn btn-primary btn-sm" href="cabinet.html">' + OP.esc(OP.t("prof_cabinet")) + '</a>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="logoutBtn">' + OP.esc(OP.t("logout")) + '</button>' +
        '</div></div>';
    }
    var items = NAV.map(function (n) {
      return '<li><a href="' + n[1] + '"' + (n[0] === cur ? ' aria-current="page"' : "") + '>' + OP.esc(OP.t(n[2])) + '</a></li>';
    }).join("");
    if (hdr) {
      hdr.innerHTML =
        '<a class="skip" href="#main">' + OP.esc(OP.t("skip")) + '</a>' +
        '<div class="topbar"><div class="wrap">' +
          '<div class="tools" role="group" aria-label="' + OP.esc(OP.t("fs_label")) + '">' +
            '<span>' + OP.esc(OP.t("fs_label")) + ':</span>' +
            '<button type="button" id="fsDec" aria-label="' + OP.esc(OP.t("fs_label")) + ' −">' + OP.t("fs_dec") + '</button>' +
            '<button type="button" id="fsInc" aria-label="' + OP.esc(OP.t("fs_label")) + ' +">' + OP.t("fs_inc") + '</button>' +
            '<button type="button" id="hcBtn" aria-pressed="' + hc + '">' + OP.esc(OP.t("contrast")) + '</button>' +
          '</div>' +
          '<div class="tools" role="group" aria-label="Тил / Язык">' +
            '<button type="button" data-lang="ky" lang="ky" aria-pressed="' + (lang === "ky") + '">Кыргызча</button>' +
            '<button type="button" data-lang="ru" lang="ru" aria-pressed="' + (lang === "ru") + '">Русский</button>' +
          '</div>' +
        '</div></div>' +
        '<header class="site"><div class="wrap nav">' +
          '<a class="brand" href="index.html" aria-label="ӨМҮР+"><span class="mark" aria-hidden="true">Ө</span><span>ӨМҮР+<small>' + OP.esc(OP.t("brand_sub")) + '</small></span></a>' +
          (isAuth ? "" :
            '<button class="burger" type="button" id="burger" aria-expanded="false" aria-controls="menu">☰ ' + OP.esc(OP.t("menu")) + '</button>' +
            '<nav aria-label="' + OP.esc(OP.t("menu")) + '"><ul class="menu" id="menu">' + items + '</ul></nav>') + avatar +
        '</div></header>';
    }
    if (ftr) {
      var links = NAV.map(function (n) { return '<li><a href="' + n[1] + '">' + OP.esc(OP.t(n[2])) + '</a></li>'; }).join("");
      ftr.innerHTML =
        '<footer class="site"><div class="wrap">' +
          '<div class="foot">' +
            '<div><h3>ӨМҮР+</h3><p>' + OP.esc(OP.t("about_lead")) + '</p></div>' +
            (isAuth ? "" : '<div><h3>' + OP.esc(OP.t("footer_nav")) + '</h3><ul>' + links + '</ul></div>') +
            '<div><h3>' + OP.esc(OP.t("footer_contact")) + '</h3><p>' + OP.esc(OP.t("contacts_d")) + '</p></div>' +
          '</div>' +
          '<p class="notice" style="color:#10222a;background:#e0eff2">' + OP.esc(OP.t("demo_note")) + '</p>' +
          '<div class="copy">' + OP.esc(OP.t("copy")) + '</div>' +
        '</div></footer>';
    }
    document.documentElement.lang = lang === "ky" ? "ky" : "ru";
  };

  function applyI18n() {
    OP.$$("[data-i18n]").forEach(function (el) { el.textContent = OP.t(el.getAttribute("data-i18n")); });
    OP.$$("[data-i18n-ph]").forEach(function (el) { el.setAttribute("placeholder", OP.t(el.getAttribute("data-i18n-ph"))); });
    OP.$$("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", OP.t(el.getAttribute("data-i18n-aria"))); });
    var title = document.body.getAttribute("data-title");
    document.title = (title ? OP.t(title) + " — " : "") + "ӨМҮР+";
  }

  /* ---------- фото и панель профиля ---------- */
  function profileOpen(on) {
    var b = OP.$("#avBtn"), p = OP.$("#profPanel");
    if (!b || !p) return;
    p.hidden = !on; b.setAttribute("aria-expanded", on);
  }
  function refreshProfile() { OP.chrome(); bindChrome(); profileOpen(true); }
  /* фото обрезается до квадрата 160×160 и хранится только в браузере этого профиля */
  OP.setPhoto = function (file) {
    if (!file || !/^image\//.test(file.type) || file.size > 8e6) { OP.toast(OP.t("photo_err")); return; }
    var fr = new FileReader();
    fr.onerror = function () { OP.toast(OP.t("photo_err")); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { OP.toast(OP.t("photo_err")); };
      img.onload = function () {
        var S = 160, c = document.createElement("canvas"); c.width = c.height = S;
        var side = Math.min(img.width, img.height);
        c.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
        LS.set("photo", c.toDataURL("image/jpeg", 0.85));
        refreshProfile(); OP.toast(OP.t("photo_saved"));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  };
  document.addEventListener("click", function (ev) {
    var p = OP.$("#profPanel");
    if (!p || p.hidden || !ev.target.isConnected) return;
    if (!ev.target.closest(".profile-wrap")) profileOpen(false);
  });
  document.addEventListener("keydown", function (ev) {
    var p = OP.$("#profPanel");
    if (ev.key === "Escape" && p && !p.hidden) { profileOpen(false); OP.$("#avBtn").focus(); }
  });

  function bindChrome() {
    var burger = OP.$("#burger"), menu = OP.$("#menu");
    if (burger) burger.addEventListener("click", function () {
      var open = menu.classList.toggle("open"); burger.setAttribute("aria-expanded", open);
    });
    OP.$$("[data-lang]").forEach(function (b) {
      b.addEventListener("click", function () { OP.setLang(b.getAttribute("data-lang")); });
    });
    var lo = OP.$("#logoutBtn");
    if (lo) lo.addEventListener("click", OP.logout);
    if (OP.$("#avBtn") && OP.$("#profPanel")) {
      OP.$("#avBtn").addEventListener("click", function () { profileOpen(OP.$("#profPanel").hidden); });
      var pi = OP.$("#photoInp"), pd = OP.$("#photoDel");
      OP.$("#photoBtn").addEventListener("click", function () { pi.click(); });
      pi.addEventListener("change", function () { if (pi.files && pi.files[0]) OP.setPhoto(pi.files[0]); });
      if (pd) pd.addEventListener("click", function () { LS.set("photo", null); refreshProfile(); });
    }
    var dec = OP.$("#fsDec"), inc = OP.$("#fsInc"), hc = OP.$("#hcBtn");
    if (dec) dec.addEventListener("click", function () { LS.set("fs", Math.max(0, LS.get("fs", 0) - 1)); applyA11y(); });
    if (inc) inc.addEventListener("click", function () { LS.set("fs", Math.min(2, LS.get("fs", 0) + 1)); applyA11y(); });
    if (hc) hc.addEventListener("click", function () {
      var v = !LS.get("hc", false); LS.set("hc", v); applyA11y(); hc.setAttribute("aria-pressed", v);
    });
  }

  OP.render = function () {
    applyA11y(); OP.chrome(); bindChrome(); applyI18n();
    if (OP.page) OP.page();
  };
  OP.setLang = function (l) { OP.lang = l === "ky" ? "ky" : "ru"; LS.set("lang", OP.lang); OP.render(); };

  /* Страницы сайта доступны без регистрации и PIN-кода. */

  /* страница вызывает OP.ready(функцияОтрисовки) */
  OP.ready = function (fn) {
    if (OP.blocked) return;
    OP.page = fn;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", OP.render);
    else OP.render();
  };
})();
