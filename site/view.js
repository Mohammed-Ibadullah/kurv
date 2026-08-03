/* Kurv view layer. Renders four panels off the model in app.js. */

const K = window.Kurv;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let searchTimer = null;
let pending = null; // the buy sheet's working item

/* ============================================================== shelf stamp */

function stampHTML(d) {
  if (d.kind === "flat") return "";
  const cells = [];
  if (d.priceAge != null && d.off >= 0.03 && d.kind !== "newnormal") {
    const n = Math.min(14, d.priceAge);
    for (let i = 1; i <= 14; i++) {
      if (i === 8) cells.push('<span class="notch"></span>');
      cells.push(`<i class="${i <= n ? "on" : ""}"></i>`);
    }
    if (d.priceAge > 14) cells.push(`<span class="over">+${d.priceAge - 14}d</span>`);
  }
  return `<div class="stamp ${d.kind}">
    <div class="stamp-head"><span>${esc(d.label)}</span><span>${d.regular != null ? K.money(d.regular) + " usual" : ""}</span></div>
    ${cells.length ? `<div class="ticks">${cells.join("")}</div>` : ""}
    ${d.note ? `<div class="stamp-note">${esc(d.note)}</div>` : ""}
  </div>`;
}

function unitPriceHTML(it, g) {
  const u = g ? g.canon : K.guessCanon(it.unit, it.quantity);
  const q = K.toCanon(it.quantity, it.unit, u);
  if (q == null || !it.price) return "";
  return `<div class="perunit">${K.money(it.price / q)} / ${u}</div>`;
}

function itemCard(it, g, opts) {
  const d = K.deal(it);
  const watched = g && g.items.includes(it.key);
  return `<div class="card" data-key="${esc(it.key)}">
    <div class="rowline">
      ${opts.watchBtn ? `<button class="watch ${watched ? "on" : ""}" data-act="watch" data-key="${esc(it.key)}" aria-label="${watched ? "Stop watching" : "Watch"}">${watched ? "✓" : "+"}</button>` : ""}
      <div class="grow">
        <div class="name">${esc(it.name)}</div>
        <div class="store">${esc(it.store)} · ${it.quantity ?? ""} ${esc(it.unit || "")}</div>
      </div>
      <div style="text-align:right">
        <div class="price ${d.off >= 0.03 ? "off" : ""}">${K.money(it.price)}</div>
        ${d.off >= 0.03 ? `<div class="was">${K.money(it.regular)}</div>` : ""}
        ${unitPriceHTML(it, g)}
      </div>
    </div>
    ${stampHTML(d)}
    <div class="btn-row" style="margin-top:10px">
      <button class="btn sm" data-act="buy" data-key="${esc(it.key)}">Log a purchase</button>
      ${opts.unwatch ? `<button class="btn sm ghost" data-act="watch" data-key="${esc(it.key)}">Stop watching</button>` : ""}
    </div>
  </div>`;
}

/* ================================================================ shop panel */

