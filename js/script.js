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
let unitVal      = parseFloat(localStorage.getItem('rodrigtips_unit') || '10');
let editId       = null;
let selResult    = 'Pending';
let currentSport = 'Tennis';
let histSport    = 'all', histResult = 'all';
let pendingSport = 'all';
let analysisSport = 'Tennis', analysisMode = 'entity';
let isAdmin      = false; // Verifica se é admin
const ADMIN_EMAIL = 'rodrigofcarvalho421@gmail.com'; // SEU EMAIL

// ── LOCAL STORAGE ────────────────────────────
// Usando localStorage em vez de Firebase (mais rápido e sem problemas de permissões)

function loadBetsFromStorage() {
  try {
    const stored = localStorage.getItem('rodrigtips_bets');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.warn('Erro ao carregar apostas:', e);
    return [];
  }
}

function saveBetsToStorage() {
  try {
    localStorage.setItem('rodrigtips_bets', JSON.stringify(bets));
  } catch (e) {
    console.error('Erro ao guardar apostas:', e);
    snack('⚠️ Erro ao guardar');
  }
}

// Inicializa bets do localStorage
bets = loadBetsFromStorage();
renderAll();

async function dbAdd(obj) {
  const id = 'bet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const newBet = { _id: id, ...obj };
  bets.unshift(newBet);
  saveBetsToStorage();
  renderAll();
}

async function dbUpdate(id, obj) {
  const idx = bets.findIndex(b => b._id === id);
  if (idx >= 0) {
    bets[idx] = { ...bets[idx], ...obj };
    saveBetsToStorage();
    renderAll();
  }
}

async function dbDelete(id) {
  bets = bets.filter(b => b._id !== id);
  saveBetsToStorage();
  renderAll();
}

