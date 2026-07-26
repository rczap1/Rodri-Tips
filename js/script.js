/* ═══════════════════════════════════════════
   RODRI TIPS — script.js
   ═══════════════════════════════════════════ */

const SC = { Tennis:'var(--tennis)', Handball:'var(--handball)', MMA:'var(--mma)', Football:'var(--football)' };
const SI = { Tennis:'🎾', Handball:'🤾', MMA:'🥊', Football:'⚽' };
const SL = { Tennis:'Ténis', Handball:'Andebol', MMA:'MMA', Football:'Futebol' };
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const SPORT_META = {
  Tennis:  { type:'individual', p1:'Jogador 1',   p2:'Jogador 2',   h1:'Favorito',       h2:'Underdog'        },
  Handball:{ type:'team',       p1:'Equipa Casa',  p2:'Equipa Fora', h1:'Equipa da casa', h2:'Equipa visitante', playerTeam: true },
  MMA:     { type:'individual', p1:'Lutador 1',    p2:'Lutador 2',   h1:'Favorito',       h2:'Underdog'        },
  Football:{ type:'team',       p1:'Equipa Casa',  p2:'Equipa Fora', h1:'Equipa da casa', h2:'Equipa visitante', playerTeam: true },
};

// ── STATE ────────────────────────────────────
let bets         = [];
let unitVal      = 10;
let settingsId   = null;
let editId       = null;
let selResult    = 'Pending';
let currentSport = 'Tennis';
let histSport    = 'all', histResult = 'all';
let pendingSport = 'all';
let analysisSport = 'Tennis', analysisMode = 'entity';
let betType   = null; // 'simple' | 'combo'
let comboLegs = [];
let bookmaker = null; // 22bet | Betano | Betclic | Bwin | Solverde
// isAdmin e ADMIN_EMAIL são definidos em index.html (junto da inicialização do Supabase)

// ── SUPABASE DATA LAYER ──────────────────────
// Todas as apostas vivem na tabela `bets` do Supabase (ver supabase/schema.sql) —
// partilhadas por todos os visitantes, não apenas guardadas neste browser.

async function loadBets() {
  const { data, error } = await window.supabase
    .from('bets')
    .select('*')
    .order('date', { ascending: false });
  if (error) { console.error('Erro ao carregar apostas:', error); return []; }
  return data;
}

async function refreshBets() {
  bets = await loadBets();
  renderAll();
}

refreshBets();

async function dbAdd(obj) {
  const { error } = await window.supabase.from('bets').insert(obj);
  if (error) throw error;
  await refreshBets();
}

async function dbUpdate(id, obj) {
  const { error } = await window.supabase.from('bets').update(obj).eq('id', id);
  if (error) throw error;
  await refreshBets();
}

async function dbDelete(id) {
  const { error } = await window.supabase.from('bets').delete().eq('id', id);
  if (error) throw error;
  await refreshBets();
}

// ── SETTINGS (valor da unidade — partilhado, tal como as apostas) ──
async function loadSettings() {
  const { data, error } = await window.supabase.from('settings').select('*').limit(1).single();
  if (error) { console.error('Erro ao carregar definições:', error); return; }
  settingsId = data.id;
  unitVal    = parseFloat(data.unit_value);
  updateUnitLabel();
  renderAll();
}

loadSettings();

// ── UNIT ─────────────────────────────────────
function openUnitModal() {
  document.getElementById('unit-input').value = unitVal;
  document.getElementById('unit-overlay').classList.add('open');
}
function setUnitPreset(v) { document.getElementById('unit-input').value = v; }
async function saveUnit() {
  // Verifica se é admin
  if (!window.isAdmin) {
    snack('⛔ Apenas o admin pode mudar o valor da unidade!');
    closeModal('unit-overlay');
    return;
  }

  const v = parseFloat(document.getElementById('unit-input').value);
  if (!v || v <= 0) { snack('⚠️ Valor inválido'); return; }
  if (!settingsId) { snack('⚠️ Definições ainda não carregaram, tenta outra vez'); return; }

  try {
    const { error } = await window.supabase.from('settings').update({ unit_value: v }).eq('id', settingsId);
    if (error) throw error;
    unitVal = v;
    updateUnitLabel();
    closeModal('unit-overlay');
    renderAll();
    snack('💶 1u = ' + unitVal + '€ guardado!');
  } catch(e) {
    snack('⚠️ Erro ao guardar: ' + e.message);
  }
}
function updateUnitLabel() {
  document.getElementById('unit-label').textContent = '1u = ' + unitVal + '€';
}

// ── ROUTING ──────────────────────────────────
function goTo(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-main button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  if (btn) { btn.classList.add('active'); }
  else {
    const idx = {dashboard:0,pending:1,analysis:2,history:3}[page];
    const bs = document.querySelectorAll('.nav-main button');
    if (bs[idx]) bs[idx].classList.add('active');
  }
  renderAll();
}

// ── MODAL SPORT ──────────────────────────────
function selectSport(btn) {
  currentSport = btn.dataset.sport;
  document.querySelectorAll('.sport-sel-btn').forEach(b => {
    b.className = 'sport-sel-btn';
    if (b.dataset.sport === currentSport) b.classList.add('sel-' + currentSport);
  });
  updateModalForSport(currentSport);
  if (betType === 'combo') renderComboLegs();
}

function updateModalForSport(sport) {
  const meta = SPORT_META[sport];
  document.getElementById('lbl-p1').textContent = meta.p1;
  document.getElementById('lbl-p2').textContent = meta.p2;
  // Show/hide player-team row
  const teamRow = document.getElementById('player-team-row');
  if (meta.playerTeam) {
    teamRow.style.display = 'grid';
    document.getElementById('lbl-player').textContent  = sport === 'Football' ? 'Nome do Jogador (opcional)' : 'Jogador a apostar (opcional)';
    document.getElementById('lbl-pteam').textContent   = sport === 'Football' ? 'Equipa do Jogador' : 'Equipa do Jogador';
  } else {
    teamRow.style.display = 'none';
    document.getElementById('f-player').value = '';
    document.getElementById('f-pteam').value  = '';
  }
}