function renderShop() {
  const g = K.activeGroup();
  const el = $("shopBody");
  if (!g) {
    el.innerHTML = `<div class="empty"><strong>No lookout lists yet</strong>Make one in Setup — a list is a thing you buy repeatedly, like Pasta or Milk, not a single product.</div>`;
    return;
  }

  const watched = g.items.map(K.itemByKey).filter(Boolean);
  const scored = watched.map((it) => ({ it, d: K.deal(it) }));
  scored.sort((a, b) => {
    const rank = (x) => (x.d.kind === "fresh" ? 0 : x.d.kind === "aging" ? 1 : x.d.kind === "stale" ? 2 : x.d.kind === "newnormal" ? 3 : 4);
    return rank(a) - rank(b) || b.d.off - a.d.off;
  });

  const live = scored.filter((s) => s.d.kind === "fresh").length;
  const cheapest = scored.filter((s) => {
    const q = K.toCanon(s.it.quantity, s.it.unit, g.canon);
    return q != null;
  }).sort((a, b) => a.it.price / K.toCanon(a.it.quantity, a.it.unit, g.canon) - b.it.price / K.toCanon(b.it.quantity, b.it.unit, g.canon))[0];

  const r = K.rate(g);
  const stock = K.stockAt(g, Math.floor(Date.now() / 1000));
  const cover = r.mu > 1e-9 ? stock / r.mu : null;

  let head = `<div class="card tight">
    <div class="stat"><span class="k">In stock</span><span class="v">${K.num(stock)} ${g.canon}</span></div>
    <div class="stat"><span class="k">Cover left</span><span class="v ${cover != null && cover <= g.needDays ? "bad" : "good"}">${cover == null ? "—" : Math.round(cover) + " days"}</span></div>
    <div class="stat"><span class="k">Using</span><span class="v">${K.num(r.mu, 3)} ${g.canon}/day</span></div>
    ${cheapest ? `<div class="stat"><span class="k">Best per ${g.canon} right now</span><span class="v">${esc(cheapest.it.store)}</span></div>` : ""}
  </div>`;

  if (!watched.length) {
    head += `<div class="empty"><strong>Nothing on the lookout for ${esc(g.name)}</strong>Search below and tap + to watch a product. Watched products are checked against the nightly price file.</div>`;
  } else {
    head += `<h2>${esc(g.name)} lookout — ${live} live ${live === 1 ? "deal" : "deals"}</h2>`;
    head += scored.map((s) => itemCard(s.it, g, { unwatch: true })).join("");
  }
  el.innerHTML = head;
}

function renderSearch() {
  const g = K.activeGroup();
  const q = $("q").value.trim();
  const box = $("results");
  if (q.length < 3) { box.innerHTML = ""; return; }
  if (!K.CAT.ready) { box.innerHTML = `<div class="empty">${esc(K.CAT.error || "Prices still loading…")}</div>`; return; }
  const hits = K.search(q, K.S.ui.stores, 30);
  box.innerHTML = hits.length
    ? hits.map((it) => itemCard(it, g, { watchBtn: true })).join("")
    : `<div class="empty"><strong>No match</strong>Try fewer words. Danish letters are folded, so "aeg" finds "æg".</div>`;
}

function renderStoreFilter() {
  const stores = (K.CAT.meta && K.CAT.meta.stores) || [];
  const sel = K.S.ui.stores;
  $("stores").innerHTML = stores.map((s) =>
    `<button data-store="${esc(s)}" class="${!sel || sel.includes(s) ? "on" : ""}">${esc(s)}</button>`
  ).join("");
}

/* =============================================================== stock panel */

function renderStock() {
  const el = $("stockBody");
  if (!K.S.order.length) { el.innerHTML = `<div class="empty"><strong>Nothing to track yet</strong>Add a lookout list in Setup.</div>`; return; }
  const now = Math.floor(Date.now() / 1000);

  el.innerHTML = K.S.order.map((name) => {
    const g = K.group(name);
    K.ensureOneOpen(g);
    const lots = [...g.lots].sort((a, b) => K.lotExpiry(g, a, now) - K.lotExpiry(g, b, now));
    const r = K.rate(g);
    const stock = K.stockAt(g, now);
    const sim = K.simulate(g, now, 60);

    const lotRows = lots.map((l) => {
      const exp = K.lotExpiry(g, l, now);
      const left = Math.ceil((exp - now) / K.DAY);
      const cls = left < 0 ? "gone" : left < 7 ? "soon" : "ok";
      const txt = left < 0 ? `${-left}d past` : `${left}d left`;
      return `<div class="lot">
        <div class="rowline">
          <div class="grow">
            <div class="name" style="font-size:14px">${esc(l.name)}</div>
            <div class="store">${esc(l.store)} · ${l.packs}× ${l.packQty ?? ""} ${esc(l.packUnit || "")} = ${K.num(l.units)} ${g.canon}${l.opened ? " · open" : ""}</div>
            <div class="tiny">Bought ${K.fmtDate(l.ts)} · ${K.money(l.price)} <span class="chip ${l.cls}" style="margin-left:4px">${K.CLASSES[l.cls].label}</span></div>
          </div>
          <div style="text-align:right">
            <div class="exp ${cls}">${txt}</div>
            <div class="tiny">${K.tsToISO(exp)}</div>
            <button class="btn sm danger" data-act="rmlot" data-g="${esc(name)}" data-id="${l.id}" style="margin-top:5px">Remove</button>
          </div>
        </div>
      </div>`;
    }).join("") || `<div class="tiny" style="padding:8px 0">No lots recorded.</div>`;

    return `<h2>${esc(name)}</h2>
      <div class="card tight">
        <div class="stat"><span class="k">On hand</span><span class="v">${K.num(stock)} ${g.canon}</span></div>
        <div class="stat"><span class="k">Runs out</span><span class="v ${sim.firstEmpty && sim.firstEmpty < 14 ? "bad" : ""}">${sim.firstEmpty ? "in " + sim.firstEmpty + " days" : "not within 60 days"}</span></div>
        <div class="stat"><span class="k">Projected waste</span><span class="v ${sim.totalWaste > 0.001 ? "bad" : "good"}">${K.num(sim.totalWaste)} ${g.canon}</span></div>
      </div>
      <div class="card">${lotRows}</div>`;
  }).join("");
}

