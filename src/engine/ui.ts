import type { MaterialDef, MaterialProps, Range } from './types';
import type { PartRuntime, Viewer, ViewMode } from './Viewer';

const PROP_META: Record<keyof MaterialProps, { label: string; unit: string; section: 'Mecánicas' | 'Térmicas' | 'Eléctricas' }> = {
  density: { label: 'Densidad', unit: 'kg/m³', section: 'Mecánicas' },
  youngModulus: { label: 'Módulo de Young', unit: 'GPa', section: 'Mecánicas' },
  tensileStrength: { label: 'Resistencia a la tracción', unit: 'MPa', section: 'Mecánicas' },
  yieldStrength: { label: 'Límite elástico', unit: 'MPa', section: 'Mecánicas' },
  elongation: { label: 'Alargamiento a rotura', unit: '%', section: 'Mecánicas' },
  hardness: { label: 'Dureza', unit: '', section: 'Mecánicas' },
  thermalConductivity: { label: 'Conductividad térmica', unit: 'W/(m·K)', section: 'Térmicas' },
  specificHeat: { label: 'Calor específico', unit: 'J/(kg·K)', section: 'Térmicas' },
  thermalExpansion: { label: 'Dilatación térmica', unit: 'µm/(m·K)', section: 'Térmicas' },
  meltingPoint: { label: 'Punto de fusión', unit: '°C', section: 'Térmicas' },
  glassTransition: { label: 'Transición vítrea (Tg)', unit: '°C', section: 'Térmicas' },
  maxServiceTemp: { label: 'Temp. de servicio', unit: '°C', section: 'Térmicas' },
  electricalResistivity: { label: 'Resistividad eléctrica', unit: 'Ω·m', section: 'Eléctricas' },
};
/** Propiedades que se muestran con barra comparativa (escala log contra toda la biblioteca). */
const BAR_PROPS: (keyof MaterialProps)[] = ['density', 'tensileStrength', 'thermalConductivity'];

