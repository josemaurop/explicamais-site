(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.remove("no-js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* Menu (celular) */
  var burger = document.querySelector(".burger");
  var menu = document.getElementById("menu");
  if (burger && menu) {
    var setMenu = function (open) {
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
      if (open) {
        menu.hidden = false;
        document.body.style.overflow = "hidden";
      } else {
        menu.hidden = true;
        document.body.style.overflow = "";
      }
    };
    burger.addEventListener("click", function () {
      setMenu(burger.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) setMenu(false);
    });
  }

  /* Reveal ao entrar na tela */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* Contadores */
  var counters = document.querySelectorAll("[data-count]");
  var runCounter = function (el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var sep = el.getAttribute("data-sep") || ".";
    var start = null;
    var duration = 900;
    var format = function (v) { return v.toFixed(decimals).replace(".", sep); };
    if (reduceMotion) { el.textContent = format(target); return; }
    var step = function (ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(target * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { runCounter(entry.target); cio.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(runCounter);
  }

  /* Abas de situação */
  var switchEl = document.querySelector(".switch");
  if (switchEl) {
    var tabs = Array.prototype.slice.call(switchEl.querySelectorAll('[role="tab"]'));
    var pill = switchEl.querySelector(".switch__pill");
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });

    var placePill = function (tab) {
      if (!pill) return;
      switchEl.style.setProperty("--pill-x", tab.offsetLeft + "px");
      switchEl.style.setProperty("--pill-w", tab.offsetWidth + "px");
    };
    var select = function (tab, focus) {
      tabs.forEach(function (t, i) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.setAttribute("tabindex", on ? "0" : "-1");
        var panel = panels[i];
        if (!panel) return;
        if (on) {
          panel.hidden = false;
          if (!reduceMotion) {
            panel.classList.remove("panel--enter");
            void panel.offsetWidth;
            panel.classList.add("panel--enter");
          }
        } else {
          panel.hidden = true;
        }
      });
      placePill(tab);
      if (focus) tab.focus();
    };
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab, false); });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") next = tabs[0];
        if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
    var current = tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0] || tabs[0];
    placePill(current);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placePill(current); });
    window.addEventListener("resize", function () {
      var sel = tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0];
      if (sel) placePill(sel);
    });
  }

  /* Adesivos do hero: parallax com o mouse */
  var scene = document.querySelector("[data-parallax]");
  if (scene && finePointer && !reduceMotion) {
    var layers = scene.querySelectorAll("[data-layer]");
    var raf = null;
    var tx = 0, ty = 0;
    var apply = function () {
      raf = null;
      layers.forEach(function (l) {
        l.style.setProperty("--px", tx + "px");
        l.style.setProperty("--py", ty + "px");
      });
    };
    scene.addEventListener("pointermove", function (e) {
      var r = scene.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 18;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 14;
      if (raf === null) raf = requestAnimationFrame(apply);
    });
    scene.addEventListener("pointerleave", function () {
      tx = 0; ty = 0;
      if (raf === null) raf = requestAnimationFrame(apply);
    });
  }

  /* Temas: escolhe e monta a mensagem */
  var termsRows = document.querySelector(".terms__rows");
  var termCta = document.getElementById("term-cta");
  var termPick = document.querySelector(".terms__pick");
  var waBase = "https://wa.me/5567991237220?text=";
  var narrow = window.matchMedia("(max-width: 1023px)").matches;

  /* No celular as fileiras viram esteira: duplica os chips para o loop fechar */
  if (termsRows && narrow && !reduceMotion) {
    termsRows.querySelectorAll("[data-marquee]").forEach(function (row) {
      var clones = Array.prototype.map.call(row.children, function (chip) {
        var c = chip.cloneNode(true);
        c.setAttribute("tabindex", "-1");
        c.setAttribute("aria-hidden", "true");
        return c;
      });
      clones.forEach(function (c) { row.appendChild(c); });
    });
    var pause = function () { termsRows.classList.add("is-paused"); };
    var resume = function () { termsRows.classList.remove("is-paused"); };
    termsRows.addEventListener("pointerdown", pause);
    termsRows.addEventListener("pointerup", resume);
    termsRows.addEventListener("pointercancel", resume);
    termsRows.addEventListener("pointerleave", resume);
  }

  var resetPick = function () {
    if (termPick) termPick.textContent = "Escolha um tema acima ou escreva o seu no WhatsApp.";
    if (termCta) { termCta.href = waBase + encodeURIComponent("Oi, quero ajuda com uma matéria"); termCta.textContent = "Quero ajuda com isso"; }
  };
  if (termsRows) {
    termsRows.querySelectorAll(".chip[data-term]").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
    termsRows.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip[data-term]");
      if (!chip) return;
      var term = chip.getAttribute("data-term");
      var wasOn = chip.getAttribute("aria-pressed") === "true";
      var all = termsRows.querySelectorAll(".chip[data-term]");
      all.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      if (wasOn) { resetPick(); return; }
      all.forEach(function (c) { if (c.getAttribute("data-term") === term) c.setAttribute("aria-pressed", "true"); });
      if (termPick) termPick.textContent = "Quero ajuda com " + term + ".";
      if (termCta) {
        termCta.href = waBase + encodeURIComponent("Oi, quero ajuda com " + term);
        termCta.textContent = "Mandar no WhatsApp";
      }
    });
  }

  /* Barra fixa: some sempre que qualquer botao de WhatsApp da pagina estiver na tela */
  var bar = document.querySelector(".stickybar");
  if (bar && "IntersectionObserver" in window) {
    var ctas = Array.prototype.filter.call(document.querySelectorAll('a[href*="wa.me"]'), function (a) { return a !== bar; });
    var onScreen = new Set();
    var updateBar = function () { bar.classList.toggle("stickybar--hidden", onScreen.size > 0); };
    var bio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) onScreen.add(entry.target); else onScreen.delete(entry.target);
      });
      updateBar();
    }, { threshold: 0.2 });
    ctas.forEach(function (a) { bio.observe(a); });
    bar.classList.add("stickybar--hidden");
  }

  /* Caderno: abas que folham a pagina, com simulacao automatica */
  var notebook = document.querySelector("[data-notebook]");
  if (notebook) {
    var nbTabs = Array.prototype.slice.call(notebook.querySelectorAll('[role="tab"]'));
    var nbPages = nbTabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
    var nbPagesWrap = notebook.querySelector(".notebook__pages");
    var nbIndex = 0;
    var nbTimer = null;
    var nbUserTook = false;

    var nbShow = function (i, animate) {
      if (i === nbIndex) return;
      var cur = nbPages[nbIndex];
      var next = nbPages[i];
      if (animate && !reduceMotion && cur) {
        var ghost = cur.cloneNode(true);
        ghost.removeAttribute("id");
        ghost.removeAttribute("role");
        ghost.setAttribute("aria-hidden", "true");
        ghost.classList.add("notebook__page--leave");
        ghost.classList.remove("is-active");
        ghost.querySelectorAll("[data-count]").forEach(function (el) { el.removeAttribute("data-count"); });
        nbPagesWrap.appendChild(ghost);
        ghost.addEventListener("animationend", function () { ghost.remove(); });
      }
      nbTabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute("aria-selected", String(on));
        t.setAttribute("tabindex", on ? "0" : "-1");
        nbPages[k].hidden = !on;
        nbPages[k].classList.toggle("is-active", on);
      });
      if (animate && !reduceMotion) {
        next.classList.remove("notebook__page--enter");
        void next.offsetWidth;
        next.classList.add("notebook__page--enter");
      }
      nbIndex = i;
    };

    var nbStop = function () {
      if (nbTimer) { clearInterval(nbTimer); nbTimer = null; }
      notebook.classList.remove("notebook--auto");
    };
    var nbStart = function () {
      if (reduceMotion || nbUserTook || nbTimer) return;
      notebook.classList.add("notebook--auto");
      nbTimer = setInterval(function () { nbShow((nbIndex + 1) % nbTabs.length, true); }, 6000);
    };

    nbTabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { nbUserTook = true; nbStop(); nbShow(i, true); });
      tab.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % nbTabs.length;
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + nbTabs.length) % nbTabs.length;
        if (n !== null) { e.preventDefault(); nbUserTook = true; nbStop(); nbShow(n, true); nbTabs[n].focus(); }
      });
    });
    notebook.addEventListener("mouseenter", nbStop);
    notebook.addEventListener("mouseleave", function () { if (!nbUserTook) { nbStart(); } });
    notebook.addEventListener("focusin", nbStop);
    notebook.addEventListener("pointerdown", function () { nbUserTook = true; nbStop(); });

    /* so comeca a folhar quando o caderno aparece na tela */
    if ("IntersectionObserver" in window) {
      var nio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) nbStart(); else nbStop(); });
      }, { threshold: 0.5 });
      nio.observe(notebook);
    } else {
      nbStart();
    }
  }

  /* Aba atual no header */
  var navTabs = document.querySelectorAll(".tab[href^='#']");
  if (navTabs.length && "IntersectionObserver" in window) {
    var map = {};
    navTabs.forEach(function (t) { map[t.getAttribute("href").slice(1)] = t; });
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var tab = map[entry.target.id];
        if (!tab) return;
        if (entry.isIntersecting) {
          navTabs.forEach(function (t) { t.removeAttribute("aria-current"); });
          tab.setAttribute("aria-current", "true");
        }
      });
    }, { rootMargin: "-40% 0px -50% 0px", threshold: 0 });
    Object.keys(map).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) sio.observe(sec);
    });
  }
})();