/* ============================================================== ledger panel */

function chart(pts) {
  if (pts.length < 2) return `<div class="empty">Log two purchases and the spending curve appears here.</div>`;
  const W = 640, H = 220, P = { t: 12, r: 12, b: 22, l: 52 };
  const t0 = pts[0].ts;
  const t1 = Math.max(pts[pts.length - 1].ts, t0 + K.DAY, Math.floor(Date.now() / 1000));
  const span = t1 - t0;
  const maxY = Math.max(pts[pts.length - 1].regular, 1) * 1.06;
  const x = (ts) => P.l + ((ts - t0) / span) * (W - P.l - P.r);
  const y = (v) => H - P.b - (v / maxY) * (H - P.t - P.b);

  // Spend is a step function: it jumps on the day of a purchase and is flat in
  // between. Drawing it as a smooth line would imply spending you did not do.
  const step = (key) => {
    let d = `M ${x(t0)} ${y(0)}`;
    let prev = 0;
    for (const p of pts) { d += ` L ${x(p.ts)} ${y(prev)} L ${x(p.ts)} ${y(p[key])}`; prev = p[key]; }
    return d + ` L ${x(t1)} ${y(prev)}`;
  };

  // The gap between the two curves is the savings, traced forward along the
  // usual-price steps and back along the paid steps.
  const band = () => {
    let d = `M ${x(t0)} ${y(0)}`;
    let prev = 0;
    for (const p of pts) { d += ` L ${x(p.ts)} ${y(prev)} L ${x(p.ts)} ${y(p.regular)}`; prev = p.regular; }
    d += ` L ${x(t1)} ${y(prev)}`;
    const last = pts[pts.length - 1].actual;
    d += ` L ${x(t1)} ${y(last)}`;
    for (let i = pts.length - 1; i >= 0; i--) {
      const before = i === 0 ? 0 : pts[i - 1].actual;
      d += ` L ${x(pts[i].ts)} ${y(pts[i].actual)} L ${x(pts[i].ts)} ${y(before)}`;
    }
    return d + " Z";
  };

  const ticks = [0, 0.5, 1].map((f) => {
    const v = maxY * f;
    return `<line x1="${P.l}" y1="${y(v)}" x2="${W - P.r}" y2="${y(v)}" stroke="var(--rule2)"/>
            <text x="${P.l - 6}" y="${y(v) + 3.5}" text-anchor="end" font-size="10" font-family="var(--mono)" fill="var(--ink3)">${Math.round(v)}</text>`;
  }).join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative spending, actual against usual prices">
    ${ticks}
    <path d="${band()}" fill="var(--stock)" opacity=".10"/>
    <path d="${step("regular")}" fill="none" stroke="var(--ink3)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="${step("actual")}" fill="none" stroke="var(--ink)" stroke-width="2"/>
    <text x="${P.l}" y="${H - 6}" font-size="10" font-family="var(--mono)" fill="var(--ink3)">${K.tsToISO(t0)}</text>
    <text x="${W - P.r}" y="${H - 6}" text-anchor="end" font-size="10" font-family="var(--mono)" fill="var(--ink3)">${K.tsToISO(t1)}</text>
  </svg>
  <div class="legend">
    <span><i style="background:var(--ink)"></i>What you paid</span>
    <span><i style="background:var(--ink3)"></i>Usual price for the same goods</span>
    <span><i style="background:var(--stock);height:8px;opacity:.3"></i>Saved</span>
  </div>`;
}

function renderLedger() {
  const el = $("ledgerBody");
  const names = K.S.order;
  if (!names.length) { el.innerHTML = `<div class="empty"><strong>Nothing logged yet</strong>Add a list and log a purchase.</div>`; return; }

  // Whole-basket totals first: this is the number the whole app exists for.
  let actual = 0, regular = 0;
  const allPts = [];
  for (const n of names) for (const p of K.spendSeries(K.group(n))) allPts.push(p);
  allPts.sort((a, b) => a.ts - b.ts);
  const merged = [];
  let ca = 0, cr = 0;
  for (const p of allPts) {
    ca += p.lot.price || 0;
    cr += p.lot.regular || p.lot.price || 0;
    merged.push({ ts: p.ts, actual: ca, regular: cr, lot: p.lot });
  }
  actual = ca; regular = cr;
  const saved = regular - actual;

  let html = `<div class="card">
    <div class="bigsave"><div class="v">${K.money(saved)}</div><div class="k">saved against usual prices</div></div>
    <div class="stat"><span class="k">Paid</span><span class="v">${K.money(actual)}</span></div>
    <div class="stat"><span class="k">Same goods at usual price</span><span class="v">${K.money(regular)}</span></div>
    <div class="stat"><span class="k">Effective discount</span><span class="v ${saved > 0 ? "good" : ""}">${regular > 0 ? Math.round((saved / regular) * 100) : 0}%</span></div>
  </div>
  <div class="card">${chart(merged)}</div>`;

  for (const n of names) {
    const g = K.group(n);
    if (!g.lots.length) continue;
    const cs = K.classSummary(g);
    const need = cs.need, opp = cs.opportunity;

    // The one diagnostic that matters: opportunity buys should be markedly
    // cheaper than the ones forced on you. If they are not, the "deal" is a
    // story you are telling yourself.
    let verdict = "";
    if (opp.n && need.n) {
      const gap = (opp.avgOff - need.avgOff) * 100;
      verdict = gap >= 8
        ? `<div class="stat"><span class="k">Opportunity premium</span><span class="v good">+${gap.toFixed(0)} pts vs need buys</span></div>`
        : `<div class="stat"><span class="k">Opportunity premium</span><span class="v bad">${gap >= 0 ? "+" : ""}${gap.toFixed(0)} pts — barely better than buying when you must</span></div>`;
    }

    html += `<h2>${esc(n)}</h2><div class="card tight">
      ${Object.keys(K.CLASSES).map((k) => {
        const c = cs[k];
        if (!c.n) return "";
        return `<div class="stat">
          <span class="k"><span class="chip ${k}">${K.CLASSES[k].label}</span> ${c.n}×</span>
          <span class="v">${K.money(c.spend)} <span class="tiny">${Math.round(c.avgOff * 100)}% off avg</span></span>
        </div>`;
      }).join("")}
      ${verdict}
    </div>
    <div class="card scroll"><table>
      <thead><tr><th>Date</th><th>Item</th><th class="r">Units</th><th class="r">Paid</th><th class="r">Saved</th><th>Call</th></tr></thead>
      <tbody>${[...g.lots].sort((a, b) => b.ts - a.ts).map((l) => `
        <tr>
          <td>${K.tsToISO(l.ts).slice(5)}</td>
          <td>${esc(l.name.slice(0, 26))}</td>
          <td class="r">${K.num(l.units)}</td>
          <td class="r">${l.price.toFixed(2)}</td>
          <td class="r">${((l.regular || l.price) - l.price).toFixed(2)}</td>
          <td><span class="chip ${l.cls}">${K.CLASSES[l.cls].label}</span></td>
        </tr>
        <tr><td colspan="6" class="tiny" style="border-bottom:1px solid var(--rule);padding-bottom:7px">${esc(l.why)}</td></tr>
      `).join("")}</tbody>
    </table></div>`;

    const sim = K.simulate(g, Math.floor(Date.now() / 1000), 30);
    html += `<div class="card scroll">
      <div class="eyebrow" style="margin-bottom:6px">Next 30 days at ${K.num(sim.mu, 3)} ${g.canon}/day</div>
      <table><thead><tr><th>Date</th><th class="r">Used</th><th class="r">Waste</th><th class="r">Left</th><th>Event</th></tr></thead>
      <tbody>${sim.rows.map((s) => `<tr class="${s.short ? "short" : ""}">
        <td>${s.date.slice(5)}</td><td class="r">${s.used.toFixed(2)}</td>
        <td class="r">${s.waste ? s.waste.toFixed(2) : "·"}</td>
        <td class="r">${s.remaining.toFixed(2)}</td><td>${esc(s.events)}</td></tr>`).join("")}</tbody></table>
      <div class="tiny" style="margin-top:6px">▲ marks a day the model cannot cover from stock.</div>
    </div>`;
  }
  el.innerHTML = html;
}

/* ================================================================ setup panel */

function renderSetup() {
  const el = $("setupBody");
  let html = `<div class="card">
    <div class="eyebrow" style="margin-bottom:8px">New lookout list</div>
    <div class="f2">
      <div class="field"><label>Name</label><input id="ngName" placeholder="Pasta"></div>
      <div class="field"><label>Measured in</label><select id="ngUnit">${K.CANON_UNITS.map((u) => `<option>${u}</option>`).join("")}</select></div>
    </div>
    <button class="btn" data-act="addgroup">Create list</button>
    <div class="hint" style="font-size:12px;color:var(--ink3);margin-top:8px">Everything in a list converts to one unit, so a 500 g bag and a 1 kg bag are comparable no matter the brand.</div>
  </div>`;

  for (const n of K.S.order) {
    const g = K.group(n);
    const prior = K.priorMu(g);
    const r = K.rate(g);
    html += `<h2>${esc(n)} <span class="tiny">· ${g.canon}</span></h2>
    <div class="card" data-g="${esc(n)}">
      <div class="eyebrow" style="margin-bottom:8px">Expected use per month</div>
      <div class="f3">
        <div class="field"><label>How many</label><input class="cfg" data-f="expCount" type="number" step="any" min="0" value="${g.expect ? g.expect.count : ""}" placeholder="7"></div>
        <div class="field"><label>Pack size</label><input class="cfg" data-f="expSize" type="number" step="any" min="0" value="${g.expect ? g.expect.packSize : ""}" placeholder="500"></div>
        <div class="field"><label>Unit</label><input class="cfg" data-f="expUnit" value="${g.expect ? esc(g.expect.packUnit) : ""}" placeholder="g"></div>
      </div>
      <div class="hint" style="font-size:12px;color:var(--ink3);margin:-4px 0 12px">
        ${prior != null
          ? `${K.num(g.expect.count * K.toCanon(g.expect.packSize, g.expect.packUnit, g.canon))} ${g.canon} a month = <strong>${K.num(prior, 3)} ${g.canon}/day</strong>. Model is currently using ${K.num(r.mu, 3)} ${g.canon}/day, blending this with ${r.n} logged purchase${r.n === 1 ? "" : "s"}.`
          : `Say "7 packs of 500 g" and the model has a starting rate before you have logged anything. Brand and pack size do not matter — it converts to ${g.canon}.`}
      </div>

      <div class="eyebrow" style="margin-bottom:8px">Shelf life</div>
      <div class="f2">
        <div class="field"><label>Days unopened</label><input class="cfg" data-f="shelfDays" type="number" min="1" value="${g.shelfDays}"></div>
        <div class="field"><label>Days once open</label><input class="cfg" data-f="openedDays" type="number" min="1" value="${g.openedDays}"></div>
      </div>

      <div class="eyebrow" style="margin-bottom:8px">Buying rules</div>
      <div class="f3">
        <div class="field"><label>Need under</label><input class="cfg" data-f="needDays" type="number" min="0" step="any" value="${g.needDays}"><div class="hint">days cover</div></div>
        <div class="field"><label>Deal from</label><input class="cfg" data-f="minDiscount" type="number" min="0" max="90" step="1" value="${Math.round(g.minDiscount * 100)}"><div class="hint">% off usual</div></div>
        <div class="field"><label>Half-life</label><input class="cfg" data-f="halfLife" type="number" min="1" step="any" value="${g.halfLife}"><div class="hint">days</div></div>
      </div>
      <div class="btn-row">
        <button class="btn sm" data-act="savecfg" data-g="${esc(n)}">Save ${esc(n)}</button>
        <button class="btn sm ghost" data-act="reclass" data-g="${esc(n)}">Re-judge past buys</button>
        <button class="btn sm danger" data-act="delgroup" data-g="${esc(n)}">Delete list</button>
      </div>
    </div>`;
  }

  const m = K.CAT.meta;
  html += `<h2>Prices</h2><div class="card tight">
    <div class="stat"><span class="k">Snapshot built</span><span class="v">${m ? new Date(m.built).toLocaleString("da-DK") : "—"}</span></div>
    <div class="stat"><span class="k">Products</span><span class="v">${m ? m.count.toLocaleString("da-DK") : "—"}</span></div>
    <div class="stat"><span class="k">Below usual price</span><span class="v">${m && m.discounted != null ? m.discounted.toLocaleString("da-DK") : "—"}</span></div>
    <div class="btn-row" style="margin-top:10px"><button class="btn sm ghost" data-act="refresh">Check for new prices</button></div>
  </div>

  <h2>Your data</h2><div class="card tight">
    <div class="muted" style="margin-bottom:10px">Lists, purchases and settings live only on this device. Nothing is uploaded. Export before you clear Safari data or switch phones.</div>
    <div class="btn-row">
      <button class="btn sm ghost" data-act="export">Export backup</button>
      <button class="btn sm ghost" data-act="import">Import backup</button>
    </div>
  </div>`;

  el.innerHTML = html;
}

/* ==================================================================== buy sheet */

function openBuy(key) {
  const g = K.activeGroup();
  const it = K.itemByKey(key);
  if (!g || !it) return;
  pending = it;
  const per = K.toCanon(it.quantity, it.unit, g.canon);
  $("buyTitle").textContent = it.name;
  $("buySub").innerHTML = `${esc(it.store)} · ${K.money(it.price)} · goes into <strong>${esc(g.name)}</strong>`;
  $("buyDate").value = K.todayISO();
  $("buyPacks").value = 1;
  $("buyUnits").value = per != null ? per : "";
  $("buyUnitsLabel").textContent = `${g.canon} per pack`;
  $("buyUnitsHint").innerHTML = per != null
    ? `From the pack size (${it.quantity} ${esc(it.unit || "")}). Change it if the label disagrees.`
    : `<strong style="color:var(--warn)">This pack is listed as "${esc(it.unit || "no unit")}", which does not convert to ${g.canon}. Enter it yourself or stock will be counted wrong.</strong>`;
  $("buyShelf").value = "";
  $("buyOpened").value = "";
  $("buyPreview").innerHTML = "";
  updateBuyPreview();
  $("buyModal").classList.add("on");
}

function updateBuyPreview() {
  const g = K.activeGroup();
  if (!g || !pending) return;
  const packs = Math.max(1, Number($("buyPacks").value) || 1);
  const per = Number($("buyUnits").value);
  const ts = K.isoToTs($("buyDate").value) || K.dayFloor(Math.floor(Date.now() / 1000));
  const shelf = Number($("buyShelf").value) || g.shelfDays;
  const units = isFinite(per) && per > 0 ? per * packs : 0;
  const d = K.classify(g, ts, units, shelf, pending.price, pending.regular);
  const saved = ((pending.regular ?? pending.price) - pending.price) * packs;
  $("buyPreview").innerHTML = `<div class="card tight" style="margin:2px 0 0">
    <div class="stat"><span class="k">Verdict</span><span class="v"><span class="chip ${d.cls}">${K.CLASSES[d.cls].label}</span></span></div>
    <div class="stat"><span class="k">Cover after</span><span class="v">${isFinite(d.coverAfter) ? Math.round(d.coverAfter) + " days" : "—"}</span></div>
    <div class="stat"><span class="k">Total</span><span class="v">${K.money(pending.price * packs)}${saved > 0.005 ? ` <span class="tiny" style="color:var(--stock)">saves ${K.money(saved)}</span>` : ""}</span></div>
    <div class="tiny" style="padding-top:5px">${esc(d.why)}</div>
  </div>`;
}

function confirmBuy() {
  const g = K.activeGroup();
  if (!g || !pending) return;
  const lot = K.buy(g, pending, {
    date: $("buyDate").value,
    packs: Number($("buyPacks").value),
    unitsPerPack: Number($("buyUnits").value),
    shelfDays: Number($("buyShelf").value) || null,
    openedDays: Number($("buyOpened").value) || null,
  });
  if (!g.items.includes(pending.key)) { g.items.push(pending.key); K.save(); }
  $("buyModal").classList.remove("on");
  K.toast(`Logged as ${K.CLASSES[lot.cls].label.toLowerCase()}`);
  renderAll();
}

/* ======================================================================= shell */

function renderHeader() {
  const sel = $("groupSel");
  sel.innerHTML = K.S.order.map((n) => `<option ${n === K.S.ui.group ? "selected" : ""}>${esc(n)}</option>`).join("")
    || `<option>No lists yet</option>`;

  const age = K.dataAgeDays();
  const snap = $("snapshot");
  if (age == null) {
    snap.className = "snapshot warn";
    snap.innerHTML = `<span class="dot"></span>No price snapshot loaded`;
  } else {
    snap.className = "snapshot" + (age >= 2 ? " warn" : "");
    snap.innerHTML = `<span class="dot"></span>Prices from ${age === 0 ? "today" : age === 1 ? "yesterday" : age + " days ago"}` +
      (age >= 2 ? " — deals below may already be over" : "");
  }
}

function renderAll() {
  renderHeader();
  const t = K.S.ui.tab;
  if (t === "shop") { renderShop(); renderSearch(); }
  if (t === "stock") renderStock();
  if (t === "ledger") renderLedger();
  if (t === "setup") renderSetup();
}

function setTab(t) {
  K.S.ui.tab = t;
  K.save();
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("on", p.id === "panel-" + t));
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
  renderAll();
  window.scrollTo(0, 0);
}

/* ===================================================================== events */

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act], [data-tab], [data-store]");
  if (!b) return;

  if (b.dataset.tab) return setTab(b.dataset.tab);

  if (b.dataset.store) {
    const s = b.dataset.store;
    const all = (K.CAT.meta && K.CAT.meta.stores) || [];
    let sel = K.S.ui.stores || all.slice();
    sel = sel.includes(s) ? sel.filter((x) => x !== s) : sel.concat([s]);
    K.S.ui.stores = sel.length === all.length ? null : sel;
    K.save(); renderStoreFilter(); renderSearch();
    return;
  }

  const act = b.dataset.act;
  const g = K.activeGroup();

  if (act === "watch") {
    if (!g) return K.toast("Make a lookout list first, in Setup.");
    const k = b.dataset.key;
    const on = !g.items.includes(k);
    g.items = on ? g.items.concat([k]) : g.items.filter((x) => x !== k);
    K.save();
    // Update the tapped control in place. Rebuilding the result list here
    // would scroll you back to the top halfway through picking products.
    document.querySelectorAll(`.watch[data-key="${CSS.escape(k)}"]`).forEach((el) => {
      el.classList.toggle("on", on);
      el.textContent = on ? "✓" : "+";
      el.setAttribute("aria-label", on ? "Stop watching" : "Watch");
    });
    renderShop();
  }
  else if (act === "buy") openBuy(b.dataset.key);
  else if (act === "confirmbuy") confirmBuy();
  else if (act === "closesheet") b.closest(".modal").classList.remove("on");
  else if (act === "rmlot") {
    if (!confirm("Remove this lot?")) return;
    K.removeLot(K.group(b.dataset.g), Number(b.dataset.id));
    renderStock();
  }
  else if (act === "addgroup") {
    const n = $("ngName").value, u = $("ngUnit").value;
    if (!K.addGroup(n, u)) return K.toast("Pick a name that is not already used.");
    renderAll();
  }
  else if (act === "delgroup") {
    if (!confirm(`Delete "${b.dataset.g}" and everything logged in it?`)) return;
    K.removeGroup(b.dataset.g); renderAll();
  }
  else if (act === "savecfg") saveCfg(b.dataset.g);
  else if (act === "reclass") {
    K.reclassify(K.group(b.dataset.g));
    K.toast("Past purchases re-judged against the current settings.");
    renderSetup();
  }
  else if (act === "refresh") {
    K.CAT.ready = false;
    K.loadCatalog((m) => m && K.toast(m)).then(() => { renderStoreFilter(); renderAll(); K.toast("Prices up to date."); });
  }
  else if (act === "export") doExport();
  else if (act === "import") $("importFile").click();
});

function saveCfg(name) {
  const g = K.group(name);
  const card = document.querySelector(`.card[data-g="${CSS.escape(name)}"]`);
  if (!g || !card) return;
  const val = (f) => card.querySelector(`.cfg[data-f="${f}"]`).value;

  const c = Number(val("expCount")), sz = Number(val("expSize")), un = val("expUnit").trim();
  if (c > 0 && sz > 0 && un) {
    if (K.toCanon(sz, un, g.canon) == null) {
      return K.toast(`"${un}" does not convert to ${g.canon}. Use g/kg, ml/cl/dl/L, or stk.`);
    }
    g.expect = { count: c, packSize: sz, packUnit: un };
  } else g.expect = null;

  g.shelfDays = Math.max(1, Number(val("shelfDays")) || g.shelfDays);
  g.openedDays = Math.max(1, Number(val("openedDays")) || g.openedDays);
  g.needDays = Math.max(0, Number(val("needDays")));
  g.minDiscount = Math.min(0.9, Math.max(0, Number(val("minDiscount")) / 100));
  g.halfLife = Math.max(1, Number(val("halfLife")) || g.halfLife);
  K.save();
  K.toast(`${name} saved.`);
  renderSetup();
}

function doExport() {
  const blob = new Blob([JSON.stringify(K.S, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kurv-backup-${K.todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.addEventListener("change", (e) => {
  if (e.target.id === "groupSel") { K.S.ui.group = e.target.value; K.save(); renderAll(); }
  if (e.target.id === "importFile") {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      try {
        const parsed = JSON.parse(t);
        if (!parsed.groups || !parsed.order) throw new Error("not a Kurv backup");
        K.S = parsed; K.save(); renderAll();
        K.toast("Backup restored.");
      } catch (err) { K.toast("That file is not a Kurv backup."); }
    });
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "q") { clearTimeout(searchTimer); searchTimer = setTimeout(renderSearch, 160); }
  if (e.target.closest("#buyModal")) updateBuyPreview();
});

/* ======================================================================= boot */

(async function boot() {
  setTab(K.S.ui.tab || "shop");
  $("results").innerHTML = `<div class="empty">Loading prices…</div>`;
  await K.loadCatalog((m) => { if (m) $("results").innerHTML = `<div class="empty">${esc(m)}</div>`; });
  if (K.CAT.error) $("results").innerHTML = `<div class="empty"><strong>No prices</strong>${esc(K.CAT.error)}</div>`;
  else $("results").innerHTML = "";
  renderStoreFilter();
  renderAll();
})();