// ── COMBINADAS ───────────────────────────────
function emptyLeg() { return { comp:'', p1:'', p2:'', bet:'', player:'', pteam:'', result:'Pending' }; }

function chooseBetType(type) {
  betType = type;
  document.getElementById('bet-type-choice').style.display     = 'none';
  document.getElementById('simple-form-fields').style.display  = type === 'simple' ? 'grid' : 'none';
  document.getElementById('combo-form-fields').style.display   = type === 'combo'  ? 'grid' : 'none';
  if (type === 'combo') {
    if (!comboLegs.length) comboLegs.push(emptyLeg());
    renderComboLegs();
  }
}

function comboResult(legs) {
  if (legs.some(l => l.result === 'Lost'))    return 'Lost';
  if (legs.some(l => l.result === 'Pending')) return 'Pending';
  if (legs.every(l => l.result === 'Void'))   return 'Void';
  return 'Win';
}

function updateLeg(i, field, value) { comboLegs[i][field] = value; }

function setLegResult(i, v) { comboLegs[i].result = v; renderComboLegs(); }

function addLeg() { comboLegs.push(emptyLeg()); renderComboLegs(); }

function removeLeg(i) {
  comboLegs.splice(i, 1);
  if (!comboLegs.length) comboLegs.push(emptyLeg());
  renderComboLegs();
}

function renderComboLegs() {
  const meta = SPORT_META[currentSport];
  document.getElementById('combo-legs').innerHTML = comboLegs.map((leg, i) => `
    <div style="border:1px solid var(--border);border-radius:8px;padding:1rem;margin-bottom:0.8rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem">
        <span class="hint" style="margin:0">Seleção ${i + 1}</span>
        <button type="button" class="abtn los" onclick="removeLeg(${i})">🗑️</button>
      </div>
      <div class="form-grid">
        <div class="fg full">
          <label>Competição</label>
          <input type="text" value="${esc(leg.comp)}" oninput="updateLeg(${i},'comp',this.value)">
        </div>

        <div class="vs-row">
          <div class="fg">
            <label>${meta.p1}</label>
            <input type="text" value="${esc(leg.p1)}" oninput="updateLeg(${i},'p1',this.value)">
          </div>
          <div class="vs-badge">VS</div>
          <div class="fg">
            <label>${meta.p2}</label>
            <input type="text" value="${esc(leg.p2)}" oninput="updateLeg(${i},'p2',this.value)">
          </div>
        </div>

        <div class="fg full">
          <label>Aposta / Mercado</label>
          <input type="text" value="${esc(leg.bet)}" oninput="updateLeg(${i},'bet',this.value)">
        </div>

        ${meta.playerTeam ? `
        <div style="display:grid;grid-template-columns:1fr 0.8fr;gap:0.5rem;grid-column:span 2">
          <div class="fg">
            <label>${currentSport === 'Football' ? 'Nome do Jogador (opcional)' : 'Jogador a apostar (opcional)'}</label>
            <input type="text" value="${esc(leg.player)}" oninput="updateLeg(${i},'player',this.value)">
          </div>
          <div class="fg">
            <label>Equipa do Jogador</label>
            <input type="text" value="${esc(leg.pteam)}" oninput="updateLeg(${i},'pteam',this.value)">
          </div>
        </div>` : ''}

        <div class="fg full">
          <label>Resultado</label>
          <div class="resolve-row">
            <button type="button" class="res-opt ${leg.result==='Pending'?'sel':''}" data-v="Pending" onclick="setLegResult(${i},'Pending')">⏳ Pendente</button>
            <button type="button" class="res-opt ${leg.result==='Win'?'sel':''}"     data-v="Win"     onclick="setLegResult(${i},'Win')">✅ Ganhou</button>
            <button type="button" class="res-opt ${leg.result==='Lost'?'sel':''}"    data-v="Lost"    onclick="setLegResult(${i},'Lost')">❌ Perdeu</button>
            <button type="button" class="res-opt ${leg.result==='Void'?'sel':''}"    data-v="Void"    onclick="setLegResult(${i},'Void')">↩️ Void</button>
          </div>
        </div>
      </div>
    </div>`).join('');
}

