/* ═══════════════════════════════════════════
   RODRI TIPS — script.js
   ═══════════════════════════════════════════ */

const SC = { Tennis:'var(--tennis)', Handball:'var(--handball)', MMA:'var(--mma)', Football:'var(--football)', Basketball:'var(--basketball)', AmericanFootball:'var(--american-football)' };
const SI = { Tennis:'🎾', Handball:'🤾', MMA:'🥊', Football:'⚽', Basketball:'🏀', AmericanFootball:'🏈' };
const SL = { Tennis:'Ténis', Handball:'Andebol', MMA:'MMA', Football:'Futebol', Basketball:'Basquetebol', AmericanFootball:'NFL' };
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const SPORT_META = {
  Tennis:  { p1:'Jogador 1',  p2:'Jogador 2'  },
  Handball:{ p1:'Equipa Casa', p2:'Equipa Fora', playerTeam: true },
  MMA:     { p1:'Lutador 1',  p2:'Lutador 2'  },
  Football:{ p1:'Equipa Casa', p2:'Equipa Fora', playerTeam: true },
  Basketball:      { p1:'Equipa Casa', p2:'Equipa Fora', playerTeam: true },
  AmericanFootball:{ p1:'Equipa Casa', p2:'Equipa Fora', playerTeam: true },
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
let isFuture  = false; // aposta futura (outright) — só válido com betType 'simple'
let comboLegs = [];
let bookmaker = null; // 22bet | Betano | Betclic | Bwin | Solverde | Leon
// isAdmin e ADMIN_EMAIL são definidos em index.html (junto da inicialização do Supabase)

// ── SUPABASE DATA LAYER ──────────────────────
// Todas as apostas vivem na tabela `bets` do Supabase (ver supabase/schema.sql) —
// partilhadas por todos os visitantes, não apenas guardadas neste browser.

async function loadBets() {
  const { data, error } = await window.supabase
    .from('bets')
    .select('*')
    .order('date', { ascending: false });
  if (error) {
    console.error('Erro ao carregar apostas:', error);
    snack('⚠️ Não foi possível carregar as apostas — verifica a ligação');
    return [];
  }
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
  if (error) {
    console.error('Erro ao carregar definições:', error);
    snack('⚠️ Não foi possível carregar as definições — verifica a ligação');
    return;
  }
  settingsId = data.id;
  unitVal    = parseFloat(data.unit_value);
  updateUnitLabel();
  renderAll();
}

loadSettings();

const footerYearEl = document.getElementById('footer-year');
if (footerYearEl) footerYearEl.textContent = new Date().getFullYear();

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
    const idx = {home:0,dashboard:1,pending:2,futures:3,analysis:4,history:5}[page];
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
  // Show/hide player-team row (nunca aplicável a uma futura — não há confronto)
  const teamRow = document.getElementById('player-team-row');
  if (isFuture) {
    teamRow.style.display = 'none';
  } else if (meta.playerTeam) {
    teamRow.style.display = 'grid';
    document.getElementById('lbl-player').textContent  = sport === 'Football' ? 'Nome do Jogador (opcional)' : 'Jogador a apostar (opcional)';
    document.getElementById('lbl-pteam').textContent   = 'Equipa do Jogador';
  } else {
    teamRow.style.display = 'none';
    document.getElementById('f-player').value = '';
    document.getElementById('f-pteam').value  = '';
  }

  // Modo Futura: sem confronto — esconde o "vs" todo, só fica a Aposta/Mercado
  const vsRow = document.getElementById('vs-row');
  if (vsRow) vsRow.style.display = isFuture ? 'none' : 'grid';
  if (isFuture) { document.getElementById('f-p1').value = ''; document.getElementById('f-p2').value = ''; }

  const betHint = document.getElementById('hint-bet');
  if (betHint) betHint.textContent = isFuture
    ? 'Escreve a aposta toda — ex: "Sporting CP vence a Liga 2026/27"'
    : 'Preenche o nome apostado e o tipo de mercado';

  const futureDateRow = document.getElementById('future-date-row');
  if (futureDateRow) futureDateRow.style.display = isFuture ? 'block' : 'none';
  if (!isFuture) document.getElementById('f-expected-date').value = '';
}

// ── COMBINADAS ───────────────────────────────
function emptyLeg() { return { comp:'', p1:'', p2:'', bet:'', odds:'', player:'', pteam:'', result:'Pending' }; }

function updateComboOddsHint() {
  const el = document.getElementById('combo-odds-hint');
  if (!el) return;
  const odds = comboLegs.map(l => parseFloat(l.odds)).filter(o => !isNaN(o) && o >= 1.01);
  if (odds.length < 2) { el.textContent = ''; return; }
  const product = odds.reduce((a, b) => a * b, 1);
  el.textContent = `Produto das odds das seleções: ${product.toFixed(2)}`;
}