// ── UNIT ─────────────────────────────────────
function openUnitModal() {
  document.getElementById('unit-input').value = unitVal;
  document.getElementById('unit-overlay').classList.add('open');
}
function setUnitPreset(v) { document.getElementById('unit-input').value = v; }
function saveUnit() {
  // Verifica se é admin
  if (!window.isAdmin) {
    snack('⛔ Apenas o admin pode mudar o valor da unidade!');
    closeModal('unit-overlay');
    return;
  }

  const v = parseFloat(document.getElementById('unit-input').value);
  if (!v || v <= 0) { snack('⚠️ Valor inválido'); return; }
  unitVal = v;
  localStorage.setItem('rodrigtips_unit', String(unitVal));
  updateUnitLabel();
  closeModal('unit-overlay');
  renderAll();
  snack('💶 1u = ' + unitVal + '€ guardado!');
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

// ── MODAL OPEN / CLOSE / SAVE ─────────────────
function openModal(docId = null) {
  // Verifica se é admin
  if (!window.isAdmin) {
    snack('⛔ Apenas o admin pode adicionar/editar apostas!');
    return;
  }

  editId    = docId;
  selResult = 'Pending';
  const today = new Date().toISOString().split('T')[0];

  if (docId) {
    const b = bets.find(x => x._id === docId);
    if (!b) return;
    document.getElementById('modal-title').textContent = 'Editar Aposta';
    currentSport = b.sport;
    document.getElementById('f-date').value   = b.date;
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
  } else {
    document.getElementById('modal-title').textContent = 'Nova Aposta';
    currentSport = 'Tennis';
    document.getElementById('f-date').value   = today;
    document.getElementById('f-units').value  = '0.5';
    ['f-comp','f-p1','f-p2','f-bet','f-odds','f-player','f-pteam'].forEach(id => {
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
  document.getElementById('bet-overlay').classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  editId = null;
}

function selRes(btn)   { selResult = btn.dataset.v; updateResUI(); }
function updateResUI() { document.querySelectorAll('.res-opt').forEach(b => b.classList.toggle('sel', b.dataset.v === selResult)); }

async function saveBet() {
  // Verifica se é admin
  if (!window.isAdmin) {
    snack('⛔ Apenas o admin pode adicionar apostas!');
    closeModal('bet-overlay');
    return;
  }

  const date   = document.getElementById('f-date').value.trim();
  const comp   = document.getElementById('f-comp').value.trim();
  const p1     = document.getElementById('f-p1').value.trim();
  const p2     = document.getElementById('f-p2').value.trim();
  const bet    = document.getElementById('f-bet').value.trim();
  const units  = parseFloat(document.getElementById('f-units').value);
  const odds   = parseFloat(document.getElementById('f-odds').value);
  const player = document.getElementById('f-player').value.trim();
  const pteam  = document.getElementById('f-pteam').value.trim();

  if (!date || !p1 || !p2 || !bet || !units || !odds) {
    snack('⚠️ Preenche: data, confronto, aposta, units e odd'); return;
  }
  if (isNaN(units) || units <= 0)  { snack('⚠️ Units inválidas'); return; }
  if (isNaN(odds)  || odds < 1.01) { snack('⚠️ Odd inválida (mín. 1.01)'); return; }

  const obj = {
    date, sport: currentSport, comp,
    p1, p2, event: p1 + ' - ' + p2,
    bet, units, odds, result: selResult,
    player, pteam,
    createdAt: new Date().toISOString()
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

  document.getElementById('dash-pending').innerHTML = pending.slice(0,4).length
    ? pending.slice(0,4).map(pendingCard).join('')
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

function pendingCard(b) {
  const pot  = (b.units * b.odds).toFixed(2);
  const potE = (b.units * b.odds * unitVal).toFixed(2);
  // Show player + team badge if present
  const playerBadge = b.player
    ? `<div style="margin-top:0.3rem;font-size:0.68rem;font-family:'DM Mono',monospace;color:var(--muted2)">
         👤 ${b.player}${b.pteam ? ` <span style="color:var(--muted)">(${b.pteam})</span>` : ''}
       </div>`
    : '';
  return `<div class="pcard" style="--pc:${SC[b.sport]}">
    <div class="pcard-tag">⏳ PENDENTE</div>
    <div style="margin-bottom:0.35rem"><span class="spill ${b.sport}"><span class="dot"></span>${SI[b.sport]} ${SL[b.sport]}</span></div>
    <div class="pcard-event">${b.p1||''} <span style="color:var(--muted);font-size:0.72rem">vs</span> ${b.p2||''}</div>
    <div class="pcard-bet">${b.bet}</div>
    ${playerBadge}
    <div class="pcard-footer" style="margin-top:0.7rem">
      <div><div class="pstat-label">Odd</div><div class="pstat-val">${b.odds.toFixed(2)}</div></div>
      <div><div class="pstat-label">Units</div><div class="pstat-val">${b.units}u</div></div>
      <div><div class="pstat-label">Retorno</div><div class="pstat-val">${pot}u</div></div>
      <div><div class="pstat-label">Em €</div><div class="pstat-val">${potE}€</div></div>
    </div>
    <div class="pcard-meta">
      <span>${b.comp||'—'} · ${fmtDate(b.date)}</span>
      <div class="pcard-actions">
        <button class="abtn win" onclick="quickResolve('${b._id}','Win')">✅</button>
        <button class="abtn los" onclick="quickResolve('${b._id}','Lost')">❌</button>
        <button class="abtn"     onclick="quickResolve('${b._id}','Void')">↩️</button>
        <button class="abtn"     onclick="openModal('${b._id}')">✏️</button>
      </div>
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

function renderAnalysis() {
  console.log('=== renderAnalysis called ===', { analysisMode, analysisSport });
  const sportBets = bets.filter(b => b.sport === analysisSport && b.result !== 'Pending');
  console.log('sportBets:', sportBets.length);
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
        console.log('DEBUG:', { sport: b.sport, bet: b.bet, key, isMarket: isMarketType(key) });
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
                <td><div class="entity-name">${g.key}</div></td>
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
// FIREBASE TESTE
// ══════════════════════════════════════════

async function saveToFirebase() {
  const msg = document.getElementById('firebase-msg').value.trim();
  
  if (!msg) {
    snack('⚠️ Escreve uma mensagem!');
    return;
  }

  try {
    await db.collection('mensagens_teste').add({
      texto: msg,
      data: new Date(),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    document.getElementById('firebase-msg').value = '';
    snack('✅ Mensagem guardada no Firebase!');
    loadFirebaseMessages();
  } catch (error) {
    console.error('Erro ao guardar:', error);
    snack('❌ Erro ao guardar: ' + error.message);
  }
}

function loadFirebaseMessages() {
  const container = document.getElementById('firebase-list');
  
  if (!db) {
    container.innerHTML = '<div style="color:var(--loss)">❌ Firebase não inicializado</div>';
    return;
  }

  db.collection('mensagens_teste')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .onSnapshot(
      (snapshot) => {
        if (snapshot.empty) {
          container.innerHTML = '<div style="color:#9ca3af;text-align:center">Nenhuma mensagem ainda...</div>';
          return;
        }

        container.innerHTML = snapshot.docs.map(doc => {
          const data = doc.data();
          const date = data.timestamp ? data.timestamp.toDate().toLocaleString('pt-PT') : 'Sem data';
          return `
            <div style="padding:0.75rem;background:white;border-radius:6px;border-left:4px solid var(--accent)">
              <div style="font-weight:bold;color:var(--bg)">${data.texto}</div>
              <div style="font-size:0.85rem;color:var(--muted2);margin-top:0.25rem">${date}</div>
            </div>
          `;
        }).join('');
      },
      (error) => {
        console.error('Erro ao carregar mensagens:', error);
        container.innerHTML = `<div style="color:var(--loss)">❌ Erro: ${error.message}</div>`;
      }
    );
}

// Carrega mensagens quando a página inicia
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const testPage = document.getElementById('page-firebase-test');
    if (testPage) {
      loadFirebaseMessages();
    }
  }, 500);
});

// ══════════════════════════════════════════
// AUTENTICAÇÃO (Login/Signup/Logout)
// ══════════════════════════════════════════

function openLoginModal() {
  document.getElementById('login-overlay').classList.add('open');
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('login-error').style.display = 'none';
}

function toggleSignupForm() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
  signupForm.style.display = signupForm.style.display === 'none' ? 'block' : 'none';
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
    await firebase.auth().signInWithEmailAndPassword(email, password);
    errorDiv.style.display = 'none';
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-overlay').classList.remove('open');
    snack('✅ Login feito com sucesso!');
  } catch (error) {
    let msg = '❌ Erro: ';
    if (error.code === 'auth/user-not-found') msg += 'Utilizador não encontrado';
    else if (error.code === 'auth/wrong-password') msg += 'Password incorreta';
    else msg += error.message;
    
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
  }
}

async function signupUser() {
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errorDiv = document.getElementById('login-error');

  if (!email || !password) {
    errorDiv.textContent = '⚠️ Preenche email e password!';
    errorDiv.style.display = 'block';
    return;
  }

  if (password.length < 6) {
    errorDiv.textContent = '⚠️ Password deve ter no mínimo 6 caracteres!';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    await firebase.auth().createUserWithEmailAndPassword(email, password);
    errorDiv.style.display = 'none';
    document.getElementById('signup-email').value = '';
    document.getElementById('signup-password').value = '';
    document.getElementById('login-overlay').classList.remove('open');
    snack('✅ Conta criada! Estás logado.');
    toggleSignupForm();
  } catch (error) {
    let msg = '❌ Erro: ';
    if (error.code === 'auth/email-already-in-use') msg += 'Este email já está registado';
    else if (error.code === 'auth/invalid-email') msg += 'Email inválido';
    else msg += error.message;
    
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
  }
}

async function logout() {
  try {
    await firebase.auth().signOut();
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
    const confronto = b.p1 && b.p2
      ? `<span style="font-weight:600">${b.p1}</span> <span style="color:var(--muted);font-size:0.65rem">vs</span> <span style="font-weight:600">${b.p2}</span>`
      : b.event || '—';
    const playerInfo = b.player
      ? `<div style="font-size:0.65rem;color:var(--muted2);font-family:'DM Mono',monospace;margin-top:0.2rem">👤 ${b.player}${b.pteam?` (${b.pteam})`:''}</div>`
      : '';
    return `<tr>
      <td class="mono text-muted" style="font-size:0.7rem">${fmtDate(b.date)}</td>
      <td><span class="spill ${b.sport}"><span class="dot"></span>${SI[b.sport]}</span></td>
      <td style="max-width:160px">${confronto}${playerInfo}</td>
      <td style="max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'DM Mono',monospace;font-size:0.7rem;color:var(--muted2)">${b.bet}</td>
      <td style="font-size:0.67rem;color:var(--muted);font-family:'DM Mono',monospace;max-width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.comp||'—'}</td>
      <td class="mono text-right">${b.units}u</td>
      <td class="mono text-right">${b.odds.toFixed(2)}</td>
      <td><span class="rbadge ${b.result}">${rl}</span></td>
      <td class="mono text-right ${nc}">${netStr}</td>
      <td class="mono text-right ${nc}" style="font-size:0.7rem">${netE}</td>
      <td style="white-space:nowrap;display:flex;gap:0.25rem;padding:0.65rem 0.75rem">
        <button class="abtn" onclick="openModal('${b._id}')">✏️</button>
        <button class="abtn los" onclick="deleteBet('${b._id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

// ── UTILS ────────────────────────────────────
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