// ── MODAL OPEN / CLOSE / SAVE ─────────────────
function openModal(docId = null) {
  // Verifica se é admin
  if (!window.isAdmin) {
    snack('⛔ Apenas o admin pode adicionar/editar apostas!');
    return;
  }

  editId    = docId;
  selResult = 'Pending';
  betType   = null;
  comboLegs = [];
  bookmaker = null;
  const today = new Date().toISOString().split('T')[0];

  document.getElementById('bet-type-choice').style.display    = 'block';
  document.getElementById('simple-form-fields').style.display = 'none';
  document.getElementById('combo-form-fields').style.display  = 'none';

  if (docId) {
    const b = bets.find(x => x.id === docId);
    if (!b) return;
    document.getElementById('modal-title').textContent = 'Editar Aposta';
    currentSport = b.sport;
    bookmaker    = b.bookmaker || null;
    document.getElementById('f-date').value = b.date;

    if (b.bet_type === 'combo') {
      document.getElementById('f-combo-units').value = b.units;
      document.getElementById('f-combo-odds').value  = b.odds;
      comboLegs = (b.legs || []).map(l => ({ ...emptyLeg(), ...l }));
    } else {
      document.getElementById('f-comp').value   = b.comp   || '';
      document.getElementById('f-p1').value     = b.p1     || '';
      document.getElementById('f-p2').value     = b.p2     || '';
      document.getElementById('f-bet').value    = b.bet    || '';
      document.getElementById('f-units').value  = b.units;
      document.getElementById('f-odds').value   = b.odds;
      const playerEl = document.getElementById('f-player');
      const pteamEl = document.getElementById('f-pteam');
      if (playerEl) playerEl.value = b.player || '';
      if (pteamEl) pteamEl.value = b.pteam || '';
      selResult = b.result;
    }
  } else {
    document.getElementById('modal-title').textContent = 'Nova Aposta';
    currentSport = 'Tennis';
    document.getElementById('f-date').value   = today;
    document.getElementById('f-units').value  = '0.5';
    ['f-comp','f-p1','f-p2','f-bet','f-odds','f-player','f-pteam','f-combo-units','f-combo-odds'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    selResult = 'Pending';
  }

  document.querySelectorAll('.sport-sel-btn').forEach(b => {
    b.className = 'sport-sel-btn';
    if (b.dataset.sport === currentSport) b.classList.add('sel-' + currentSport);
  });
  updateModalForSport(currentSport);
  updateResUI();
  updateBookUI();
  if (docId) chooseBetType(bets.find(x => x.id === docId).bet_type || 'simple');
  document.getElementById('bet-overlay').classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  editId = null;
}

function selRes(btn)   { selResult = btn.dataset.v; updateResUI(); }
function updateResUI() { document.querySelectorAll('#simple-form-fields .res-opt[data-v]').forEach(b => b.classList.toggle('sel', b.dataset.v === selResult)); }

function selBook(btn)   { bookmaker = btn.dataset.book; updateBookUI(); }
function updateBookUI() { document.querySelectorAll('.book-opt').forEach(b => b.classList.toggle('sel', b.dataset.book === bookmaker)); }

async function saveBet() {
  // Verifica se é admin
  if (!window.isAdmin) {
    snack('⛔ Apenas o admin pode adicionar apostas!');
    closeModal('bet-overlay');
    return;
  }

  if (!betType) { snack('⚠️ Escolhe o tipo de aposta'); return; }

  const date = document.getElementById('f-date').value.trim();
  if (!date) { snack('⚠️ Preenche a data'); return; }

  if (betType === 'combo') {
    const units = parseFloat(document.getElementById('f-combo-units').value);
    const odds  = parseFloat(document.getElementById('f-combo-odds').value);

    if (isNaN(units) || units <= 0)  { snack('⚠️ Units inválidas'); return; }
    if (isNaN(odds)  || odds < 1.01) { snack('⚠️ Odd total inválida (mín. 1.01)'); return; }

    const legs = comboLegs
      .map(l => ({
        comp: l.comp.trim(), p1: l.p1.trim(), p2: l.p2.trim(), bet: l.bet.trim(),
        player: l.player.trim(), pteam: l.pteam.trim(), result: l.result
      }))
      .filter(l => l.p1 && l.p2 && l.bet);

    if (!legs.length) { snack('⚠️ Adiciona pelo menos uma seleção completa'); return; }

    const obj = {
      date, sport: currentSport, comp: null,
      p1: null, p2: null, event: null, bet: null,
      units, odds, result: comboResult(legs),
      player: null, pteam: null, bookmaker,
      bet_type: 'combo', legs
    };

    try {
      if (editId) { await dbUpdate(editId, obj); snack('✅ Combinada atualizada!'); }
      else        { await dbAdd(obj);            snack('🧩 Combinada guardada!'); }
      closeModal('bet-overlay');
    } catch(e) {
      console.error(e);
      snack('⚠️ Erro ao guardar: ' + e.message);
    }
    return;
  }

  const comp   = document.getElementById('f-comp').value.trim();
  const p1     = document.getElementById('f-p1').value.trim();
  const p2     = document.getElementById('f-p2').value.trim();
  const bet    = document.getElementById('f-bet').value.trim();
  const units  = parseFloat(document.getElementById('f-units').value);
  const odds   = parseFloat(document.getElementById('f-odds').value);
  const player = document.getElementById('f-player').value.trim();
  const pteam  = document.getElementById('f-pteam').value.trim();

  if (!p1 || !p2 || !bet || !units || !odds) {
    snack('⚠️ Preenche: confronto, aposta, units e odd'); return;
  }
  if (isNaN(units) || units <= 0)  { snack('⚠️ Units inválidas'); return; }
  if (isNaN(odds)  || odds < 1.01) { snack('⚠️ Odd inválida (mín. 1.01)'); return; }

  const obj = {
    date, sport: currentSport, comp,
    p1, p2, event: p1 + ' - ' + p2,
    bet, units, odds, result: selResult,
    player, pteam, bookmaker, bet_type: 'simple'
  };

  try {
    if (editId) { await dbUpdate(editId, obj); snack('✅ Aposta atualizada!'); }
    else        { await dbAdd(obj);            snack('🎯 Aposta guardada!'); }
    closeModal('bet-overlay');
  } catch(e) {
    console.error(e);
    snack('⚠️ Erro ao guardar: ' + e.message);
  }
}

async function quickResolveLeg(betId, legIndex, result) {
  const b = bets.find(x => x.id === betId);
  if (!b || !b.legs) return;
  const newLegs = b.legs.map((l, i) => i === legIndex ? { ...l, result } : l);
  try {
    await dbUpdate(betId, { legs: newLegs, result: comboResult(newLegs) });
    snack('✅ Resultado atualizado!');
  } catch(e) {
    snack('⚠️ Erro: ' + e.message);
  }
}

async function deleteBet(docId) {
  if (!confirm('Eliminar esta aposta?')) return;
  try { await dbDelete(docId); snack('🗑️ Eliminada'); }
  catch(e) { snack('⚠️ Erro: ' + e.message); }
}

async function quickResolve(docId, res) {
  try { await dbUpdate(docId, { result: res }); snack('✅ Resultado atualizado!'); }
  catch(e) { snack('⚠️ Erro: ' + e.message); }
}

// ── CALCS ────────────────────────────────────
function calcNet(b) {
  if (b.result === 'Win')  return +((b.units * b.odds) - b.units).toFixed(4);
  if (b.result === 'Lost') return -b.units;
  return 0;
}

function getStats(arr) {
  const closed   = arr.filter(b => b.result !== 'Pending');
  const wins     = closed.filter(b => b.result === 'Win').length;
  const losses   = closed.filter(b => b.result === 'Lost').length;
  const voids    = closed.filter(b => b.result === 'Void').length;
  const bettable = closed.filter(b => b.result !== 'Void');
  const unitsOut = bettable.reduce((s, b) => s + b.units, 0);
  const profit   = bettable.reduce((s, b) => s + calcNet(b), 0);
  const roi      = unitsOut > 0 ? profit / unitsOut * 100 : 0;
  const wr       = (wins + losses) > 0 ? wins / (wins + losses) * 100 : 0;
  const settled  = closed.filter(b => b.result !== 'Void');
  const avgOdd   = settled.length ? settled.reduce((s, b) => s + b.odds, 0) / settled.length : 0;
  return { wins, losses, voids, unitsOut, profit, roi, wr, avgOdd };
}

function groupBy(arr, fn) {
  const map = {};
  arr.forEach(b => {
    const k = fn(b);
    if (!k) return;
    if (!map[k]) map[k] = { key: k, bets: [] };
    map[k].bets.push(b);
  });
  return Object.values(map);
}

// ── RENDER ───────────────────────────────────
function renderAll() {
  updateUnitLabel();
  renderDashboard();
  renderPending();
  renderAnalysis();
  renderHistory();
}

function renderDashboard() {
  const now = new Date();
  document.getElementById('dash-date').textContent =
    now.toLocaleDateString('pt-PT', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  document.getElementById('chart-year').textContent = now.getFullYear();

  const closed  = bets.filter(b => b.result !== 'Pending' && b.result !== 'Void');
  const s       = getStats(closed);
  const allS    = getStats(bets.filter(b => b.result !== 'Pending'));
  const pending = bets.filter(b => b.result === 'Pending');

  const pe = document.getElementById('s-profit');
  pe.textContent = (s.profit >= 0 ? '+' : '') + s.profit.toFixed(2) + 'u';
  pe.className   = 'stat-value ' + (s.profit >= 0 ? 'text-green' : 'text-red');
  document.getElementById('s-profit-eur').textContent =
    (s.profit * unitVal >= 0 ? '+' : '') + (s.profit * unitVal).toFixed(2) + '€ · ROI ' + s.roi.toFixed(1) + '%';
  document.getElementById('s-wr').textContent     = s.wr.toFixed(0) + '%';
  document.getElementById('s-record').textContent = s.wins + 'W / ' + s.losses + 'L / ' + allS.voids + 'V';
  document.getElementById('s-total').textContent  = bets.length;
  document.getElementById('s-pcount').textContent = pending.length + ' pendentes';
  document.getElementById('s-units').textContent  = allS.unitsOut.toFixed(1) + 'u';
  document.getElementById('s-avg-odd').textContent= 'Odd média: ' + (allS.avgOdd > 0 ? allS.avgOdd.toFixed(2) : '—');

  document.getElementById('sport-breakdown').innerHTML = Object.keys(SI).map(sp => {
    const sb = bets.filter(b => b.sport === sp && b.result !== 'Pending' && b.result !== 'Void');
    const ss = getStats(sb);
    return `<div class="sport-card" style="--sc:${SC[sp]}">
      <div class="sport-name">${SI[sp]} ${SL[sp]}</div>
      <div class="sport-stat-row"><span class="ssk">Lucro</span><span class="ssv ${ss.profit>=0?'text-green':'text-red'}">${ss.profit>=0?'+':''}${ss.profit.toFixed(2)}u</span></div>
      <div class="sport-stat-row"><span class="ssk">ROI</span><span class="ssv">${ss.roi.toFixed(1)}%</span></div>
      <div class="sport-stat-row"><span class="ssk">Record</span><span class="ssv">${ss.wins}W/${ss.losses}L</span></div>
      <div class="win-bar-bg"><div class="win-bar-fill" style="width:${Math.min(ss.wr,100)}%"></div></div>
    </div>`;
  }).join('');

  const year = now.getFullYear();
  const monthly = Array(12).fill(0);
  bets.filter(b => b.result !== 'Pending' && b.result !== 'Void' &&
    new Date(b.date + 'T12:00:00').getFullYear() === year)
    .forEach(b => { monthly[new Date(b.date + 'T12:00:00').getMonth()] += calcNet(b); });
  const maxA = Math.max(...monthly.map(Math.abs), 0.01);
  document.getElementById('month-chart').innerHTML = monthly.map((v, i) => {
    const h = Math.max(Math.abs(v) / maxA * 78, v !== 0 ? 4 : 2);
    return `<div class="month-bar-wrap">
      <div class="month-bar ${v>=0?'pos':'neg'}" style="height:${h}px" title="${MONTHS[i]}: ${v>=0?'+':''}${v.toFixed(2)}u"></div>
      <div class="month-label">${MONTHS[i]}</div>
    </div>`;
  }).join('');

  document.getElementById('dash-pending').innerHTML = pending.slice(0,6).length
    ? pending.slice(0,6).map(pendingCard).join('')
    : '<div class="empty"><div class="empty-icon">🎯</div>Sem apostas pendentes</div>';
}

function setPendingTab(sport, btn) {
  pendingSport = sport;
  document.querySelectorAll('#pending-tabs .sport-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPending();
}

function renderPending() {
  const all = bets.filter(b => b.result === 'Pending');
  Object.keys(SI).forEach(s => {
    const el = document.getElementById('pt-' + s);
    if (el) el.textContent = all.filter(b => b.sport === s).length;
  });
  const elAll = document.getElementById('pt-all');
  if (elAll) elAll.textContent = all.length;
  const filtered = pendingSport === 'all' ? all : all.filter(b => b.sport === pendingSport);
  document.getElementById('pending-list').innerHTML = filtered.length
    ? filtered.map(pendingCard).join('')
    : '<div class="empty"><div class="empty-icon">🎯</div>Sem apostas pendentes</div>';
}

const LEG_ICON = { Pending:'⏳', Win:'✅', Lost:'❌', Void:'↩️' };

function pendingCard(b) {
  const pot  = (b.units * b.odds).toFixed(2);
  const potE = (b.units * b.odds * unitVal).toFixed(2);

  if (b.bet_type === 'combo') {
    const legsHtml = (b.legs || []).map((l, i) => `
      <div${i > 0 ? ' style="margin-top:0.8rem;padding-top:0.8rem;border-top:1px solid var(--border)"' : ''}>
        <div class="pcard-event"${i > 0 ? ' style="padding-right:0"' : ''}>${esc(l.p1)} <span style="color:var(--muted);font-size:0.72rem">vs</span> ${esc(l.p2)}</div>
        <div class="pcard-bet">${esc(l.bet)}</div>
        ${l.player ? `<div style="margin-top:0.25rem;font-size:0.68rem;font-family:'DM Mono',monospace;color:var(--muted2)">👤 ${esc(l.player)}${l.pteam?` <span style="color:var(--muted)">(${esc(l.pteam)})</span>`:''}</div>` : ''}
        <div class="pcard-actions" style="margin-top:0.5rem">
          ${window.isAdmin ? `
          <button class="abtn win" onclick="quickResolveLeg('${b.id}',${i},'Win')">✅</button>
          <button class="abtn los" onclick="quickResolveLeg('${b.id}',${i},'Lost')">❌</button>
          <button class="abtn"     onclick="quickResolveLeg('${b.id}',${i},'Void')">↩️</button>
          ` : ''}
        </div>
      </div>`).join('');

    return `<div class="pcard" style="--pc:${SC[b.sport]}">
      <div class="pcard-tag">⏳ PENDENTE</div>
      <div style="margin-bottom:0.35rem"><span class="spill ${b.sport}"><span class="dot"></span>${SI[b.sport]} ${SL[b.sport]}</span></div>
      ${legsHtml}
      <div class="pcard-footer" style="margin-top:0.7rem">
        <div><div class="pstat-label">Odd Total</div><div class="pstat-val">${b.odds.toFixed(2)}</div></div>
        <div><div class="pstat-label">Units</div><div class="pstat-val">${b.units}u</div></div>
        <div><div class="pstat-label">Retorno</div><div class="pstat-val">${pot}u</div></div>
        <div><div class="pstat-label">Em €</div><div class="pstat-val">${potE}€</div></div>
      </div>
      <div class="pcard-meta">
        <span>${esc(b.comp)||'—'} · ${fmtDate(b.date)}${b.bookmaker ? ' · ' + esc(b.bookmaker) : ''}</span>
        ${window.isAdmin ? `
        <div class="pcard-actions">
          <button class="abtn" onclick="openModal('${b.id}')">✏️</button>
        </div>` : ''}
      </div>
    </div>`;
  }

  // Show player + team badge if present
  const playerBadge = b.player
    ? `<div style="margin-top:0.3rem;font-size:0.68rem;font-family:'DM Mono',monospace;color:var(--muted2)">
         👤 ${esc(b.player)}${b.pteam ? ` <span style="color:var(--muted)">(${esc(b.pteam)})</span>` : ''}
       </div>`
    : '';
  return `<div class="pcard" style="--pc:${SC[b.sport]}">
    <div class="pcard-tag">⏳ PENDENTE</div>
    <div style="margin-bottom:0.35rem"><span class="spill ${b.sport}"><span class="dot"></span>${SI[b.sport]} ${SL[b.sport]}</span></div>
    <div class="pcard-event">${esc(b.p1)||''} <span style="color:var(--muted);font-size:0.72rem">vs</span> ${esc(b.p2)||''}</div>
    <div class="pcard-bet">${esc(b.bet)}</div>
    ${playerBadge}
    <div class="pcard-footer" style="margin-top:0.7rem">
      <div><div class="pstat-label">Odd</div><div class="pstat-val">${b.odds.toFixed(2)}</div></div>
      <div><div class="pstat-label">Units</div><div class="pstat-val">${b.units}u</div></div>
      <div><div class="pstat-label">Retorno</div><div class="pstat-val">${pot}u</div></div>
      <div><div class="pstat-label">Em €</div><div class="pstat-val">${potE}€</div></div>
    </div>
    <div class="pcard-meta">
      <span>${esc(b.comp)||'—'} · ${fmtDate(b.date)}${b.bookmaker ? ' · ' + esc(b.bookmaker) : ''}</span>
      ${window.isAdmin ? `
      <div class="pcard-actions">
        <button class="abtn win" onclick="quickResolve('${b.id}','Win')">✅</button>
        <button class="abtn los" onclick="quickResolve('${b.id}','Lost')">❌</button>
        <button class="abtn"     onclick="quickResolve('${b.id}','Void')">↩️</button>
        <button class="abtn"     onclick="openModal('${b.id}')">✏️</button>
      </div>` : ''}
    </div>
  </div>`;
}

function setAnalysisTab(sport, btn) {
  analysisSport = sport;
  document.querySelectorAll('#analysis-sport-tabs .sport-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAnalysis();
}

function setAnalysisMode(mode, btn) {
  analysisMode = mode;
  document.querySelectorAll('#analysis-subtabs .sub-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAnalysis();
}

function renderComboAnalysis() {
  const combos = bets.filter(b => b.sport === analysisSport && b.bet_type === 'combo' && b.result !== 'Pending');

  document.getElementById('analysis-content').innerHTML = `
    <div class="analysis-wrap">
      <div class="analysis-header">
        <div>
          <div class="analysis-title">Combinadas — ${SI[analysisSport]} ${SL[analysisSport]}</div>
          <div style="font-size:0.65rem;color:var(--muted);font-family:'DM Mono',monospace;margin-top:0.2rem">Desempenho por bilhete (não decomposto por seleção)</div>
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted)">${combos.length} combinadas</div>
      </div>

      <table class="analysis-table">
        <thead><tr><th>Data</th><th>Seleções</th><th>Odd</th><th>Units</th><th>Resultado</th><th>Lucro (u)</th><th>Lucro (€)</th></tr></thead>
        <tbody>${!combos.length
          ? `<tr><td colspan="7"><div class="empty">Sem combinadas ainda.</div></td></tr>`
          : combos.slice().sort((a,b) => b.date.localeCompare(a.date)).map(b => {
              const net = calcNet(b);
              const rl  = {Win:'✅ Win',Lost:'❌ Lost',Void:'↩️ Void'}[b.result] || b.result;
              const legsStr = (b.legs||[]).map(l => `${LEG_ICON[l.result]} ${esc(l.p1)} vs ${esc(l.p2)}`).join('<br>');
              return `<tr>
                <td class="mono text-muted" style="font-size:0.7rem">${fmtDate(b.date)}</td>
                <td style="font-size:0.68rem">${legsStr}</td>
                <td class="mono">${b.odds.toFixed(2)}</td>
                <td class="mono">${b.units}u</td>
                <td><span class="rbadge ${b.result}">${rl}</span></td>
                <td class="mono ${net>=0?'text-green':'text-red'}">${net>=0?'+':''}${net.toFixed(2)}u</td>
                <td class="mono ${net>=0?'text-green':'text-red'}">${(net*unitVal>=0?'+':'')+(net*unitVal).toFixed(2)}€</td>
              </tr>`;
            }).join('')
        }</tbody>
      </table>
    </div>`;
}

function renderAnalysis() {
  if (analysisMode === 'combos') { renderComboAnalysis(); return; }

  const sportBets = bets.filter(b => b.sport === analysisSport && b.result !== 'Pending' && b.bet_type !== 'combo');
  let groups = [], title = '', subtitle = '';

  // Helper: check if a label is a market type (not an entity)
  const isMarketType = (label) => {
    return /^(Over|Under|ML|Handicap|KO\/TKO|BTTS|Mercado)$/.test(label);
  };

  if (analysisMode === 'entity') {
    // For team sports: prefer player field, otherwise resolve the selected team/player from the bet text.
    // For individual sports: resolve the selected player from the bet text, or the market when no player is named.
    const map = {};
    const meta = SPORT_META[analysisSport];

    const inferEntityLabel = (b) => {
      const betText = (b.bet || '').toLowerCase();

      if (meta.playerTeam) {
        if (b.player) return b.pteam ? `${b.player} (${b.pteam})` : b.player;

        const teamCandidates = [b.p1, b.p2].filter(Boolean);
        for (const team of teamCandidates) {
          const teamKey = team.split(' ')[0].toLowerCase();
          if (betText.includes(teamKey) || betText.includes(team.toLowerCase())) return team;
        }

        if (/\bases\b|\baces?\b/i.test(b.bet || '')) return 'Ases';
        if (/\bover\b/i.test(b.bet || '')) return 'Over';
        if (/\bunder\b/i.test(b.bet || '')) return 'Under';
        if (/\bml\b/i.test(b.bet || '')) return 'ML';
        if (/handicap/i.test(b.bet || '')) return 'Handicap';
        if (/ko\/tko|by\s+ko/i.test(b.bet || '')) return 'KO/TKO';
        return 'Mercado';
      }

      const playerCandidates = [b.p1, b.p2].filter(Boolean);
      for (const name of playerCandidates) {
        const firstToken = name.split(' ')[0].toLowerCase();
        if (betText.includes(firstToken) || betText.includes(name.toLowerCase())) return name;
      }

      if (/\bases\b|\baces?\b/i.test(b.bet || '')) return 'Ases';
      if (/\bover\b/i.test(b.bet || '')) return 'Over';
      if (/\bunder\b/i.test(b.bet || '')) return 'Under';
      if (/\bml\b/i.test(b.bet || '')) return 'ML';
      if (/handicap/i.test(b.bet || '')) return 'Handicap';
      if (/ko\/tko|by\s+ko/i.test(b.bet || '')) return 'KO/TKO';
      if (/btts|ambas\s+marcam/i.test(b.bet || '')) return 'BTTS';
      return 'Mercado';
    };

    if (meta.playerTeam) {
      sportBets.forEach(b => {
        const key = inferEntityLabel(b);
        if (!map[key]) map[key] = { key, bets: [] };
        map[key].bets.push(b);
      });
    } else {
      // Tennis / MMA: group by the selected player when mentioned. Skip pure market bets.
      sportBets.forEach(b => {
        const key = inferEntityLabel(b);
        if (!isMarketType(key)) {
          if (!map[key]) map[key] = { key, bets: [] };
          map[key].bets.push(b);
        }
      });
    }

    groups   = Object.values(map);
    // Note: Don't regroup if empty - entity view should show nothing for pure market bets
    title    = meta.playerTeam ? 'Jogadores & Equipas' : (analysisSport === 'MMA' ? 'Lutadores' : 'Jogadores');
    subtitle = 'Apostas por entidade';

  } else if (analysisMode === 'market') {
    groups = groupBy(sportBets, b => {
      const bt = b.bet || '';
      if (/\bML\b/i.test(bt))                 return 'ML (Match Winner)';
      if (/\b1X2\b|home|away|draw/i.test(bt)) return '1X2';
      if (/BTTS|ambas\s+marcam/i.test(bt))    return 'BTTS';
      if (/\bases\b|\baces?\b/i.test(bt))     return 'Ases';
      if (/Over\s*\d/i.test(bt))              return 'Over';
      if (/Under\s*\d/i.test(bt))             return 'Under';
      if (/handicap|[+-]\d/i.test(bt))        return 'Handicap';
      if (/by\s+ko|ko\/tko/i.test(bt))        return 'KO/TKO';
      if (/marca|golo|scorer/i.test(bt))      return 'Marcador';
      return 'Outro';
    });
    title = 'Tipos de Mercado';
  } else {
    groups = groupBy(sportBets, b => b.comp || 'Sem competição');
    title  = 'Competições';
  }

  groups.sort((a, b) =>
    b.bets.reduce((s, x) => s + calcNet(x), 0) - a.bets.reduce((s, x) => s + calcNet(x), 0)
  );
  const maxP = Math.max(...groups.map(g => Math.abs(g.bets.reduce((s,x) => s+calcNet(x), 0))), 0.01);

  document.getElementById('analysis-content').innerHTML = `
    <div class="analysis-wrap">
      <div class="analysis-header">
        <div>
          <div class="analysis-title">${title} — ${SI[analysisSport]} ${SL[analysisSport]}</div>
          ${subtitle?`<div style="font-size:0.65rem;color:var(--muted);font-family:'DM Mono',monospace;margin-top:0.2rem">${subtitle}</div>`:''}
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted)">${groups.length} entradas · ${sportBets.length} apostas</div>
      </div>
      <table class="analysis-table">
        <thead><tr><th>#</th><th>${title}</th><th>Apostas</th><th>W/L</th><th>Win%</th><th>Odd Méd.</th><th>Units</th><th>Lucro (u)</th><th>Lucro (€)</th><th>ROI</th><th>Tendência</th></tr></thead>
        <tbody>${!groups.length
          ? `<tr><td colspan="11"><div class="empty">Sem dados ainda.<br>Regista as tuas primeiras apostas!</div></td></tr>`
          : groups.map((g,i) => {
              const profit = g.bets.reduce((s,x) => s+calcNet(x), 0);
              const st     = getStats(g.bets);
              const roi    = st.unitsOut > 0 ? profit/st.unitsOut*100 : 0;
              const avg    = g.bets.length ? g.bets.reduce((s,b)=>s+b.odds,0)/g.bets.length : 0;
              const barW   = Math.min(Math.abs(profit)/maxP*100, 100);
              const barC   = profit >= 0 ? 'var(--win)' : 'var(--loss)';
              return `<tr>
                <td style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted);width:28px">${i+1}</td>
                <td><div class="entity-name">${esc(g.key)}</div></td>
                <td class="mono">${g.bets.length}</td>
                <td class="mono text-muted">${st.wins}W/${st.losses}L</td>
                <td class="mono">${st.wr.toFixed(0)}%</td>
                <td class="mono">${avg.toFixed(2)}</td>
                <td class="mono">${st.unitsOut.toFixed(1)}u</td>
                <td class="mono ${profit>=0?'text-green':'text-red'}">${profit>=0?'+':''}${profit.toFixed(2)}u</td>
                <td class="mono ${profit>=0?'text-green':'text-red'}">${(profit*unitVal>=0?'+':'')+(profit*unitVal).toFixed(2)}€</td>
                <td class="mono ${roi>=0?'text-green':'text-red'}">${roi>=0?'+':''}${roi.toFixed(1)}%</td>
                <td style="min-width:80px"><div class="mini-bar-bg"><div class="mini-bar-fill" style="width:${barW}%;background:${barC}"></div></div></td>
              </tr>`;
            }).join('')
        }</tbody>
      </table>
    </div>`;
}

function setHistoryTab(sport, btn) {
  histSport = sport;
  document.querySelectorAll('#history-sport-tabs .sport-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHistory();
}

function setResultFilter(res, btn) {
  histResult = res;
  document.querySelectorAll('.filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHistory();
}

// ══════════════════════════════════════════
// AUTENTICAÇÃO (Login/Signup/Logout)
// ══════════════════════════════════════════

function openLoginModal() {
  document.getElementById('login-overlay').classList.add('open');
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('login-error').style.display = 'none';
}

async function loginUser() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');

  if (!email || !password) {
    errorDiv.textContent = '⚠️ Preenche email e password!';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    const { data, error } = await window.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user && data.user.email !== ADMIN_EMAIL) {
      await window.supabase.auth.signOut();
      errorDiv.textContent = '⛔ Só o admin pode entrar.';
      errorDiv.style.display = 'block';
      return;
    }
    errorDiv.style.display = 'none';
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-overlay').classList.remove('open');
    snack('✅ Login feito com sucesso!');
  } catch (error) {
    errorDiv.textContent = '❌ Erro: ' + (error.message === 'Invalid login credentials'
      ? 'Email ou password incorretos'
      : error.message);
    errorDiv.style.display = 'block';
  }
}

async function logout() {
  try {
    await window.supabase.auth.signOut();
    snack('👋 Logout feito!');
  } catch (error) {
    snack('❌ Erro ao fazer logout: ' + error.message);
  }
}

function renderHistory() {
  let filtered = [...bets];
  if (histSport  !== 'all') filtered = filtered.filter(b => b.sport  === histSport);
  if (histResult !== 'all') filtered = filtered.filter(b => b.result === histResult);
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  const tbody = document.getElementById('bet-tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:2.5rem;color:var(--muted);font-family:monospace;font-size:0.75rem">Sem apostas nesta categoria</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(b => {
    const net    = calcNet(b);
    const netStr = b.result === 'Pending' ? '—' : (net>=0?'+':'')+net.toFixed(2)+'u';
    const netE   = b.result === 'Pending' ? '—' : (net*unitVal>=0?'+':'')+(net*unitVal).toFixed(2)+'€';
    const nc     = net > 0 ? 'text-green' : net < 0 ? 'text-red' : 'text-muted';
    const rl     = {Win:'✅ Win',Lost:'❌ Lost',Pending:'⏳ Pend.',Void:'↩️ Void'}[b.result]||b.result;
    const isCombo = b.bet_type === 'combo';
    const confronto = isCombo
      ? `🧩 Combinada (${(b.legs||[]).length}x)`
      : (b.p1 && b.p2
          ? `<span style="font-weight:600">${esc(b.p1)}</span> <span style="color:var(--muted);font-size:0.65rem">vs</span> <span style="font-weight:600">${esc(b.p2)}</span>`
          : esc(b.event) || '—');
    // Combinadas não têm bet/comp ao nível do bilhete — resume as seleções
    const legBets = isCombo ? (b.legs || []).map(l => l.bet).filter(Boolean) : [];
    const legComps = isCombo ? [...new Set((b.legs || []).map(l => l.comp).filter(Boolean))] : [];
    const apostaCell = isCombo ? (legBets.join(' + ') || '—') : b.bet;
    const compCell   = isCombo ? (legComps.length > 1 ? 'Vários' : (legComps[0] || '—')) : (b.comp || '—');
    // Combinadas mostram só o resumo aqui — o detalhe por seleção já está em
    // Análise → Combinadas e nos cartões de Pendentes.
    // Junta jogador/casa numa única 2ª linha, sempre presente (vazia se preciso),
    // para todas as linhas da tabela terem sempre a mesma altura.
    const secondaryParts = [];
    if (!isCombo && b.player) secondaryParts.push(`👤 ${esc(b.player)}${b.pteam?` (${esc(b.pteam)})`:''}`);
    if (b.bookmaker) secondaryParts.push(`🏠 ${esc(b.bookmaker)}`);
    const secondaryLine = `<div style="font-size:0.62rem;color:var(--muted2);font-family:'DM Mono',monospace;margin-top:0.2rem;min-height:1em">${secondaryParts.join(' · ') || '&nbsp;'}</div>`;
    return `<tr>
      <td class="mono text-muted" style="font-size:0.7rem">${fmtDate(b.date)}</td>
      <td><span class="spill ${b.sport}"><span class="dot"></span>${SI[b.sport]}</span></td>
      <td style="max-width:160px">
        <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${confronto}</div>
        ${secondaryLine}
      </td>
      <td style="max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'DM Mono',monospace;font-size:0.7rem;color:var(--muted2)" title="${esc(apostaCell)}">${esc(apostaCell)}</td>
      <td style="font-size:0.67rem;color:var(--muted);font-family:'DM Mono',monospace;max-width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(compCell)}">${esc(compCell)}</td>
      <td class="mono text-right">${b.units}u</td>
      <td class="mono text-right">${b.odds.toFixed(2)}</td>
      <td><span class="rbadge ${b.result}">${rl}</span></td>
      <td class="mono text-right ${nc}">${netStr}</td>
      <td class="mono text-right ${nc}" style="font-size:0.7rem">${netE}</td>
      <td style="white-space:nowrap">
        <div style="display:flex;gap:0.25rem">
          ${window.isAdmin ? `
          <button class="abtn" onclick="openModal('${b.id}')">✏️</button>
          <button class="abtn los" onclick="deleteBet('${b.id}')">🗑️</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── UTILS ────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d+'T12:00:00').toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit'});
}
function snack(msg) {
  const el = document.getElementById('snackbar');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

document.getElementById('bet-overlay').addEventListener('click',  e => { if (e.target === e.currentTarget) closeModal('bet-overlay'); });
document.getElementById('unit-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('unit-overlay'); });

// ══════════════════════════════════════════
// PWA — service worker + instalação
// ══════════════════════════════════════════
let deferredInstallPrompt = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.error('Erro ao registar service worker:', e));
  });
}

// Chrome/Edge/Android disparam este evento quando a PWA é instalável
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('btn-install');
  if (btn) btn.style.display = 'block';
});

