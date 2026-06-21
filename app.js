const STORE_KEY = 'badminton_host_app_v1';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const levelMap = {
  0: { label: 'Newbie', stars: '☆☆☆', icon: '⚪' },
  1: { label: 'Yếu', stars: '★☆☆', icon: '🥉' },
  2: { label: 'TB yếu', stars: '★★☆', icon: '🥈' },
  3: { label: 'Trung bình', stars: '★★★', icon: '🥇' }
};

const seed = {
  theme: 'light',
  activeTab: 'courts',
  playerFilter: 'all',
  currentSuggestCourtId: null,
  currentFinishCourtId: null,
  suggested: null,
  players: [
    p('Nam','Nam',3,true,2,'waiting',20), p('Kỳ','Nam',2,true,1,'playing',0),
    p('Huy','Nam',3,false,1,'waiting',18), p('Linh','Nữ',2,true,0,'waiting',16),
    p('Long','Nam',2,false,1,'playing',0), p('Phong','Nam',3,false,2,'waiting',14),
    p('Tuấn','Nam',2,false,0,'waiting',10), p('Hải','Nam',2,false,0,'waiting',6),
    p('Mai','Nữ',1,false,0,'waiting',5), p('Quân','Nam',2,false,1,'absent',0)
  ],
  courts: [
    { id: uid(), name: 'Sân 1', status: 'playing', players: [] },
    { id: uid(), name: 'Sân 2', status: 'empty', players: [] },
    { id: uid(), name: 'Sân 3', status: 'empty', players: [] }
  ],
  matches: []
};
seed.courts[0].players = [seed.players[0].id, seed.players[1].id, seed.players[2].id, seed.players[4].id];
seed.players[0].status = 'playing';
seed.players[2].status = 'playing';

function p(name, gender, level, regular, sets, status, waitMin){
  return { id: uid(), name, gender, level, regular, sets, status, waitSince: Date.now() - waitMin * 60000, partners: [], opponents: [] };
}
function uid(){ return Math.random().toString(36).slice(2,10); }
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function load(){
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return structuredClone(seed);
  try { return JSON.parse(raw); } catch { return structuredClone(seed); }
}
let state = load();
state.playerSelectMode = !!state.playerSelectMode;
state.selectedPlayers = Array.isArray(state.selectedPlayers) ? state.selectedPlayers : [];

function init(){
  document.documentElement.dataset.theme = state.theme || 'light';
  $('#todayText').textContent = `Hôm nay · ${new Date().toLocaleDateString('vi-VN')}`;
  bindEvents();
  render();
}

function bindEvents(){
  $$('.nav-btn').forEach(btn => btn.onclick = () => { state.activeTab = btn.dataset.tab; save(); render(); });
  $('#themeBtn').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; save(); render(); };
  $('#resetSessionBtn').onclick = () => {
    if (!confirm('Tạo buổi mới? Số set hôm nay sẽ về 0, sân sẽ trống.')) return;
    state.players.forEach(x => { x.sets = 0; x.status = x.status === 'absent' ? 'absent' : 'waiting'; x.waitSince = Date.now(); });
    state.courts.forEach(x => { x.players = []; x.status = 'empty'; });
    save(); render();
  };
  $('#sortWaiting').onchange = renderCourts;
  $('#addCourtBtn').onclick = () => openModal('addCourtModal');
  $('#openAddPlayerBtn').onclick = () => openModal('addPlayerModal');
  $$('[data-close]').forEach(x => x.onclick = closeModals);
  $$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModals(); }));

  $('#addPlayerForm').onsubmit = e => {
    e.preventDefault();
    const name = $('#playerNameInput').value.trim();
    if (!name) return;
    if (state.players.some(x => x.name.toLowerCase() === name.toLowerCase())) {
      alert('Tên này đã có rồi. Một sân có 3 ông Nam là đủ hỗn loạn rồi.'); return;
    }
    state.players.push({ id: uid(), name, gender: $('#playerGenderInput').value, level: +$('#playerLevelInput').value, regular: $('#playerRegularInput').checked, sets:0, status:'waiting', waitSince:Date.now(), partners:[], opponents:[] });
    e.target.reset(); closeModals(); save(); render();
  };
  $('#addCourtForm').onsubmit = e => {
    e.preventDefault();
    const name = $('#courtNameInput').value.trim();
    if (!name) return;
    state.courts.push({ id: uid(), name, status:'empty', players:[] });
    e.target.reset(); closeModals(); save(); render();
  };
  $('#rerollSuggestBtn').onclick = () => showSuggest(state.currentSuggestCourtId, true);
  $('#createSuggestedMatchBtn').onclick = createSuggestedMatch;
  $('#confirmFinishBtn').onclick = finishCourt;
  $$('.pill[data-player-filter]').forEach(btn => btn.onclick = () => { state.playerFilter = btn.dataset.playerFilter; state.selectedPlayers = []; save(); renderPlayers(); });
  $('#toggleSelectBtn').onclick = togglePlayerSelectMode;
  $('#selectAllBtn').onclick = selectAllVisiblePlayers;
  $('#bulkDeleteBtn').onclick = bulkDeletePlayers;
  $('#bulkAbsentBtn').onclick = () => bulkSetStatus('absent');
  $('#bulkPresentBtn').onclick = () => bulkSetStatus('waiting');
}