function chooseBetType(type) {
  // "future" não é um bet_type à parte — reaproveita o formulário simples,
  // só marca isFuture e troca o "vs" por um único nome (ver updateModalForSport)
  betType  = type === 'future' ? 'simple' : type;
  isFuture = type === 'future';
  document.getElementById('bet-type-choice').style.display     = 'none';
  document.getElementById('simple-form-fields').style.display  = betType === 'simple' ? 'grid' : 'none';
  document.getElementById('combo-form-fields').style.display   = betType === 'combo'  ? 'grid' : 'none';
  updateModalForSport(currentSport);
  if (betType === 'combo') {
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

function updateLeg(i, field, value) { comboLegs[i][field] = value; if (field === 'odds') updateComboOddsHint(); }

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

        <div style="display:grid;grid-template-columns:1fr 90px;gap:0.5rem;grid-column:span 2">
          <div class="fg">
            <label>Aposta / Mercado</label>
            <input type="text" value="${esc(leg.bet)}" oninput="updateLeg(${i},'bet',this.value)">
          </div>
          <div class="fg">
            <label>Odd</label>
            <input type="number" step="0.01" min="1.01" value="${esc(leg.odds)}" oninput="updateLeg(${i},'odds',this.value)">
          </div>
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
  updateComboOddsHint();
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
  isFuture  = false;
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
    isFuture     = !!b.is_future;
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
      document.getElementById('f-expected-date').value = b.expected_result_date || '';
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
    ['f-comp','f-p1','f-p2','f-bet','f-odds','f-player','f-pteam','f-combo-units','f-combo-odds','f-expected-date'].forEach(id => {
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
  if (docId) {
    const b = bets.find(x => x.id === docId);
    chooseBetType(b.is_future ? 'future' : (b.bet_type || 'simple'));
  }
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
        odds: parseFloat(l.odds), player: l.player.trim(), pteam: l.pteam.trim(), result: l.result
      }))
      .filter(l => l.p1 && l.p2 && l.bet);

    if (!legs.length) { snack('⚠️ Adiciona pelo menos uma seleção completa'); return; }
    if (legs.some(l => isNaN(l.odds) || l.odds < 1.01)) { snack('⚠️ Preenche a odd de cada seleção (mín. 1.01)'); return; }

    const obj = {
      date, sport: currentSport, comp: null,
      p1: null, p2: null, event: null, bet: null,
      units, odds, result: comboResult(legs),
      player: null, pteam: null, bookmaker,
      bet_type: 'combo', legs, is_future: false
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
  const p1     = isFuture ? '' : document.getElementById('f-p1').value.trim();
  const p2     = isFuture ? '' : document.getElementById('f-p2').value.trim();
  const bet    = document.getElementById('f-bet').value.trim();
  const units  = parseFloat(document.getElementById('f-units').value);
  const odds   = parseFloat(document.getElementById('f-odds').value);
  const player = isFuture ? '' : document.getElementById('f-player').value.trim();
  const pteam  = isFuture ? '' : document.getElementById('f-pteam').value.trim();

  if ((!isFuture && (!p1 || !p2)) || !bet || !units || !odds) {
    snack(isFuture ? '⚠️ Preenche: aposta, units e odd' : '⚠️ Preenche: confronto, aposta, units e odd'); return;
  }
  if (isNaN(units) || units <= 0)  { snack('⚠️ Units inválidas'); return; }
  if (isNaN(odds)  || odds < 1.01) { snack('⚠️ Odd inválida (mín. 1.01)'); return; }

  const expectedDate = isFuture ? (document.getElementById('f-expected-date').value || null) : null;

  const obj = {
    date, sport: currentSport, comp,
    p1: p1 || null, p2: p2 || null, event: isFuture ? null : (p1 + ' - ' + p2),
    bet, units, odds, result: selResult,
    player, pteam, bookmaker, bet_type: 'simple', is_future: isFuture,
    expected_result_date: expectedDate,
  };

  try {
    if (editId) { await dbUpdate(editId, obj); snack('✅ Aposta atualizada!'); }
    else        { await dbAdd(obj);            snack(isFuture ? '🔮 Futura guardada!' : '🎯 Aposta guardada!'); }
    closeModal('bet-overlay');
  } catch(e) {
    console.error(e);
    snack('⚠️ Erro ao guardar: ' + e.message);
  }
}

const RESULT_CONFIRM_LABEL = { Win: 'Ganhou ✅', Lost: 'Perdeu ❌', Void: 'Void ↩️' };

async function quickResolveLeg(betId, legIndex, result) {
  const b = bets.find(x => x.id === betId);
  if (!b || !b.legs) return;
  if (!confirm(`Marcar esta seleção como "${RESULT_CONFIRM_LABEL[result]}"?`)) return;
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
  if (!confirm(`Marcar esta aposta como "${RESULT_CONFIRM_LABEL[res]}"?`)) return;
  try { await dbUpdate(docId, { result: res }); snack('✅ Resultado atualizado!'); }
  catch(e) { snack('⚠️ Erro: ' + e.message); }
}

// ── CALCS ────────────────────────────────────
function calcNet(b) {
  // b.odds pode faltar em seleções antigas de combinadas (o campo é novo) —
  // sem odd não dá para saber o lucro de um Win, por isso conta como 0 em
  // vez de rebentar em NaN. Não afeta apostas reais, que têm sempre odd.
  if (b.result === 'Win')  return b.odds ? +((b.units * b.odds) - b.units).toFixed(4) : 0;
  if (b.result === 'Lost') return -b.units;
  return 0;
}

function getStats(arr) {
  const closed   = arr.filter(b => b.result !== 'Pending');
  const wins     = closed.filter(b => b.result === 'Win').length;
  const losses   = closed.filter(b => b.result === 'Lost').length;
  const voids    = closed.filter(b => b.result === 'Void').length;
  // Só entram nos números de dinheiro (units/lucro/ROI/odd média) apostas
  // com odd conhecida — sem isso o W/L continua a contar, mas o valor fica
  // de fora em vez de distorcer as contas com um lucro a 0 fingido.
  const bettable = closed.filter(b => b.result !== 'Void' && b.odds);
  const unitsOut = bettable.reduce((s, b) => s + b.units, 0);
  const profit   = bettable.reduce((s, b) => s + calcNet(b), 0);
  const roi      = unitsOut > 0 ? profit / unitsOut * 100 : 0;
  const wr       = (wins + losses) > 0 ? wins / (wins + losses) * 100 : 0;
  const avgOdd   = bettable.length ? bettable.reduce((s, b) => s + b.odds, 0) / bettable.length : 0;
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
  renderFutures();
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
  // Futuras têm separador próprio — não contam para a lista/contagem de Pendentes
  const pending = bets.filter(b => b.result === 'Pending' && !b.is_future);
  const pendingFutures = bets.filter(b => b.result === 'Pending' && b.is_future);

  const pe = document.getElementById('s-profit');
  pe.textContent = (s.profit >= 0 ? '+' : '') + s.profit.toFixed(2) + 'u';
  pe.className   = 'stat-value ' + (s.profit >= 0 ? 'text-green' : 'text-red');
  document.getElementById('s-profit-eur').textContent =
    (s.profit * unitVal >= 0 ? '+' : '') + (s.profit * unitVal).toFixed(2) + '€ · ROI ' + s.roi.toFixed(1) + '%';
  document.getElementById('s-wr').textContent     = s.wr.toFixed(0) + '%';
  document.getElementById('s-record').textContent = s.wins + 'W / ' + s.losses + 'L / ' + allS.voids + 'V';
  document.getElementById('s-total').textContent  = bets.length;
  document.getElementById('s-pcount').textContent = pending.length + ' pendentes' + (pendingFutures.length ? ' · ' + pendingFutures.length + ' futuras' : '');
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
    : '<div class="empty">Sem apostas pendentes</div>';
}

function setPendingTab(sport, btn) {
  pendingSport = sport;
  document.querySelectorAll('#pending-tabs .sport-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPending();
}

function renderPending() {
  // Futuras têm separador próprio (ver renderFutures) — não aparecem aqui
  const all = bets.filter(b => b.result === 'Pending' && !b.is_future);
  Object.keys(SI).forEach(s => {
    const el = document.getElementById('pt-' + s);
    if (el) el.textContent = all.filter(b => b.sport === s).length;
  });
  const elAll = document.getElementById('pt-all');
  if (elAll) elAll.textContent = all.length;
  const filtered = pendingSport === 'all' ? all : all.filter(b => b.sport === pendingSport);
  document.getElementById('pending-list').innerHTML = filtered.length
    ? filtered.map(pendingCard).join('')
    : '<div class="empty">Sem apostas pendentes</div>';
}

const LEG_ICON = { Pending:'⏳', Win:'✅', Lost:'❌', Void:'↩️' };

function pendingCard(b) {
  const pot  = (b.units * b.odds).toFixed(2);
  const potE = (b.units * b.odds * unitVal).toFixed(2);

  if (b.bet_type === 'combo') {
    const legsHtml = (b.legs || []).map((l, i) => `
      <div${i > 0 ? ' style="margin-top:0.8rem;padding-top:0.8rem;border-top:1px solid var(--border)"' : ''}>
        <div class="pcard-event"${i > 0 ? ' style="padding-right:0"' : ''}>${esc(l.p1)} <span style="color:var(--muted);font-size:0.72rem">vs</span> ${esc(l.p2)}</div>
        <div class="pcard-bet">${esc(l.bet)}${l.odds ? ` @${(+l.odds).toFixed(2)}` : ''}</div>
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

// ── FUTURAS (outrights) ──────────────────────
function futureCard(b) {
  const pot  = (b.units * b.odds).toFixed(2);
  const potE = (b.units * b.odds * unitVal).toFixed(2);
  return `<div class="pcard" style="--pc:${SC[b.sport]}">
    <div class="pcard-tag">FUTURA</div>
    <div style="margin-bottom:0.35rem"><span class="spill ${b.sport}"><span class="dot"></span>${SI[b.sport]} ${SL[b.sport]}</span></div>
    <div class="pcard-event">${esc(b.bet)}</div>
    ${b.expected_result_date ? `<div style="margin-top:0.25rem;font-size:0.68rem;font-family:'DM Mono',monospace;color:var(--muted2)">📅 Resultado esperado: ${fmtDate(b.expected_result_date)}</div>` : ''}
    <div class="pcard-footer" style="margin-top:0.7rem">
      <div><div class="pstat-label">Odd</div><div class="pstat-val">${b.odds.toFixed(2)}</div></div>
      <div><div class="pstat-label">Units</div><div class="pstat-val">${b.units}u</div></div>
      <div><div class="pstat-label">Retorno</div><div class="pstat-val">${pot}u</div></div>
      <div><div class="pstat-label">Em €</div><div class="pstat-val">${potE}€</div></div>
    </div>
    <div class="pcard-meta">
      <span>${esc(b.comp) || '—'} · ${fmtDate(b.date)}${b.bookmaker ? ' · ' + esc(b.bookmaker) : ''}</span>
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

function renderFutures() {
  const all      = bets.filter(b => b.is_future);
  const active   = all.filter(b => b.result === 'Pending');
  const resolved = all.filter(b => b.result !== 'Pending');

  document.getElementById('futures-active-list').innerHTML = active.length
    ? active.map(futureCard).join('')
    : '<div class="empty">Sem apostas futuras ativas</div>';

  const tbody = document.getElementById('futures-resolved-list');
  tbody.innerHTML = resolved.length
    ? resolved.slice().sort((a, b) => b.date.localeCompare(a.date)).map(b => {
        const net = calcNet(b);
        const nc  = net > 0 ? 'text-green' : net < 0 ? 'text-red' : 'text-muted';
        const rl  = { Win: '✅ Win', Lost: '❌ Lost', Void: '↩️ Void' }[b.result] || b.result;
        return `<tr>
          <td class="mono text-muted" style="font-size:0.7rem">${fmtDate(b.date)}</td>
          <td><span class="spill ${b.sport}"><span class="dot"></span>${SI[b.sport]}</span></td>
          <td style="font-size:0.78rem">${esc(b.bet)}</td>
          <td style="font-size:0.72rem;color:var(--muted2);font-family:'DM Mono',monospace">${esc(b.comp) || '—'}</td>
          <td><span class="rbadge ${b.result}">${rl}</span></td>
          <td class="mono text-right ${nc}">${net >= 0 ? '+' : ''}${net.toFixed(2)}u</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="6"><div class="empty">Sem futuras resolvidas ainda.</div></td></tr>`;
}

function setAnalysisTab(sport, btn) {
  analysisSport = sport;
  document.querySelectorAll('#analysis-sport-tabs .sport-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const entityTab = document.getElementById('analysis-tab-entity');
  if (entityTab) entityTab.textContent = sport === 'MMA' ? '👤 Lutadores' : '👤 Jogadores';

  // A aba "Equipas" só faz sentido nos desportos de equipa — em Ténis/MMA
  // (individuais) nem aparece.
  const teamsTab = document.getElementById('analysis-tab-teams');
  const hasTeams = SPORT_META[sport].playerTeam;
  if (teamsTab) {
    teamsTab.style.display = hasTeams ? '' : 'none';
    if (!hasTeams && analysisMode === 'teams') {
      analysisMode = 'entity';
      document.querySelectorAll('#analysis-subtabs .sub-tab').forEach(b => b.classList.remove('active'));
      entityTab.classList.add('active');
    }
  }

  renderAnalysis();
}

function setAnalysisMode(mode, btn) {
  analysisMode = mode;
  document.querySelectorAll('#analysis-subtabs .sub-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAnalysis();
}

function renderComboAnalysis() {
  const allCombos = bets.filter(b => b.sport === analysisSport && b.bet_type === 'combo');
  const combos    = allCombos.filter(b => b.result !== 'Pending');

  // Estatísticas por seleção (não por bilhete) — ajuda a perceber se o
  // problema/força está nas seleções em si, sem depender do resultado do
  // bilhete inteiro (uma seleção pode já estar resolvida num bilhete ainda
  // Pending, se outra seleção do mesmo bilhete ainda não saiu).
  const allLegs = [];
  allCombos.forEach(b => (b.legs || []).forEach(l => allLegs.push(l)));
  const legsSettled = allLegs.filter(l => l.result === 'Win' || l.result === 'Lost');
  const legsWon      = legsSettled.filter(l => l.result === 'Win').length;
  const legWinRate    = legsSettled.length ? (legsWon / legsSettled.length * 100) : 0;
  const legsWithOdds  = allLegs.map(l => parseFloat(l.odds)).filter(o => !isNaN(o));
  const avgLegOdd      = legsWithOdds.length ? legsWithOdds.reduce((a,b)=>a+b,0) / legsWithOdds.length : 0;

  // Confrontos mais escolhidos nas combinadas — conta aparições e W/L por
  // seleção, sem tentar atribuir lucro a cada uma (o lucro só existe ao
  // nível do bilhete inteiro, não faz sentido dividi-lo por seleção).
  const confrontoMap = {};
  allLegs.forEach(l => {
    if (!l.p1 || !l.p2) return;
    const key = `${l.p1} vs ${l.p2}`;
    if (!confrontoMap[key]) confrontoMap[key] = { key, wins: 0, losses: 0, total: 0 };
    confrontoMap[key].total++;
    if (l.result === 'Win') confrontoMap[key].wins++;
    if (l.result === 'Lost') confrontoMap[key].losses++;
  });
  const confrontos = Object.values(confrontoMap)
    .filter(c => c.total > 1)
    .sort((a, b) => b.total - a.total);

  document.getElementById('analysis-content').innerHTML = `
    <div class="analysis-wrap">
      <div class="analysis-header">
        <div>
          <div class="analysis-title">Combinadas — ${SI[analysisSport]} ${SL[analysisSport]}</div>
          <div style="font-size:0.65rem;color:var(--muted);font-family:'DM Mono',monospace;margin-top:0.2rem">${allLegs.length} seleções no total · ${legWinRate.toFixed(0)}% de acerto por seleção · odd média por seleção ${avgLegOdd ? avgLegOdd.toFixed(2) : '—'}</div>
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
              const legsHtml = (b.legs||[]).map(l => `
                <div style="display:flex;align-items:center;gap:0.35rem;padding:0.12rem 0">
                  <span>${LEG_ICON[l.result]}</span>
                  <span>${esc(l.p1)} <span style="color:var(--muted)">vs</span> ${esc(l.p2)}</span>
                  ${l.odds ? `<span style="color:var(--muted2);margin-left:auto;padding-left:0.5rem">@${(+l.odds).toFixed(2)}</span>` : ''}
                </div>`).join('');
              return `<tr>
                <td class="mono text-muted" style="font-size:0.7rem">${fmtDate(b.date)}</td>
                <td class="mono" style="font-size:0.7rem;min-width:220px">${legsHtml}</td>
                <td class="mono">${b.odds.toFixed(2)}</td>
                <td class="mono">${b.units}u</td>
                <td><span class="rbadge ${b.result}">${rl}</span></td>
                <td class="mono ${net>=0?'text-green':'text-red'}">${net>=0?'+':''}${net.toFixed(2)}u</td>
                <td class="mono ${net>=0?'text-green':'text-red'}">${(net*unitVal>=0?'+':'')+(net*unitVal).toFixed(2)}€</td>
              </tr>`;
            }).join('')
        }</tbody>
      </table>

      ${confrontos.length ? `
      <div class="analysis-header" style="border-top:1px solid var(--border)">
        <div>
          <div class="analysis-title">Confrontos repetidos nas combinadas</div>
          <div style="font-size:0.65rem;color:var(--muted);font-family:'DM Mono',monospace;margin-top:0.2rem">Contagem por seleção, não por lucro — o lucro só existe ao nível do bilhete inteiro</div>
        </div>
      </div>
      <table class="analysis-table">
        <thead><tr><th>Confronto</th><th>Vezes</th><th>W/L</th><th>Win%</th></tr></thead>
        <tbody>${confrontos.map(c => `
          <tr>
            <td><div class="entity-name">${esc(c.key)}</div></td>
            <td class="mono">${c.total}</td>
            <td class="mono text-muted">${c.wins}W/${c.losses}L</td>
            <td class="mono">${(c.wins + c.losses) ? (c.wins / (c.wins + c.losses) * 100).toFixed(0) : '—'}%</td>
          </tr>`).join('')}</tbody>
      </table>` : ''}
    </div>`;
}

function buildAnalysisTable(groups, title, subtitle) {
  // getStats() calculado uma vez por grupo e reutilizado em tudo (ordenação,
  // maxP da barra, linhas) — assim o lucro que ordena é sempre o mesmo que
  // aparece na tabela, mesmo com seleções de combinadas sem odd (que contam
  // para o W/L mas ficam fora dos números de dinheiro).
  groups = groups.map(g => ({ ...g, _st: getStats(g.bets) }))
    .sort((a, b) => b._st.profit - a._st.profit);
  const maxP = Math.max(...groups.map(g => Math.abs(g._st.profit)), 0.01);
  const totalBets = groups.reduce((s, g) => s + g.bets.length, 0);
  const anyFromCombo = groups.some(g => g.bets.some(b => b._fromCombo));

  return `
    <div class="analysis-wrap">
      <div class="analysis-header">
        <div>
          <div class="analysis-title">${title} — ${SI[analysisSport]} ${SL[analysisSport]}</div>
          ${subtitle?`<div style="font-size:0.65rem;color:var(--muted);font-family:'DM Mono',monospace;margin-top:0.2rem">${subtitle}</div>`:''}
          ${anyFromCombo?`<div style="font-size:0.65rem;color:var(--muted);font-family:'DM Mono',monospace;margin-top:0.2rem">Inclui seleções de combinadas — lucro hipotético (a unidade do bilhete dividida pelas seleções, à odd de cada uma; não é dinheiro realmente ganho isoladamente)</div>`:''}
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted)">${groups.length} entradas · ${totalBets} apostas</div>
      </div>
      <table class="analysis-table">
        <thead><tr><th>#</th><th>${title}</th><th>Apostas</th><th>W/L</th><th>Win%</th><th>Odd Méd.</th><th>Units</th><th>Lucro (u)</th><th>Lucro (€)</th><th>ROI</th><th>Tendência</th></tr></thead>
        <tbody>${!groups.length
          ? `<tr><td colspan="11"><div class="empty">Sem dados ainda.<br>Regista as tuas primeiras apostas!</div></td></tr>`
          : groups.map((g,i) => {
              const st     = g._st;
              const profit = st.profit;
              const roi    = st.roi;
              const avg    = st.avgOdd;
              const barW   = Math.min(Math.abs(profit)/maxP*100, 100);
              const barC   = profit >= 0 ? 'var(--win)' : 'var(--loss)';
              return `<tr>
                <td style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted);width:28px">${i+1}</td>
                <td><div class="entity-name">${esc(g.key)}</div></td>
                <td class="mono">${g.bets.length}</td>
                <td class="mono text-muted">${st.wins}W/${st.losses}L</td>
                <td class="mono">${st.wr.toFixed(0)}%</td>
                <td class="mono">${avg > 0 ? avg.toFixed(2) : '—'}</td>
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

// Seleções de combinadas como se fossem apostas simples independentes — para
// que torneios/jogadores/equipas dentro de combinadas também contem para
// Jogadores/Equipas/Mercados/Competições, não só para a aba "Combinadas".
// O lucro é hipotético (a unidade do bilhete dividida pelas seleções, à odd
// da própria seleção) porque o dinheiro real só é ganho/perdido ao nível do
// bilhete inteiro — buildAnalysisTable() avisa disso no cabeçalho da tabela.
function comboLegsAsPseudoBets(sport) {
  const pseudo = [];
  bets.filter(b => b.sport === sport && b.bet_type === 'combo').forEach(b => {
    const numLegs = (b.legs || []).length || 1;
    // A unidade da múltipla é uma só, a dividir por todas as seleções — não
    // "1u por seleção" (isso multiplicaria a units apostada real).
    const legUnits = b.units / numLegs;
    (b.legs || []).forEach(l => {
      if (l.result !== 'Win' && l.result !== 'Lost' && l.result !== 'Void') return;
      // Seleções antigas não têm odd guardada (campo novo) — continuam a
      // contar para o record W/L, só ficam de fora dos números de dinheiro
      // (ver o filtro em getStats/buildAnalysisTable).
      const parsedOdds = parseFloat(l.odds);
      pseudo.push({
        p1: l.p1, p2: l.p2, bet: l.bet, comp: l.comp, player: l.player, pteam: l.pteam,
        units: legUnits, odds: isNaN(parsedOdds) ? null : parsedOdds, result: l.result,
        sport: b.sport, bet_type: 'simple', _fromCombo: true,
      });
    });
  });
  return pseudo;
}

function renderAnalysis() {
  if (analysisMode === 'combos') { renderComboAnalysis(); return; }

  const sportBets = bets
    .filter(b => b.sport === analysisSport && b.result !== 'Pending' && b.bet_type !== 'combo')
    .concat(comboLegsAsPseudoBets(analysisSport));
  let groups = [], title = '', subtitle = '';

  // Helper: check if a label is a market type (not an entity)
  const isMarketType = (label) => {
    return /^(Ases|Over|Under|ML|Handicap|KO\/TKO|BTTS|Mercado)$/.test(label);
  };

  if (analysisMode === 'entity') {
    const meta = SPORT_META[analysisSport];

    if (meta.playerTeam) {
      // Desportos de equipa: só as apostas com jogador marcado — as apostas
      // por equipa ficam na aba "Equipas" (ver analysisMode === 'teams').
      const map = {};
      sportBets.forEach(b => {
        if (!b.player) return;
        const key = b.pteam ? `${b.player} (${b.pteam})` : b.player;
        if (!map[key]) map[key] = { key, bets: [] };
        map[key].bets.push(b);
      });
      groups   = Object.values(map);
      title    = 'Jogadores';
      subtitle = 'Apostas com jogador marcado';
    } else {
      // Ténis / MMA: continuam como sempre.
      const map = {};
      sportBets.forEach(b => {
        const betText = (b.bet || '').toLowerCase();
        const playerCandidates = [b.p1, b.p2].filter(Boolean);
        let key = null;
        for (const name of playerCandidates) {
          const firstToken = name.split(' ')[0].toLowerCase();
          if (betText.includes(firstToken) || betText.includes(name.toLowerCase())) { key = name; break; }
        }
        if (!key) {
          if (/\bases\b|\baces?\b/i.test(b.bet || '')) key = 'Ases';
          else if (/\bover\b/i.test(b.bet || '')) key = 'Over';
          else if (/\bunder\b/i.test(b.bet || '')) key = 'Under';
          else if (/\bml\b/i.test(b.bet || '')) key = 'ML';
          else if (/handicap/i.test(b.bet || '')) key = 'Handicap';
          else if (/ko\/tko|by\s+ko/i.test(b.bet || '')) key = 'KO/TKO';
          else if (/btts|ambas\s+marcam/i.test(b.bet || '')) key = 'BTTS';
          else key = 'Mercado';
        }
        if (isMarketType(key)) return;
        if (!map[key]) map[key] = { key, bets: [] };
        map[key].bets.push(b);
      });
      groups   = Object.values(map);
      title    = analysisSport === 'MMA' ? 'Lutadores' : 'Jogadores';
      subtitle = 'Apostas por entidade';
    }

  } else if (analysisMode === 'teams') {
    const meta = SPORT_META[analysisSport];

    if (!meta.playerTeam) {
      document.getElementById('analysis-content').innerHTML = `
        <div class="analysis-wrap">
          <div class="analysis-header"><div class="analysis-title">Equipas — ${SI[analysisSport]} ${SL[analysisSport]}</div></div>
          <div class="empty">Este desporto não tem equipas — só jogadores individuais.</div>
        </div>`;
      return;
    }

    const map = {};
    sportBets.forEach(b => {
      if (b.player) return; // já contabilizado na aba "Jogadores"
      const betText = (b.bet || '').toLowerCase();
      const teamCandidates = [b.p1, b.p2].filter(Boolean);
      let key = null;
      for (const team of teamCandidates) {
        const teamKey = team.split(' ')[0].toLowerCase();
        if (betText.includes(teamKey) || betText.includes(team.toLowerCase())) { key = team; break; }
      }
      if (!key) {
        if (/\bover\b/i.test(b.bet || '')) key = 'Over';
        else if (/\bunder\b/i.test(b.bet || '')) key = 'Under';
        else if (/\bml\b/i.test(b.bet || '')) key = 'ML';
        else if (/handicap/i.test(b.bet || '')) key = 'Handicap';
        else if (/btts|ambas\s+marcam/i.test(b.bet || '')) key = 'BTTS';
        else key = 'Mercado';
      }
      if (!map[key]) map[key] = { key, bets: [] };
      map[key].bets.push(b);
    });

    groups   = Object.values(map);
    title    = 'Equipas';
    subtitle = 'Apostas por equipa';

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

  document.getElementById('analysis-content').innerHTML = buildAnalysisTable(groups, title, subtitle);
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
      : b.is_future
        ? `Futura`
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
document.getElementById('settings-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('settings-overlay'); });
document.getElementById('bonus-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('bonus-overlay'); });

// ══════════════════════════════════════════
// HOME — bónus de registo das casas de apostas
// ══════════════════════════════════════════
// Só as casas com bónus de referral confirmado entram aqui — Bwin/Leon ainda
// não têm código confirmado, por isso ficam de fora até termos a certeza.
const BONUS_INFO = {
  betclic: {
    name: 'Betclic',
    logo: 'bookmakers/betclic.png',
    link: 'https://go.onelink.me/w4we/bc997527?af_sub5=RODR4635',
    value: '10€ em Freebets',
    tags: ['Depósito ≥5€', 'Validar conta'],
    steps: [
      'Entra na Betclic através do link de amigo',
      'Cria uma conta nova',
      'Valida a conta',
      'Faz um depósito mínimo de 5€',
    ],
    note: 'A recompensa é atribuída depois da conta validada e do depósito efetuado. Este Código de Amigo é diferente dos bónus de boas-vindas normais da Betclic.',
  },
  betano: {
    name: 'Betano',
    logo: 'bookmakers/betano.png',
    link: 'https://referme.to/rodrigoc-5588',
    value: '50 Rodadas Grátis',
    tags: ['Depósito ≥10€', '7 dias'],
    steps: [
      'Entra na Betano através do link de convite (não é o mesmo que um código promocional normal)',
      'Cria uma conta nova — nunca podes ter tido conta Betano antes',
      'Faz o primeiro depósito de pelo menos 10€',
      'Deposita nos primeiros 7 dias após o registo',
    ],
    note: 'Promoção válida até 31 de dezembro de 2026.',
  },
  solverde: {
    name: 'Solverde',
    logo: 'bookmakers/solverde.png',
    link: 'https://sol-ver.de/5wrWrx8',
    value: '20€ (10€ Casino + 10€ Free Bets)',
    tags: ['Depósito ≥20€', 'Código da Amizade'],
    steps: [
      'Entra através do Código da Amizade (link ou QR Code)',
      'Cria uma conta nova',
      'Faz um depósito mínimo de 20€',
      'Joga/aposta no Casino e/ou em Apostas Desportivas',
    ],
    note: 'Não confundir com os códigos promocionais públicos da Solverde (ex: 30€ Freebets ou 60 Free Spins) — este é só através do teu Código da Amizade.',
  },
  '22bet': {
    name: '22Bet',
    logo: 'bookmakers/22bet.png',
    link: 'https://22luckzone.com?bf=67ae0aa08567f_3355764241',
    value: '100% do 1º depósito até 122€',
    tags: ['Depósito ≥1€', 'Rollover 5x'],
    steps: [
      'Regista-te no site da 22Bet',
      'Preenche todos os campos obrigatórios em "A Minha Conta"',
      'Antes de depositar, seleciona a conta de bónus de apostas desportivas',
      'Faz um primeiro depósito de pelo menos 1€',
      'Não escolhas a opção "Eu não quero quaisquer bónus"',
    ],
    note: 'O bónus é creditado automaticamente. Para levantar: apostar 5x o valor do bónus, só em acumuladores de 3+ seleções, com pelo menos 3 seleções a odds ≥1.40, em 7 dias. Ex: 122€ de bónus → 610€ em apostas qualificativas.',
  },
};

function renderBonusGrid() {
  const el = document.getElementById('bonus-grid');
  if (!el) return;
  el.innerHTML = Object.keys(BONUS_INFO).map(key => {
    const b = BONUS_INFO[key];
    return `<div class="bonus-card">
      <div class="bonus-card-top">
        <img class="bonus-logo" src="${b.logo}" alt="${esc(b.name)}">
        <button type="button" class="bonus-info-btn" onclick="openBonusModal('${key}')" title="Como resgatar" aria-label="Como resgatar o bónus da ${esc(b.name)}">?</button>
      </div>
      <div class="bonus-label">Bónus de registo</div>
      <div class="bonus-value">${esc(b.value)}</div>
      <div class="bonus-tags">${b.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
      <a class="bonus-cta" href="${b.link}" target="_blank" rel="sponsored noopener noreferrer">Ativar Bónus</a>
    </div>`;
  }).join('');
}

function openBonusModal(key) {
  const b = BONUS_INFO[key];
  if (!b) return;
  document.getElementById('bonus-modal-title').textContent = b.name;
  document.getElementById('bonus-modal-value').textContent = 'Bónus: ' + b.value;
  document.getElementById('bonus-modal-steps').innerHTML = b.steps.map(s => `<li>${esc(s)}</li>`).join('');
  document.getElementById('bonus-modal-note').textContent = b.note || '';
  document.getElementById('bonus-overlay').classList.add('open');
}

renderBonusGrid();

// ══════════════════════════════════════════
// DEFINIÇÕES — exportar CSV
// ══════════════════════════════════════════
function openSettingsModal() {
  document.getElementById('settings-overlay').classList.add('open');
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[;",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportCSV() {
  // "Jogador/Equipa 1" e "2" são sempre a mesma coisa que p1/p2 no site —
  // Jogador 1/2 no Ténis, Lutador 1/2 no MMA, Equipa Casa/Fora nos desportos
  // de equipa. Em colunas separadas (em vez de "X vs Y" numa célula só) dá
  // para filtrar/analisar por jogador ou equipa individualmente no Excel.
  const headers = ['Data','Desporto','Tipo','Jogador/Equipa 1','Jogador/Equipa 2','Aposta/Mercado','Competição','Jogador','Equipa do Jogador','Casa de Apostas','Units','Odd','Resultado','Lucro (u)','Lucro (€)'];

  const rows = [...bets].sort((a, b) => a.date.localeCompare(b.date)).map(b => {
    const isCombo = b.bet_type === 'combo';
    const net = calcNet(b);
    const tipo = isCombo ? 'Combinada' : (b.is_future ? 'Futura' : 'Simples');

    // Combinada: cada seleção tem o seu próprio par — junta-os por posição
    // (1ª entidade de cada seleção na coluna 1, 2ª na coluna 2). Futura: não
    // há confronto, ficam vazias.
    let ent1 = '', ent2 = '';
    if (isCombo) {
      ent1 = (b.legs || []).map(l => l.p1).filter(Boolean).join(' + ');
      ent2 = (b.legs || []).map(l => l.p2).filter(Boolean).join(' + ');
    } else if (!b.is_future) {
      ent1 = b.p1 || '';
      ent2 = b.p2 || '';
    }

    const legBets  = isCombo ? (b.legs || []).map(l => l.bet).filter(Boolean) : [];
    const legComps = isCombo ? [...new Set((b.legs || []).map(l => l.comp).filter(Boolean))] : [];
    const apostaCell = isCombo ? legBets.join(' + ') : (b.bet || '');
    const compCell    = isCombo ? (legComps.length > 1 ? 'Vários' : (legComps[0] || '')) : (b.comp || '');

    return [
      b.date, SL[b.sport] || b.sport, tipo,
      ent1, ent2, apostaCell, compCell,
      isCombo ? '' : (b.player || ''), isCombo ? '' : (b.pteam || ''),
      b.bookmaker || '', b.units, b.odds, b.result,
      b.result === 'Pending' ? '' : net.toFixed(2),
      b.result === 'Pending' ? '' : (net * unitVal).toFixed(2),
    ];
  });

  // ; em vez de , — o Excel em Portugal usa ; como separador de colunas por
  // definição regional; com , ele juntava tudo numa só coluna ao abrir.
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(';')).join('\r\n');
  // BOM no início — sem isto o Excel pode ler os acentos/€ mal em UTF-8
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rodri-tips-apostas-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  snack(`⬇️ CSV exportado (${bets.length} apostas)!`);
}

function exportJSON() {
  // Mesmos nomes de campo legíveis do CSV (Jogador/Equipa 1 e 2 em vez de
  // p1/p2) — mas aqui cada seleção de uma combinada fica com o detalhe
  // completo em "Seleções", em vez de resumida numa célula só.
  const data = [...bets].sort((a, b) => a.date.localeCompare(b.date)).map(b => {
    const isCombo = b.bet_type === 'combo';
    const net = calcNet(b);
    const tipo = isCombo ? 'Combinada' : (b.is_future ? 'Futura' : 'Simples');

    const obj = {
      'Data': b.date,
      'Desporto': SL[b.sport] || b.sport,
      'Tipo': tipo,
      'Jogador/Equipa 1': isCombo || b.is_future ? '' : (b.p1 || ''),
      'Jogador/Equipa 2': isCombo || b.is_future ? '' : (b.p2 || ''),
      'Aposta/Mercado': isCombo ? '' : (b.bet || ''),
      'Competição': isCombo ? '' : (b.comp || ''),
      'Jogador': isCombo ? '' : (b.player || ''),
      'Equipa do Jogador': isCombo ? '' : (b.pteam || ''),
      'Casa de Apostas': b.bookmaker || '',
      'Units': b.units,
      'Odd': b.odds,
      'Resultado': b.result,
      'Lucro (u)': b.result === 'Pending' ? null : +net.toFixed(2),
      'Lucro (€)': b.result === 'Pending' ? null : +(net * unitVal).toFixed(2),
    };
    if (b.is_future && b.expected_result_date) obj['Data prevista do resultado'] = b.expected_result_date;
    if (isCombo) {
      obj['Odd Total'] = b.odds;
      obj['Seleções'] = (b.legs || []).map(l => ({
        'Jogador/Equipa 1': l.p1 || '',
        'Jogador/Equipa 2': l.p2 || '',
        'Aposta/Mercado': l.bet || '',
        'Odd': l.odds ?? null,
        'Competição': l.comp || '',
        'Jogador': l.player || '',
        'Equipa do Jogador': l.pteam || '',
        'Resultado': l.result,
      }));
    }
    return obj;
  });

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rodri-tips-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  snack(`⬇️ JSON exportado (${bets.length} apostas)!`);
}

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

// Clique numa notificação (#pending/#futures/#history) ou link direto abre já na página certa
const HASH_PAGES = { '#pending': 2, '#futures': 3, '#history': 5 };
if (HASH_PAGES[location.hash] !== undefined) {
  const page = location.hash.slice(1);
  const navBtn = document.querySelectorAll('.nav-main button')[HASH_PAGES[location.hash]];
  goTo(page, navBtn || null);
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
  btn.style.display = 'flex';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    // 🔔 (sem traço) = ativas · 🔕 (com traço) = desativadas
    btn.textContent = sub ? '🔔' : '🔕';
    btn.title = sub ? 'Notificações ativas — clica para desativar' : 'Ativar notificações';
    btn.setAttribute('aria-label', btn.title);
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