async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') document.getElementById('btn-install').style.display = 'none';
  deferredInstallPrompt = null;
}

window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('btn-install');
  if (btn) btn.style.display = 'none';
  deferredInstallPrompt = null;
});

// iOS/Safari não disparam beforeinstallprompt — não há forma automática de
// instalar, por isso mostramos uma dica manual (só uma vez por browser)
function isIosInstallEligible() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return isIos && !isStandalone;
}

if (isIosInstallEligible() && !localStorage.getItem('iosInstallHintShown')) {
  setTimeout(() => {
    snack('📲 Adiciona ao Ecrã Principal (Partilhar → Adicionar) para instalar a app');
    localStorage.setItem('iosInstallHintShown', '1');
  }, 1500);
}

// Clique numa notificação (#pending) ou link direto abre já nos Pendentes
if (location.hash === '#pending') {
  const pendingNavBtn = document.querySelectorAll('.nav-main button')[1];
  goTo('pending', pendingNavBtn || null);
}

// ══════════════════════════════════════════
// PUSH NOTIFICATIONS (extra opcional — o canal principal é o Telegram)
// ══════════════════════════════════════════
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function refreshNotifyButton() {
  const btn = document.getElementById('btn-notify');
  if (!btn) return;
  // Escondido até o VAPID_PUBLIC_KEY real ser configurado, e no iOS antes de instalar
  if (!pushSupported() || VAPID_PUBLIC_KEY.startsWith('<') || isIosInstallEligible()) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'block';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    btn.textContent = sub ? '🔕 Notificações ativas' : '🔔 Notificações';
    btn.classList.toggle('active', !!sub);
  } catch (e) { /* SW ainda não pronto, tenta na próxima */ }
}

async function toggleNotifications() {
  if (!pushSupported()) { snack('⚠️ O teu browser não suporta notificações push'); return; }

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();

  if (existing) {
    try {
      const { error } = await window.supabase.functions.invoke('subscribe-push', {
        body: { action: 'unsubscribe', endpoint: existing.endpoint },
      });
      if (error) throw error;
      await existing.unsubscribe();
      snack('🔕 Notificações desativadas');
    } catch (e) { snack('⚠️ Erro ao desativar: ' + e.message); }
    refreshNotifyButton();
    return;
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { snack('⚠️ Permissão de notificações recusada'); return; }

  try {
    const sub  = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const json = sub.toJSON();
    // A escrita em push_subscriptions passa pela Edge Function `subscribe-push`
    // (chave admin) em vez de ir direta à tabela — assim não precisa de
    // nenhuma política pública de RLS na tabela.
    const { data, error } = await window.supabase.functions.invoke('subscribe-push', {
      body: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    snack('🔔 Notificações ativadas!');
  } catch (e) {
    snack('⚠️ Erro ao ativar: ' + e.message);
  }
  refreshNotifyButton();
}

if (pushSupported()) {
  navigator.serviceWorker.ready.then(refreshNotifyButton).catch(() => {});
}