function render(){
  document.documentElement.dataset.theme = state.theme || 'light';
  $('#themeBtn').textContent = state.theme === 'dark' ? '☀️' : '🌙';
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#screen-${state.activeTab}`).classList.add('active');
  $$('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === state.activeTab));
  renderCourts(); renderPlayers();
}

function player(id){ return state.players.find(x => x.id === id); }
function presentPlayers(){ return state.players.filter(x => x.status !== 'absent'); }
function waitingPlayers(){ return state.players.filter(x => x.status === 'waiting'); }
function playingPlayers(){ return state.players.filter(x => x.status === 'playing'); }
function waitMinutes(x){ return Math.max(0, Math.floor((Date.now() - (x.waitSince || Date.now())) / 60000)); }
function stars(level){ return levelMap[level]?.stars || '☆☆☆'; }
function avatar(x){ return x.gender === 'Nữ' ? '👩' : '👨'; }

function renderCourts(){
  $('#statPresent').textContent = presentPlayers().length;
  $('#statPlaying').textContent = playingPlayers().length;
  $('#statWaiting').textContent = waitingPlayers().length;
  $('#waitingCount').textContent = `(${waitingPlayers().length})`;
  $('#courtsList').innerHTML = state.courts.map(courtHtml).join('');
  $('#waitingList').innerHTML = sortedWaiting().map(waitingHtml).join('') || `<div class="empty-card">Không còn ai chờ. Kỳ tích hiếm gặp trong thể thao phong trào.</div>`;
  bindDynamicCourtEvents();
}
function sortedWaiting(){
  const mode = $('#sortWaiting')?.value || 'waitDesc';
  const arr = [...waitingPlayers()];
  return arr.sort((a,b) => {
    if (mode === 'setsAsc') return a.sets - b.sets || waitMinutes(b)-waitMinutes(a);
    if (mode === 'levelDesc') return b.level - a.level;
    if (mode === 'nameAsc') return a.name.localeCompare(b.name,'vi');
    return waitMinutes(b) - waitMinutes(a);
  });
}
function courtHtml(c){
  const ps = c.players.map(player).filter(Boolean).slice(0, 4);
  const hasPlayers = ps.length > 0;
  const freeSlots = Math.max(0, 4 - ps.length);
  c.status = hasPlayers ? 'playing' : c.status === 'rest' ? 'rest' : 'empty';
  const status = hasPlayers ? `<span class="badge green">${freeSlots ? `Còn ${freeSlots} chỗ` : 'Đang chơi'}</span>` : c.status === 'rest' ? '<span class="badge gray">Nghỉ</span>' : '<span class="badge orange">Chờ xếp</span>';
  const slots = [...ps.map(x => miniPlayerHtml(x, c.id)), ...Array.from({length: freeSlots}, () => emptySlotHtml(c.id))];
  const body = hasPlayers ? `
    <div class="mini-court compact">
      <div class="team-mini">${slots.slice(0,2).join('')}</div>
      <div class="vs">VS</div>
      <div class="team-mini">${slots.slice(2,4).join('')}</div>
    </div>
    <div class="court-actions single"><button class="danger-btn finish-btn" data-id="${c.id}">Kết thúc set</button></div>` : `
    <div class="empty-court">${c.status === 'rest' ? 'Sân đang nghỉ' : 'Chưa có trận'}</div>
    ${c.status === 'rest' ? '' : `<div class="mini-court compact empty-court-grid"><div class="team-mini">${Array.from({length:2}, () => emptySlotHtml(c.id)).join('')}</div><div class="vs">VS</div><div class="team-mini">${Array.from({length:2}, () => emptySlotHtml(c.id)).join('')}</div></div><button class="ghost-btn suggest-btn" data-id="${c.id}">Gợi ý trận</button>`}`;
  return `<article class="court-card ${hasPlayers?'playing':c.status==='rest'?'rest':''}">
    <div class="court-top"><div class="court-title">${c.name}</div>${status}</div>${body}</article>`;
}
function miniPlayerHtml(x, courtId){
  return `<div class="mini-player court-person">
    <button class="remove-seat-btn" data-court-id="${courtId}" data-player-id="${x.id}" title="Xóa khỏi sân">×</button>
    <div class="avatar tiny">${avatar(x)}</div>
    <div class="mini-name">${x.name}</div>
    <div class="stars">${stars(x.level)}</div>
  </div>`;
}
function emptySlotHtml(courtId){
  return `<button class="mini-player empty-slot add-to-court-slot" data-court-id="${courtId}" title="Thêm người vào sân">
    <div class="avatar tiny">＋</div>
    <div class="mini-name">Thêm</div>
    <div class="stars">&nbsp;</div>
  </button>`;
}
function waitingHtml(x){
  const hot = waitMinutes(x) >= 15;
  return `<article class="wait-card ${hot?'priority':''}" data-player-id="${x.id}">
    <div class="avatar">${avatar(x)}</div>
    <div><div class="player-name">${x.name}</div><div class="stars">${stars(x.level)}</div><div class="sub">${levelMap[x.level].label}${x.regular?' · Khách quen':''}</div></div>
    <div class="metric"><b>${x.sets} set</b><span class="${hot?'hot':''}">Chờ ${waitMinutes(x)} phút</span></div>
  </article>`;
}
function bindDynamicCourtEvents(){
  $$('.suggest-btn').forEach(b => b.onclick = () => showSuggest(b.dataset.id));
  $$('.finish-btn').forEach(b => b.onclick = () => openFinish(b.dataset.id));
  $$('.remove-seat-btn').forEach(b => b.onclick = (e) => { e.stopPropagation(); removePlayerFromCourt(b.dataset.courtId, b.dataset.playerId); });
  $$('.add-to-court-slot').forEach(b => b.onclick = (e) => { e.stopPropagation(); openWaitingPickerForCourt(b.dataset.courtId); });
  $$('.wait-card').forEach(c => c.onclick = () => showWaitingActions(c.dataset.playerId));
}

function buildSuggest(skipShuffle=false){
  let arr = sortedWaiting();
  if (skipShuffle) arr = arr.sort(() => Math.random() - .5);
  if (arr.length < 4) return null;
  const candidates = arr.slice(0, Math.min(8, arr.length));
  let best = null;
  for (let a=0;a<candidates.length;a++) for (let b=a+1;b<candidates.length;b++) for (let c=b+1;c<candidates.length;c++) for (let d=c+1;d<candidates.length;d++){
    const group = [candidates[a],candidates[b],candidates[c],candidates[d]];
    const combos = [ [[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]] ];
    combos.forEach(co => {
      const A = co[0].map(i=>group[i]), B = co[1].map(i=>group[i]);
      const diff = Math.abs(sumLevel(A)-sumLevel(B));
      const waitScore = group.reduce((s,x)=>s+waitMinutes(x),0);
      const setPenalty = group.reduce((s,x)=>s+x.sets,0) * 3;
      const repeatPenalty = pairRepeated(A) + pairRepeated(B);
      const score = waitScore - diff*15 - setPenalty - repeatPenalty*20;
      if (!best || score > best.score) best = { A, B, diff, score };
    });
  }
  return best;
}
function sumLevel(arr){ return arr.reduce((s,x)=>s+x.level,0); }
function pairRepeated(arr){ return arr[0]?.partners?.includes(arr[1]?.id) ? 1 : 0; }
function showSuggest(courtId, reroll=false){
  state.currentSuggestCourtId = courtId;
  const c = state.courts.find(x => x.id === courtId);
  const suggestion = buildSuggest(reroll);
  state.suggested = suggestion ? { courtId, A: suggestion.A.map(x=>x.id), B: suggestion.B.map(x=>x.id), balance: Math.max(60, Math.round(100 - suggestion.diff * 12)) } : null;
  $('#suggestTitle').textContent = `Gợi ý trận cho ${c.name}`;
  $('#suggestContent').innerHTML = suggestion ? suggestHtml(suggestion) : `<div class="empty-card">Chưa đủ 4 người đang chờ để xếp trận.</div>`;
  $('#createSuggestedMatchBtn').style.display = suggestion ? 'block' : 'none';
  openModal('suggestModal'); save();
}
function suggestHtml(s){
  const balance = Math.max(60, Math.round(100 - s.diff * 12));
  return `<div class="suggest-team"><div class="suggest-title green">Đội A</div>${s.A.map(suggestPlayerHtml).join('')}</div>
  <div class="vs">VS</div>
  <div class="suggest-team"><div class="suggest-title">Đội B</div>${s.B.map(suggestPlayerHtml).join('')}</div>
  <div class="balance"><b>${balance}%</b><div class="sub">✓ Trình độ cân bằng<br>✓ Ít set hơn được ưu tiên<br>✓ Hạn chế đánh cặp gần đây</div></div>`;
}
function suggestPlayerHtml(x){
  return `<div class="suggest-player"><div class="avatar">${avatar(x)}</div><div><div class="player-name">${x.name}</div><div class="stars">${stars(x.level)}</div></div><div class="metric"><b>${x.sets} set</b><span>Chờ ${waitMinutes(x)} phút</span></div></div>`;
}
function createSuggestedMatch(){
  if (!state.suggested) return;
  const c = state.courts.find(x => x.id === state.suggested.courtId);
  c.players = [...state.suggested.A, ...state.suggested.B];
  c.status = 'playing';
  c.players.forEach(id => { const x = player(id); x.status = 'playing'; });
  closeModals(); save(); render();
}
function openFinish(courtId){ state.currentFinishCourtId = courtId; $('#finishTitle').textContent = `Kết thúc set ${state.courts.find(x=>x.id===courtId).name}`; openModal('finishModal'); }
function finishCourt(){
  const c = state.courts.find(x => x.id === state.currentFinishCourtId);
  if (!c) return;
  const ps = c.players.map(player).filter(Boolean);
  ps.forEach(x => { x.sets += 1; x.status = 'waiting'; x.waitSince = Date.now(); });
  if (ps.length === 4) {
    ps[0].partners.push(ps[1].id); ps[1].partners.push(ps[0].id);
    ps[2].partners.push(ps[3].id); ps[3].partners.push(ps[2].id);
  }
  state.matches.push({ id: uid(), courtId:c.id, players:c.players, score:`${$('#scoreA').value||''}-${$('#scoreB').value||''}`, endedAt:Date.now() });
  c.players = []; c.status = 'empty'; $('#scoreA').value=''; $('#scoreB').value=''; closeModals(); save(); render();
}
function clearCourt(courtId){
  const c = state.courts.find(x => x.id === courtId); if (!c) return;
  c.players.forEach(id => { const x = player(id); if (x){ x.status='waiting'; x.waitSince=Date.now(); }});
  c.players=[]; c.status='empty'; save(); render();
}

function getFilteredPlayers(){
  let arr = [...state.players];
  if (state.playerFilter === 'present') arr = arr.filter(x => x.status !== 'absent');
  if (state.playerFilter === 'away') arr = arr.filter(x => x.status === 'absent');
  return arr;
}
function renderPlayers(){
  $$('.pill[data-player-filter]').forEach(btn => btn.classList.toggle('active', btn.dataset.playerFilter === state.playerFilter));
  state.selectedPlayers = state.selectedPlayers.filter(id => state.players.some(x => x.id === id));
  const arr = getFilteredPlayers();
  $('#playersList').innerHTML = arr.map(playerCardHtml).join('') || `<div class="empty-card">Không có người chơi nào trong mục này.</div>`;
  $('#toggleSelectBtn').textContent = state.playerSelectMode ? 'Hủy' : 'Chọn';
  $('#bulkBar').style.display = state.playerSelectMode ? 'flex' : 'none';
  $('#selectAllBtn').textContent = arr.length && arr.every(x => state.selectedPlayers.includes(x.id)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
  $$('.edit-player-btn').forEach(b => b.onclick = (e) => { e.stopPropagation(); showPlayerEdit(b.dataset.playerId); });
  $$('.player-select').forEach(b => b.onclick = (e) => { e.stopPropagation(); togglePlayerSelected(b.dataset.playerId); });
}
function playerCardHtml(x){
  const badge = x.status === 'absent' ? '<span class="badge gray">Vắng</span>' : x.status === 'playing' ? '<span class="badge green">Đang chơi</span>' : '<span class="badge green">Có mặt</span>';
  const checked = state.selectedPlayers.includes(x.id);
  const selectBtn = state.playerSelectMode ? `<button class="player-select ${checked?'checked':''}" data-player-id="${x.id}">${checked?'✓':''}</button>` : '';
  return `<article class="player-card ${state.playerSelectMode?'selecting':''}" data-player-id="${x.id}">${selectBtn}<div class="avatar">${avatar(x)}</div><div><div class="player-name">${x.name}</div><div class="stars">${stars(x.level)}</div><div class="sub">${levelMap[x.level].label} · ${x.sets} set hôm nay${x.regular?' · Khách quen':''}</div></div>${badge}<button class="edit-player-btn" data-player-id="${x.id}">Sửa</button></article>`;
}
function togglePlayerSelectMode(){
  state.playerSelectMode = !state.playerSelectMode;
  state.selectedPlayers = [];
  save(); renderPlayers();
}
function togglePlayerSelected(id){
  state.selectedPlayers = state.selectedPlayers.includes(id) ? state.selectedPlayers.filter(x => x !== id) : [...state.selectedPlayers, id];
  save(); renderPlayers();
}
function selectAllVisiblePlayers(){
  const ids = getFilteredPlayers().map(x => x.id);
  const allSelected = ids.length && ids.every(id => state.selectedPlayers.includes(id));
  state.selectedPlayers = allSelected ? [] : ids;
  save(); renderPlayers();
}
function bulkDeletePlayers(){
  const ids = state.selectedPlayers;
  if (!ids.length) return alert('Chưa chọn ai cả. Nút nhiều mà không chọn thì cũng như mang vợt không dây.');
  if (!confirm(`Xóa ${ids.length} người chơi đã chọn?`)) return;
  ids.forEach(removeFromCourts);
  state.players = state.players.filter(x => !ids.includes(x.id));
  state.selectedPlayers = [];
  save(); render();
}
function bulkSetStatus(status){
  const ids = state.selectedPlayers;
  if (!ids.length) return alert('Chưa chọn người chơi nào.');
  ids.forEach(id => {
    const x = player(id); if (!x) return;
    removeFromCourts(id);
    x.status = status;
    if (status === 'waiting') x.waitSince = Date.now();
  });
  state.selectedPlayers = [];
  save(); render();
}
function showPlayerEdit(id){
  const x = player(id); if (!x) return;
  $('#playerDetail').innerHTML = playerDetailHtml(x) + `
    <div class="quick-actions">
      <button class="present-btn" id="setPresentBtn">Có mặt</button>
      <button class="away-btn" id="setAbsentBtn">Vắng</button>
      <button class="danger-btn" id="deletePlayerBtn">Xóa người chơi</button>
    </div>`;
  openModal('playerModal');
  $('#setPresentBtn').onclick = () => { x.status = 'waiting'; x.waitSince = Date.now(); save(); closeModals(); render(); };
  $('#setAbsentBtn').onclick = () => { x.status = 'absent'; removeFromCourts(x.id); save(); closeModals(); render(); };
  $('#deletePlayerBtn').onclick = () => { if(confirm(`Xóa ${x.name}?`)){ state.players = state.players.filter(p=>p.id!==x.id); removeFromCourts(x.id); save(); closeModals(); render(); }};
}
function showPlayerDetail(id){
  const x = player(id); if (!x) return;
  $('#playerDetail').innerHTML = playerDetailHtml(x) + `
  <button class="primary-btn" id="togglePresentBtn">${x.status === 'absent' ? 'Cho có mặt' : 'Cho vắng'}</button>
  <button class="danger-btn" style="margin-top:8px" id="deletePlayerBtn">Xóa người chơi</button>`;
  openModal('playerModal');
  $('#togglePresentBtn').onclick = () => { x.status = x.status === 'absent' ? 'waiting' : 'absent'; x.waitSince = Date.now(); removeFromCourts(x.id); closeModals(); save(); render(); };
  $('#deletePlayerBtn').onclick = () => { if(confirm(`Xóa ${x.name}?`)){ state.players = state.players.filter(p=>p.id!==x.id); removeFromCourts(x.id); closeModals(); save(); render(); }};
}
function playerDetailHtml(x){
  return `<div style="text-align:center;margin:10px 0"><div class="avatar" style="width:70px;height:70px;font-size:38px">${avatar(x)}</div><h2 style="margin:8px 0 0">${x.name}</h2><div class="stars" style="font-size:18px">${stars(x.level)}</div></div>
  <div class="detail-grid">
    <div class="detail-row"><span>Trạng thái</span><b>${x.status === 'playing' ? 'Đang chơi' : x.status === 'absent' ? 'Vắng' : 'Có mặt'}</b></div>
    <div class="detail-row"><span>Set hôm nay</span><b>${x.sets}</b></div>
    <div class="detail-row"><span>Trình độ</span><b>${levelMap[x.level].label}</b></div>
    <div class="detail-row"><span>Giới tính</span><b>${x.gender}</b></div>
    <div class="detail-row"><span>Khách quen</span><b>${x.regular ? 'Có' : 'Không'}</b></div>
  </div>`;
}
function showWaitingActions(id){
  const x = player(id); if (!x) return;
  $('#playerDetail').innerHTML = playerDetailHtml(x) + `
    <button class="primary-btn" id="showCourtChoicesBtn">Lên sân</button>
    <div id="courtChoices" class="court-choice-list" style="display:none"></div>
    <button class="ghost-btn" style="margin-top:8px" id="restPlayerBtn">Nghỉ</button>`;
  openModal('playerModal');
  $('#showCourtChoicesBtn').onclick = () => renderCourtChoicesForPlayer(x.id);
  $('#restPlayerBtn').onclick = () => { x.status = 'absent'; removeFromCourts(x.id); closeModals(); save(); render(); };
}
function renderCourtChoicesForPlayer(playerId){
  const choices = state.courts.filter(c => c.players.length < 4 && c.status !== 'rest');
  $('#courtChoices').style.display = 'grid';
  $('#courtChoices').innerHTML = choices.length ? choices.map(c => `<button class="court-choice-btn" data-court-id="${c.id}">${c.name}<span>${4 - c.players.length} chỗ trống</span></button>`).join('') : `<div class="empty-card">Không còn sân trống. Đúng kiểu phong trào: lúc cần thì không có chỗ.</div>`;
  $$('#courtChoices .court-choice-btn').forEach(b => b.onclick = () => addPlayerToCourt(b.dataset.courtId, playerId));
}
function openWaitingPickerForCourt(courtId){
  const court = state.courts.find(c=>c.id===courtId); if (!court) return;
  const list = waitingPlayers();
  $('#playerDetail').innerHTML = `<h2>Thêm vào ${court.name}</h2><p class="muted">Chọn người đang chờ để lấp chỗ trống.</p><div class="court-choice-list player-picker-list">${list.length ? list.map(x => `<button class="court-choice-btn picker-player-btn" data-player-id="${x.id}"><span class="picker-left"><span class="avatar">${avatar(x)}</span><span><b>${x.name}</b><small>${levelMap[x.level].label} · ${stars(x.level)}</small></span></span><span>${x.sets} set · chờ ${waitMinutes(x)} phút</span></button>`).join('') : '<div class="empty-card">Không có ai đang chờ.</div>'}</div>`;
  openModal('playerModal');
  $$('#playerDetail .court-choice-btn').forEach(b => b.onclick = () => addPlayerToCourt(courtId, b.dataset.playerId));
}
function addPlayerToCourt(courtId, playerId){
  const c = state.courts.find(x => x.id === courtId);
  const x = player(playerId);
  if (!c || !x) return;
  if (c.players.length >= 4) { alert('Sân này đủ 4 người rồi. Đừng nhồi như xe khách lễ.'); return; }
  removeFromCourts(playerId);
  c.players.push(playerId);
  c.status = 'playing';
  x.status = 'playing';
  closeModals(); save(); render();
}
function removePlayerFromCourt(courtId, playerId){
  const c = state.courts.find(x => x.id === courtId);
  const x = player(playerId);
  if (!c || !x) return;
  c.players = c.players.filter(id => id !== playerId);
  x.status = 'waiting';
  x.waitSince = Date.now();
  if (!c.players.length) c.status = 'empty';
  save(); render();
}
function removeFromCourts(id){ state.courts.forEach(c => { c.players = c.players.filter(pid=>pid!==id); if(!c.players.length && c.status==='playing') c.status='empty'; }); }
function openModal(id){ $('#'+id).classList.add('show'); }
function closeModals(){ $$('.modal').forEach(m => m.classList.remove('show')); }

init();