const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const fmt = (v: Range) => (Array.isArray(v) ? `${nf.format(v[0])} – ${nf.format(v[1])}` : nf.format(v));
const mid = (v: Range) => (Array.isArray(v) ? (v[0] + v[1]) / 2 : v);
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function mountUI(app: HTMLElement, viewer: Viewer) {
  const { model, materials } = viewer;

  app.insertAdjacentHTML('beforeend', `
    <header class="topbar">
      <div class="brand"><span class="brand-mark"></span><span>DES<b>PIECE</b></span></div>
      <div class="model-title"><h1>${esc(model.name)}</h1><p>${esc(model.subtitle)}</p></div>
      <ul class="chips">${model.summary.map((s) => `<li><span>${esc(s.label)}</span>${esc(s.value)}</li>`).join('')}</ul>
      <button class="icon-btn only-mobile" data-act="toggle-list" aria-label="Lista de piezas">☰</button>
    </header>
    <aside class="sidebar" aria-label="Piezas">
      <div class="search"><input type="search" placeholder="Buscar pieza o material…" aria-label="Buscar"/></div>
      <div class="part-list"></div>
      <p class="count">${viewer.parts.length} piezas · ${new Set(model.parts.flatMap((p) => p.materials.map((m) => m.id))).size} materiales</p>
    </aside>
    <section class="detail" aria-live="polite" hidden></section>
    <div class="toolbar" role="toolbar">
      <div class="tb-group">
        <button class="icon-btn" data-act="step-back" title="Paso anterior (←)">⏮</button>
        <button class="primary" data-act="play">▶ Desglosar</button>
        <button class="icon-btn" data-act="step-fwd" title="Paso siguiente (→)">⏭</button>
      </div>
      <div class="tb-group slider">
        <input type="range" min="0" max="1000" value="0" aria-label="Nivel de explosión"/>
        <output>0 %</output>
        <span class="step-label">Paso 0/${viewer.stepCount}</span>
      </div>
      <div class="tb-group seg" role="radiogroup" aria-label="Modo de vista">
        <button data-mode="solid" class="on" title="Sólido (1)">Sólido</button>
        <button data-mode="xray" title="Rayos X (2)">Rayos X</button>
        <button data-mode="blueprint" title="Blueprint (3)">Blueprint</button>
      </div>
      <div class="tb-group">
        <button class="toggle on" data-act="labels" title="Etiquetas (L)">Etiquetas</button>
        <button class="toggle on" data-act="run" title="Simular funcionamiento (espacio)">Funcionando</button>
        <button class="toggle" data-act="spin" title="Auto-giro (R)">Auto-giro</button>
        <button class="icon-btn" data-act="reset" title="Restablecer cámara (0)" aria-label="Restablecer cámara">⌖</button>
        <button class="icon-btn" data-act="help" title="Atajos de teclado (?)" aria-label="Ayuda y atajos">?</button>
      </div>
    </div>
    <div class="hint">Arrastrá para girar · rueda para zoom · click derecho para desplazar · click en una pieza para ver su ficha</div>
    <div class="hover-chip" hidden></div>
    <div class="help" role="dialog" aria-modal="true" aria-labelledby="help-title" hidden>
      <div class="help-card">
        <div class="help-head"><h2 id="help-title">Cómo usar Despiece</h2><button class="icon-btn" data-act="help-close" aria-label="Cerrar">✕</button></div>
        <p>Girá el objeto, desarmalo y tocá cualquier pieza para ver de qué está hecha. Cada ficha tiene un enlace propio: copiá la URL para compartir una pieza.</p>
        <dl class="keys">${[
          ['E', 'Desglosar / ensamblar'], ['← →', 'Paso anterior / siguiente'], ['1 2 3', 'Sólido / Rayos X / Blueprint'],
          ['F', 'Enfocar la pieza (o todo)'], ['I', 'Aislar la pieza'], ['L', 'Etiquetas'], ['Espacio', 'Simular funcionamiento'],
          ['R', 'Auto-giro'], ['0', 'Restablecer cámara'], ['Esc', 'Deseleccionar / cerrar'], ['?', 'Esta ayuda'],
        ].map(([k, v]) => `<div><dt>${k.split(' ').map((x) => `<kbd>${x}</kbd>`).join('')}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <p class="help-mouse">Arrastrar: girar · Rueda o pellizco: zoom · Click derecho o dos dedos: desplazar</p>
      </div>
    </div>
  `);

  const $ = <T extends HTMLElement>(sel: string) => app.querySelector(sel) as T;
  const list = $('.part-list');
  const detail = $('.detail');
  const slider = $<HTMLInputElement>('.slider input');
  const out = $<HTMLOutputElement>('.slider output');
  const stepLabel = $('.step-label');
  const playBtn = $<HTMLButtonElement>('[data-act="play"]');
  const hoverChip = $('.hover-chip');

  // ───── Lista de piezas agrupada ─────
  const renderList = (q = '') => {
    const needle = q.trim().toLowerCase();
    list.innerHTML = model.groups.map((g) => {
      const items = viewer.parts.filter((p) => p.def.group === g).filter((p) => {
        if (!needle) return true;
        const mats = p.def.materials.map((m) => materials[m.id]?.name ?? '').join(' ');
        return (p.def.name + ' ' + mats).toLowerCase().includes(needle);
      });
      if (!items.length) return '';
      return `<h3>${esc(g)}</h3><ul>${items.map((p) => {
        const m = materials[p.def.materials[0].id];
        return `<li><button data-part="${p.index}" class="${viewer.selected === p ? 'active' : ''}">
          <span class="num">${String(p.index + 1).padStart(2, '0')}</span>
          <span class="name">${esc(p.def.name)}<small>${esc(m.name)}</small></span>
          <span class="sw" style="--c:${hex(m.render.color)}"></span></button></li>`;
      }).join('')}</ul>`;
    }).join('');
  };
  renderList();
  list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-part]') as HTMLElement | null;
    if (!b) return;
    const p = viewer.parts[Number(b.dataset.part)];
    viewer.select(p);
    if (viewer.partProgress(p) < 0.5 && viewer.explode < 0.05) viewer.playExplode(1, 3);
    app.classList.remove('list-open');
  });
  $<HTMLInputElement>('.search input').addEventListener('input', (e) => renderList((e.target as HTMLInputElement).value));

  // ───── Ficha técnica ─────
  const ranges = (() => {
    const r: Partial<Record<keyof MaterialProps, [number, number]>> = {};
    for (const k of BAR_PROPS) {
      const vals = Object.values(materials).map((m) => m.props[k]).filter((v): v is Range => typeof v === 'number' || Array.isArray(v)).map(mid);
      r[k] = [Math.min(...vals), Math.max(...vals)];
    }
    return r;
  })();
  const bar = (k: keyof MaterialProps, v: Range) => {
    const [lo, hi] = ranges[k]!;
    const x = (Math.log(mid(v)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo) || 1);
    return `<span class="bar" title="Comparado con el resto de la biblioteca (escala log)"><i style="width:${Math.max(4, x * 100).toFixed(1)}%"></i></span>`;
  };

  const materialBlock = (m: MaterialDef, role?: string) => {
    const sections: Record<string, string[]> = { 'Mecánicas': [], 'Térmicas': [], 'Eléctricas': [] };
    (Object.keys(PROP_META) as (keyof MaterialProps)[]).forEach((k) => {
      const v = m.props[k];
      if (v === undefined) return;
      const meta = PROP_META[k];
      const val = typeof v === 'string' ? v : fmt(v as Range);
      sections[meta.section].push(`<div class="prop"><dt>${meta.label}</dt><dd>${esc(val)} <u>${meta.unit}</u></dd>${
        BAR_PROPS.includes(k) && typeof v !== 'string' ? bar(k, v as Range) : ''}</div>`);
    });
    const r = m.render;
    return `<article class="mat">
      <header>
        <span class="mat-sw" style="--c:${hex(r.color)};--m:${r.metalness};--r:${r.roughness}"></span>
        <div><small>${role ? esc(role) + ' · ' : ''}${esc(m.family)}</small><h4>${esc(m.name)}</h4>${m.standard ? `<p class="std">${esc(m.standard)}</p>` : ''}</div>
      </header>
      <p>${esc(m.description)}</p>
      ${Object.entries(sections).filter(([, rows]) => rows.length).map(([s, rows]) => `<h5>${s}</h5><dl>${rows.join('')}</dl>`).join('')}
      ${m.extra ? `<h5>Datos adicionales</h5><dl>${Object.entries(m.extra).map(([k, v]) => `<div class="prop"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      <h5>Render PBR</h5>
      <dl class="pbr"><div class="prop"><dt>Color</dt><dd>${hex(r.color)}</dd></div><div class="prop"><dt>Metalness</dt><dd>${r.metalness}</dd></div><div class="prop"><dt>Roughness</dt><dd>${r.roughness}</dd></div>${r.clearcoat ? `<div class="prop"><dt>Clearcoat</dt><dd>${r.clearcoat}</dd></div>` : ''}</dl>
    </article>`;
  };

  /** Física derivada a partir de la masa de la ficha y el material principal. */
  const derived = (p: PartRuntime) => {
    const massSpec = p.def.specs.find((s) => /^masa/i.test(s.label));
    const mainMat = materials[p.def.materials[0].id];
    if (!massSpec || !mainMat) return '';
    const mm = massSpec.value.match(/([\d.,]+)\s*kg/);
    if (!mm) return '';
    const mass = parseFloat(mm[1].replace(/\./g, '').replace(',', '.'));
    const rho = mainMat.props.density ? mid(mainMat.props.density) : 0;
    const cp = mainMat.props.specificHeat ? mid(mainMat.props.specificHeat) : 0;
    const rows = [
      ['Peso', `${nf.format(mass * 9.81)} N`],
      rho ? ['Volumen de material', `${nf.format((mass / rho) * 1e6)} cm³`] : null,
      cp ? ['Capacidad calorífica', `${nf.format(mass * cp)} J/K`] : null,
      cp ? ['Energía para +10 °C', `${nf.format((mass * cp * 10) / 1000)} kJ`] : null,
    ].filter(Boolean) as string[][];
    return `<h5>Física derivada <em>(m = ${nf.format(mass)} kg, ${esc(mainMat.name.split(' ')[0])})</em></h5>
      <dl>${rows.map(([k, v]) => `<div class="prop"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  };

  const renderDetail = (p: PartRuntime | null) => {
    app.classList.toggle('has-detail', !!p);
    if (!p) { detail.hidden = true; return; }
    detail.hidden = false;
    const d = p.def;
    detail.innerHTML = `
      <div class="detail-head">
        <span class="badge">${String(p.index + 1).padStart(2, '0')}</span>
        <div><small>${esc(d.group)}</small><h2>${esc(d.name)}</h2></div>
        <button class="icon-btn" data-act="close" aria-label="Cerrar (Esc)">✕</button>
      </div>
      <div class="detail-actions">
        <button data-act="focus">⌖ Enfocar</button>
        <button data-act="isolate" class="${viewer.isolated ? 'on' : ''}">◎ ${viewer.isolated ? 'Mostrar todo' : 'Aislar'}</button>
      </div>
      <div class="detail-body">
        <p class="lead">${esc(d.description)}</p>
        ${d.function ? `<p class="func"><b>Función</b>${esc(d.function)}</p>` : ''}
        <h5>Especificaciones</h5>
        <dl class="specs">${d.specs.map((s) => `<div class="prop"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl>
        ${derived(p)}
        <h3 class="mats-title">Material${d.materials.length > 1 ? 'es' : ''}</h3>
        ${d.materials.map((m) => materials[m.id] ? materialBlock(materials[m.id], m.role) : '').join('')}
        <p class="disclaimer">Valores típicos de referencia a 20 °C; varían según fabricante y lote.</p>
      </div>`;
    detail.scrollTop = 0;
  };

  /** Aislar acerca la cámara a la pieza; volver a mostrar todo reencuadra el conjunto. */
  const toggleIsolate = () => {
    viewer.setIsolate(!viewer.isolated);
    renderDetail(viewer.selected);
    if (viewer.isolated) viewer.focus(); else viewer.fit();
  };
  detail.addEventListener('click', (e) => {
    const act = ((e.target as HTMLElement).closest('[data-act]') as HTMLElement | null)?.dataset.act;
    if (act === 'close') viewer.select(null);
    if (act === 'focus') viewer.focus();
    if (act === 'isolate') toggleIsolate();
  });

  viewer.on('select', (p) => {
    renderDetail(p);
    renderList($<HTMLInputElement>('.search input').value);
    const hash = p ? `#${p.def.id}` : '';
    if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname + location.search);
  });
  // Enlace directo a una pieza: …/#compresor abre el conjunto desglosado con esa ficha.
  const fromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const p = viewer.parts.find((x) => x.def.id === id);
    if (!p || p === viewer.selected) return;
    viewer.select(p);
    if (viewer.explode < 0.05) viewer.playExplode(1, 3);
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();
  viewer.on('hover', (p) => {
    hoverChip.hidden = !p;
    if (p) hoverChip.textContent = `${String(p.index + 1).padStart(2, '0')} · ${p.def.name} — ${materials[p.def.materials[0].id].name}`;
  });

  // ───── Toolbar ─────
  let lastPct = -1;
  viewer.on('explode', (t) => {
    const pct = Math.round(t * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      out.value = `${pct} %`;
      if (document.activeElement !== slider) slider.value = String(Math.round(t * 1000));
      stepLabel.textContent = `Paso ${viewer.currentStep}/${viewer.stepCount}`;
      playBtn.textContent = t > 0.5 ? '⟲ Ensamblar' : '▶ Desglosar';
    }
  });
  slider.addEventListener('input', () => viewer.setExplode(Number(slider.value) / 1000));

  const setMode = (m: ViewMode) => {
    viewer.setMode(m);
    app.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.mode === m));
  };
  const toggle = (act: string, on: boolean) => $(`[data-act="${act}"]`).classList.toggle('on', on);
  const actions: Record<string, () => void> = {
    play: () => viewer.playExplode(viewer.explode > 0.5 ? 0 : 1, 4.5),
    'step-fwd': () => viewer.step(1),
    'step-back': () => viewer.step(-1),
    labels: () => { viewer.labelsOn = !viewer.labelsOn; toggle('labels', viewer.labelsOn); },
    run: () => { viewer.running = !viewer.running; toggle('run', viewer.running); },
    spin: () => { viewer.controls.autoRotate = !viewer.controls.autoRotate; toggle('spin', viewer.controls.autoRotate); },
    reset: () => viewer.resetCamera(),
    'toggle-list': () => app.classList.toggle('list-open'),
    help: () => setHelp(help.hidden),
  };
  const help = $('.help');
  const setHelp = (open: boolean) => {
    help.hidden = !open;
    if (open) help.querySelector<HTMLButtonElement>('[data-act="help-close"]')!.focus();
  };
  help.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === help || t.closest('[data-act="help-close"]')) setHelp(false);
  });
  app.querySelector('.toolbar')!.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const mode = (t.closest('[data-mode]') as HTMLElement | null)?.dataset.mode as ViewMode | undefined;
    if (mode) return setMode(mode);
    const act = (t.closest('[data-act]') as HTMLElement | null)?.dataset.act;
    if (act) actions[act]?.();
  });
  $('[data-act="toggle-list"]').addEventListener('click', actions['toggle-list']);

  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (!help.hidden) { if (k === 'escape' || k === '?') setHelp(false); return; }
    if (k === '?') actions.help();
    else if (k === 'e') actions.play();
    else if (e.key === 'ArrowRight') actions['step-fwd']();
    else if (e.key === 'ArrowLeft') actions['step-back']();
    else if (k === 'escape') viewer.select(null);
    else if (k === 'f') viewer.focus(viewer.selected);
    else if (k === 'i' && viewer.selected) toggleIsolate();
    else if (k === 'l') actions.labels();
    else if (k === 'r') actions.spin();
    else if (k === '0') actions.reset();
    else if (k === ' ') { e.preventDefault(); actions.run(); }
    else if (k === '1') setMode('solid');
    else if (k === '2') setMode('xray');
    else if (k === '3') setMode('blueprint');
  });
}
