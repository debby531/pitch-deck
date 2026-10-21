(() => {
  'use strict';

  const D = window.DECK_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (v, dec = 0) => Number(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const fmtWan = v => (v >= 10000 ? `${(v / 10000).toFixed(2)} 億` : `${fmt(v)} 萬`);
  const fmtYM = ym => { const [y, m] = ym.split('-'); return `${y} 年 ${+m} 月`; };
  const addMonths = (ym, n) => {
    const [y, m] = ym.split('-').map(Number);
    const t = y * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  };
  const hasLeaflet = typeof window.L !== 'undefined';
  const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  /* ---------- 數字動畫 ---------- */
  function tween(el, to, { dur = 1200, dec = 0, from, format } = {}) {
    const start = from ?? el._val ?? 0;
    const out = format || (v => fmt(v, dec));
    const t0 = performance.now();
    cancelAnimationFrame(el._raf);
    const step = now => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = out(start + (to - start) * e);
      if (t < 1) el._raf = requestAnimationFrame(step);
    };
    el._val = to;
    el._raf = requestAnimationFrame(step);
  }

  /* =========================================================
   * 投影片導覽
   * ========================================================= */
  const slides = $$('.slide');
  const hooks = {};
  let cur = -1;

  function go(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === cur) return;
    cur = i;
    slides.forEach((s, k) => {
      s.classList.toggle('active', k === i);
      s.classList.toggle('past', k < i);
    });
    $('#progressBar').style.width = `${((i + 1) / slides.length) * 100}%`;
    $('#pageNum').textContent = `${i + 1} / ${slides.length}`;
    $('#btnPrev').disabled = i === 0;
    $('#btnNext').disabled = i === slides.length - 1;
    history.replaceState(null, '', `#${i + 1}`);

    const s = slides[i];
    s.scrollTop = 0;
    $$('[data-count]', s).forEach(el =>
      tween(el, parseFloat(el.dataset.count), { dec: +el.dataset.decimals || 0, from: 0 })
    );
    if (hooks[s.id]) hooks[s.id]();
  }
  const goId = id => go(slides.findIndex(s => s.id === id));

  $('#btnPrev').addEventListener('click', () => go(cur - 1));
  $('#btnNext').addEventListener('click', () => go(cur + 1));
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => goId(b.dataset.goto)));

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  $('#btnFull').addEventListener('click', toggleFullscreen);

  // 總覽
  const ov = $('#overview');
  const ovGrid = $('#ovGrid');
  slides.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<small>${String(i + 1).padStart(2, '0')}</small><span>${s.dataset.title}</span>`;
    b.addEventListener('click', () => { closeOverview(); go(i); });
    ovGrid.appendChild(b);
  });
  function openOverview() {
    $$('button', ovGrid).forEach((b, i) => b.classList.toggle('on', i === cur));
    ov.hidden = false;
  }
  function closeOverview() { ov.hidden = true; }
  $('#btnOverview').addEventListener('click', openOverview);
  $('#ovClose').addEventListener('click', closeOverview);

  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (!ov.hidden) { if (e.key === 'Escape' || e.key === 'o' || e.key === 'O') closeOverview(); return; }
    // 互動元件（滑桿、地圖）使用方向鍵時不翻頁
    if (t.closest && t.closest('input, textarea, select, .leaflet-container')) return;
    const onButton = t.tagName === 'BUTTON';
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': go(cur + 1); e.preventDefault(); break;
      case 'ArrowLeft': case 'PageUp': go(cur - 1); e.preventDefault(); break;
      case ' ': if (!onButton) { go(e.shiftKey ? cur - 1 : cur + 1); e.preventDefault(); } break;
      case 'Home': go(0); break;
      case 'End': go(slides.length - 1); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'o': case 'O': openOverview(); break;
    }
  });

  // 觸控滑動翻頁（地圖、清單內不觸發）
  let tx = null, ty = null;
  document.addEventListener('touchstart', e => {
    if (e.target.closest('.leaflet-container, input, .store-list, .timeline')) { tx = null; return; }
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1));
    tx = null;
  }, { passive: true });

  /* =========================================================
   * 互動① 全台展店地圖
   * ========================================================= */
  const storeById = Object.fromEntries(D.stores.map(s => [s.id, s]));
  const payback = s => Math.round(s.invest / (s.revenue * 0.2 / 12));
  const membersOf = s => Math.round(s.revenue * 0.72);
  const phaseOf = s => D.phases[s.phase];

  let storeMap = null;
  const markers = {};
  let phaseSel = 'all';
  let selId = null;

  const visibleStores = () => D.stores.filter(s => phaseSel === 'all' || String(s.phase) === phaseSel);

  function initStoreMap() {
    // 圖例
    $('#mapLegend').innerHTML = Object.values(D.phases)
      .map(p => `<span><i style="background:${p.color}"></i>${p.name}・${p.status}<small class="muted">　${p.period}</small></span>`).join('');

    // 階段篩選
    const filter = $('#phaseFilter');
    const opts = [['all', '全部'], ...Object.entries(D.phases).map(([k, p]) => [k, p.name])];
    filter.innerHTML = opts.map(([k, l]) => `<button type="button" data-phase="${k}" class="${k === 'all' ? 'on' : ''}">${l}</button>`).join('');
    filter.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      phaseSel = b.dataset.phase;
      $$('button', filter).forEach(x => x.classList.toggle('on', x === b));
      applyFilter();
    });

    if (hasLeaflet) {
      storeMap = L.map('storeMap', { zoomControl: true, scrollWheelZoom: true, minZoom: 6 });
      L.tileLayer(OSM_TILES, {
        attribution: OSM_ATTR, maxZoom: 19
      }).addTo(storeMap);

      D.stores.forEach(s => {
        const icon = L.divIcon({
          className: 'pin-icon',
          html: `<div class="pin" style="background:${phaseOf(s).color}"></div>`,
          iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -14]
        });
        const m = L.marker([s.lat, s.lng], { icon, title: s.name, riseOnHover: true }).addTo(storeMap);
        m.bindPopup(`<b>${s.name}</b><br>${s.city}${s.district}・${phaseOf(s).status}<br>${s.phase === 1 ? '開幕' : '預計開幕'}：${fmtYM(s.open)}`, { closeButton: false });
        m.on('click', () => selectStore(s.id));
        markers[s.id] = m;
      });
    } else {
      $('#storeMap').innerHTML = '<p style="padding:24px;color:#475569">地圖需要網路連線才能載入（Leaflet / OpenStreetMap）。右側清單仍可操作。</p>';
    }
    applyFilter();
  }

  function applyFilter() {
    const vis = visibleStores();
    const visIds = new Set(vis.map(s => s.id));

    if (storeMap) {
      D.stores.forEach(s => {
        const m = markers[s.id];
        if (visIds.has(s.id)) m.addTo(storeMap); else storeMap.removeLayer(m);
      });
      fitStores(vis);
    }
    if (selId && !visIds.has(selId)) clearSelection();

    // 摘要
    const inv = vis.reduce((a, s) => a + s.invest, 0);
    const rev = vis.reduce((a, s) => a + s.revenue, 0);
    $('#phaseSummary').innerHTML = `
      <div><small>門市數</small><b>${vis.length} 家</b></div>
      <div><small>總投資</small><b>${fmtWan(inv)}</b></div>
      <div><small>預估年營收</small><b>${fmtWan(rev)}</b></div>`;

    // 清單
    $('#storeList').innerHTML = vis.map(s => `
      <li><button type="button" data-id="${s.id}" class="${s.id === selId ? 'on' : ''}">
        <i style="background:${phaseOf(s).color}"></i>${s.name}
        <span class="sl-meta">${s.city}・${s.open.replace('-', '/')}</span>
      </button></li>`).join('');
  }

  $('#storeList').addEventListener('click', e => {
    const b = e.target.closest('button[data-id]');
    if (b) selectStore(b.dataset.id, true);
  });

  function fitStores(list) {
    if (!storeMap || !list.length) return;
    storeMap.fitBounds(L.latLngBounds(list.map(s => [s.lat, s.lng])), { padding: [48, 48], maxZoom: 11 });
  }

  function clearSelection() {
    selId = null;
    $$('.pin.sel').forEach(p => p.classList.remove('sel'));
    $('#storeCard').innerHTML = `<div class="empty"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg><p>選擇一間門市<br>查看開幕時間、投資與營收預估</p></div>`;
  }

  function selectStore(id, fromList = false) {
    const s = storeById[id];
    selId = id;
    const p = phaseOf(s);

    $$('.pin.sel').forEach(x => x.classList.remove('sel'));
    const m = markers[id];
    m?.getElement()?.querySelector('.pin')?.classList.add('sel');
    $$('#storeList button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    $(`#storeList button[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    const card = $('#storeCard');
    card.innerHTML = `
      <div class="sc-head">
        <div><h3>${s.name}</h3><small>${s.city}${s.district}・${s.type}・${s.area} 坪</small></div>
        <span class="badge" style="background:${p.color}">${p.status}</span>
      </div>
      <div class="sc-grid">
        <div><small>${s.phase === 1 ? '開幕時間' : '預計開幕'}</small><b>${fmtYM(s.open)}</b></div>
        <div><small>展店階段</small><b>${p.name}</b></div>
        <div><small>預估投資金額</small><b>NT$ ${fmt(s.invest)} 萬</b></div>
        <div><small>預估年營收</small><b>NT$ ${fmt(s.revenue)} 萬</b></div>
        <div><small>預估會員數</small><b>${fmt(membersOf(s))} 人</b></div>
        <div><small>投資回收期</small><b>${payback(s)} 個月</b></div>
      </div>`;
    card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');

    if (storeMap && m) {
      storeMap.flyTo([s.lat, s.lng], Math.max(storeMap.getZoom(), 12), { duration: 0.8 });
      if (fromList) storeMap.once('moveend', () => m.openPopup());
    }
  }

  hooks['slide-map'] = () => {
    if (!storeMap) return;
    setTimeout(() => storeMap.invalidateSize(), 60);
    setTimeout(() => { storeMap.invalidateSize(); if (!selId) fitStores(visibleStores()); }, 650);
  };

  /* =========================================================
   * 財務預測圖表
   * ========================================================= */
  const FIN = D.finance;
  let scen = 'base';
  let finDrawn = false;
  const CW = 760, CH = 340, PL = 56, PR = 12, PT = 30, PB = 44;
  const Y_MAX = 30000, Y_MIN = -3000;
  const yOf = v => PT + (Y_MAX - v) / (Y_MAX - Y_MIN) * (CH - PT - PB);

  function buildFinanceChart() {
    const n = FIN.years.length;
    const gw = (CW - PL - PR) / n;
    const bw = Math.min(46, gw * 0.3);
    const y0 = yOf(0);
    let svg = `<svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="五年營收與 EBITDA 預測">`;
    [0, 10000, 20000, 30000].forEach(v => {
      svg += `<line class="${v === 0 ? 'zero-l' : 'grid-l'}" x1="${PL}" x2="${CW - PR}" y1="${yOf(v)}" y2="${yOf(v)}"/>`;
      svg += `<text class="ax-t" x="${PL - 10}" y="${yOf(v) + 4}" text-anchor="end">${v === 0 ? '0' : (v / 10000).toFixed(0) + ' 億'}</text>`;
    });
    FIN.years.forEach((yr, i) => {
      const cx = PL + gw * i + gw / 2;
      svg += `<g class="grp" data-i="${i}">
        <rect class="bar-r rev" x="${cx - bw - 3}" y="${y0}" width="${bw}" height="0" rx="6" fill="var(--accent)"/>
        <rect class="bar-r ebit" x="${cx + 3}" y="${y0}" width="${bw}" height="0" rx="6" fill="var(--navy)"/>
        <text class="val-t" x="${cx - bw / 2 - 3}" y="${y0 - 8}" text-anchor="middle"></text>
        <text class="yr-t" x="${cx}" y="${CH - 12}" text-anchor="middle">${yr}</text>
        <rect class="hit" x="${cx - gw / 2}" y="${PT - 20}" width="${gw}" height="${CH - PT}"/>
      </g>`;
    });
    svg += '</svg>';
    $('#financeChart').innerHTML = svg;

    const tip = $('#finTip');
    const card = $('.chart-card');
    $$('#financeChart .grp').forEach(g => {
      const i = +g.dataset.i;
      g.addEventListener('mousemove', e => {
        const d = FIN.scenarios[scen];
        const r = card.getBoundingClientRect();
        tip.innerHTML = `<b>${FIN.years[i]}（${d.label}情境）</b><br>營收：NT$ ${fmtWan(d.revenue[i])}<br>EBITDA：NT$ ${fmtWan(Math.round(d.revenue[i] * d.margin[i]))}（${Math.round(d.margin[i] * 100)}%）<br>門市數：${d.stores[i]} 家`;
        let x = e.clientX - r.left + 16;
        if (x + tip.offsetWidth > r.width) x = e.clientX - r.left - tip.offsetWidth - 16;
        tip.style.left = `${x}px`;
        tip.style.top = `${e.clientY - r.top - 20}px`;
        tip.classList.add('show');
      });
      g.addEventListener('mouseleave', () => tip.classList.remove('show'));
    });
  }

  function setRect(r, top, h) {
    r.style.y = `${top}px`;
    r.style.height = `${Math.max(0, h)}px`;
  }

  function updateFinance() {
    const d = FIN.scenarios[scen];
    const y0 = yOf(0);
    $$('#financeChart .grp').forEach(g => {
      const i = +g.dataset.i;
      const rev = d.revenue[i];
      const eb = rev * d.margin[i];
      setRect($('.rev', g), yOf(rev), y0 - yOf(rev));
      if (eb >= 0) setRect($('.ebit', g), yOf(eb), y0 - yOf(eb));
      else setRect($('.ebit', g), y0, yOf(eb) - y0);
      const t = $('.val-t', g);
      t.setAttribute('y', yOf(rev) - 10);
      t.textContent = fmtWan(rev);
    });

    const last = d.revenue.length - 1;
    const cagr = Math.pow(d.revenue[last] / d.revenue[0], 1 / last) - 1;
    const beIdx = d.margin.findIndex(m => m > 0);
    tween($('#fk-rev'), d.revenue[last] / 10000, { dur: 700, format: v => `${v.toFixed(2)} 億` });
    tween($('#fk-cagr'), cagr * 100, { dur: 700, format: v => `${Math.round(v)}%` });
    $('#fk-be').textContent = beIdx >= 0 ? `${FIN.years[beIdx]} 年` : '—';
    tween($('#fk-stores'), d.stores[last], { dur: 700, format: v => `${Math.round(v)} 家` });
  }

  const scenSeg = $('#scenarioSeg');
  scenSeg.innerHTML = Object.entries(FIN.scenarios)
    .map(([k, s]) => `<button type="button" data-k="${k}" class="${k === scen ? 'on' : ''}">${s.label}情境</button>`).join('');
  scenSeg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    scen = b.dataset.k;
    $$('button', scenSeg).forEach(x => x.classList.toggle('on', x === b));
    updateFinance();
  });

  hooks['slide-finance'] = () => {
    if (!finDrawn) { finDrawn = true; setTimeout(updateFinance, 300); }
  };

  /* =========================================================
   * 互動② 募資金額模擬
   * ========================================================= */
  const F = D.fund;
  const range = $('#fundRange');
  range.min = F.min; range.max = F.max; range.step = F.step; range.value = F.defaultValue;
  let fundMap = null;
  const fundMarkers = {};
  let fundShown = false;

  $('#fundPresets').innerHTML = F.presets.map(v => `<button type="button" data-v="${v}">${fmt(v)} 萬</button>`).join('');
  $('#fundPresets').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    range.value = b.dataset.v;
    updateFund();
  });
  range.addEventListener('input', () => updateFund());

  $('#allocBar').innerHTML = F.allocation.map(a => `<i style="flex:${a.share};background:${a.color}" title="${a.label}"></i>`).join('');
  $('#allocLegend').innerHTML = F.allocation.map(a =>
    `<li><i style="background:${a.color}"></i>${a.label}<b data-key="${a.key}">—</b><em>${Math.round(a.share * 100)}%</em></li>`).join('');

  function computeFund(amount) {
    const n = Math.min(D.expansionQueue.length, Math.floor(amount * F.allocation[0].share / F.capexPerStore));
    const plan = D.expansionQueue.map((id, i) => ({ ...storeById[id], month: 3 + Math.round(i * 1.5), on: i < n }));
    const picked = plan.filter(p => p.on);
    return {
      n, plan, picked,
      revenue: picked.reduce((a, s) => a + s.revenue, 0),
      members: picked.reduce((a, s) => a + membersOf(s), 0),
      months: picked.length ? picked[picked.length - 1].month : 0,
      cities: [...new Set(picked.map(s => s.city))]
    };
  }

  function updateFund() {
    const amount = +range.value;
    const r = computeFund(amount);
    const pct = ((amount - F.min) / (F.max - F.min)) * 100;
    range.style.setProperty('--p', `${pct}%`);

    tween($('#fundValue'), amount, { dur: 300 });
    $$('#fundPresets button').forEach(b => b.classList.toggle('on', +b.dataset.v === amount));
    F.allocation.forEach(a => { $(`#allocLegend b[data-key="${a.key}"]`).textContent = `${fmt(Math.round(amount * a.share))} 萬`; });

    const prevN = $('#fr-stores')._val;
    tween($('#fr-stores'), r.n, { dur: 500 });
    tween($('#fr-rev'), r.revenue, { dur: 700 });
    tween($('#fr-months'), r.months, { dur: 500 });
    tween($('#fr-members'), r.members, { dur: 700 });
    $('#fr-date').textContent = r.months ? `約 ${fmtYM(addMonths(F.startMonth, r.months))} 完成` : '';
    $('#fr-cities').textContent = `${r.cities.length} 個縣市：${r.cities.join('、')}`;
    if (prevN !== undefined && prevN !== r.n) {
      $$('#slide-fund .kpi.big').forEach(k => { k.classList.remove('bump'); void k.offsetWidth; k.classList.add('bump'); });
    }

    $('#fundTimeline').innerHTML = r.plan.map((s, i) => `
      <li class="${s.on ? '' : 'off'}" style="animation-delay:${i * 40}ms">
        <span class="m">${s.on ? `第 ${s.month} 月` : '待追加'}</span><span class="d"></span>
        <span>${s.name}</span><span class="c">${s.city}・${fmt(s.revenue)} 萬/年</span>
      </li>`).join('');

    if (fundMap) {
      r.plan.forEach(s => {
        fundMarkers[s.id].setStyle(s.on
          ? { radius: 9, fillColor: '#FF6B35', color: '#fff', fillOpacity: 1, weight: 2 }
          : { radius: 6, fillColor: '#CBD5E1', color: '#fff', fillOpacity: .9, weight: 1.5 });
        if (s.on) fundMarkers[s.id].bringToFront();
      });
    }
  }

  function initFundMap() {
    if (!hasLeaflet) return;
    fundMap = L.map('fundMap', {
      zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
      boxZoom: false, keyboard: false, touchZoom: false
    });
    L.tileLayer(OSM_TILES, {
      attribution: OSM_ATTR, maxZoom: 19
    }).addTo(fundMap);
    D.stores.forEach(s => {
      const existing = s.phase === 1;
      fundMarkers[s.id] = L.circleMarker([s.lat, s.lng], existing
        ? { radius: 7, fillColor: '#1E3A8A', color: '#fff', fillOpacity: 1, weight: 2 }
        : { radius: 6, fillColor: '#CBD5E1', color: '#fff', fillOpacity: .9, weight: 1.5 })
        .bindTooltip(`${s.name}${existing ? '（已營運）' : ''}`, { direction: 'top' })
        .addTo(fundMap);
    });
    fitFundMap();
  }
  function fitFundMap() {
    fundMap?.fitBounds(L.latLngBounds(D.stores.map(s => [s.lat, s.lng])), { padding: [24, 24] });
  }

  hooks['slide-fund'] = () => {
    if (fundMap) {
      setTimeout(() => { fundMap.invalidateSize(); fitFundMap(); }, 650);
    }
    if (!fundShown) { fundShown = true; updateFund(); }
  };

  /* =========================================================
   * 啟動
   * ========================================================= */
  initStoreMap();
  buildFinanceChart();
  initFundMap();
  window.addEventListener('resize', () => {
    storeMap?.invalidateSize();
    fundMap?.invalidateSize();
  });

  const start = parseInt(location.hash.slice(1), 10);
  go(Number.isFinite(start) ? start - 1 : 0);
})();
