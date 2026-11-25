'use strict';
const listUrl = 'https://rafaelmarasca.github.io/presentes.html';
const el = id => document.getElementById(id);
if (location.hash.startsWith('#convite=')) history.replaceState(null, '', location.pathname + location.search);
try { localStorage.removeItem('lulu.gifts.invite'); } catch {}
// A entrada é feita uma vez para o site todo (site-acesso.js).
let session = '';
let gifts = [], details = new Map(), editing, draftPhoto = '', photoWork = 0, busy = false;
let requestNumber = 0, viewRevision = 0, notifyTimer;
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    observer.unobserve(entry.target);
    entry.target.loadDetails?.();
  }
}, {rootMargin:'250px'});

// A short message at the bottom, optionally with one action (like "Desfazer").
function notice(message, action) {
  clearTimeout(notifyTimer);
  const box = el('notice');
  box.replaceChildren(document.createTextNode(message));
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'notice-action';
    button.textContent = action.label;
    button.onclick = () => { clearTimeout(notifyTimer); box.replaceChildren(); action.run(); };
    box.append(button);
  }
  notifyTimer = setTimeout(() => box.replaceChildren(), action ? 7000 : 4200);
}
async function api(path, method = 'GET', body, version) {
  const headers = {};
  if (version) headers['X-Gift-Version'] = version;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await siteAccess.request(path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body)});
  try { return await response.json(); }
  catch { throw new Error('Não foi possível conectar à lista. Confira sua conexão e tente de novo.'); }
}
el('share').onclick = async () => {
  try { await navigator.clipboard.writeText(listUrl); notice('Link copiado.'); }
  catch { el('shareValue').value = listUrl; el('shareDialog').showModal(); el('shareValue').select(); }
};
document.querySelectorAll('.close').forEach(btn => btn.onclick = () => btn.closest('dialog').close());
function node(tag, text, cls) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (cls) element.className = cls;
  return element;
}
function readGift(item) {
  const cached = details.get(item.id);
  if (cached?.version === item.version) return cached.promise;
  const promise = api('/gifts/' + item.id);
  details.set(item.id,{version:item.version,promise});
  promise.catch(() => { if (details.get(item.id)?.promise === promise) details.delete(item.id); });
  return promise;
}
function selectedFilter(id) {
  return el(id).querySelector('input:checked').value;
}
const pendingPurchases = new Set();
async function setPurchased(item, bought) {
  if (pendingPurchases.has(item.id)) return;
  pendingPurchases.add(item.id);
  const activeSession = session;
  try {
    const record = await readGift(item);
    if (!session || session !== activeSession) return;
    const updated = {...record, bought};
    if (record.bought !== bought) {
      const saved = await api('/gifts/' + item.id, 'PUT', updated, record.version);
      updated.version = saved.version;
      updated.updated = Date.now();
    }
    if (session !== activeSession) return;
    requestNumber++;
    details.set(item.id, {version: updated.version, promise: Promise.resolve(updated)});
    gifts = gifts.map(g => g.id === item.id ? {...g, bought, updated: updated.updated, version: updated.version} : g);
    notice(bought ? '“' + item.title + '” marcado como comprado.' : '“' + item.title + '” voltou para Por comprar.',
      {label: 'Desfazer', run: () => setPurchased(item, !bought)});
  } catch (e) {
    if (session === activeSession) notice(e.message);
  } finally {
    pendingPurchases.delete(item.id);
    if (session && session === activeSession) {
      render();
      void refresh();
    }
  }
}
const fold = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const recipientClass = person => ({Lulu: 'for-lulu', Rafo: 'for-rafo', 'Nós dois': 'for-nos'})[person] || '';
const moonDrawing = '<svg aria-hidden="true" viewBox="0 0 64 64"><path d="M40 10a22 22 0 1 0 14 34A19 19 0 0 1 40 10Z"/><path class="star" d="M16 14l1.6 3.6L21 19l-3.4 1.4L16 24l-1.6-3.6L11 19l3.4-1.4Z"/><circle class="star" cx="50" cy="16" r="1.6"/></svg>';
// Priority as hearts, like a little note: ♥♥♥ alta, ♥♥♡ média, ♥♡♡ baixa.
function hearts(g) {
  const filled = {Alta: 3, 'Média': 2, Baixa: 1}[g.priority] || 1;
  const box = node('span', '', 'hearts');
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', 'Prioridade ' + g.priority.toLowerCase());
  for (let i = 0; i < 3; i++) box.append(node('i', i < filled ? '♥' : '♡', i < filled ? 'on' : ''));
  return box;
}
function forLine(g) {
  const line = node('p', '', 'for-line ' + recipientClass(g.forWhom));
  line.append(node('span', 'para ' + (g.forWhom === 'Nós dois' ? 'nós dois' : g.forWhom), 'for'), hearts(g));
  return line;
}
// A small, steady tilt per gift, so the board looks pinned by hand but doesn't jump around.
function tiltFor(id) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return ((Math.abs(hash) % 7) - 3) * .45;
}
const bagIcon = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8"/></svg>';
const tickIcon = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
// One button that says what it does: "Marcar como comprado", then a filled "Comprado" that undoes on tap.
function paintPurchase(button, g) {
  const pending = pendingPurchases.has(g.id);
  button.className = 'buy' + (g.bought ? ' is-on' : '');
  button.disabled = pending;
  button.setAttribute('aria-pressed', String(g.bought));
  button.setAttribute('aria-label', g.bought ? g.title + ': comprado. Toque para voltar a Por comprar' : 'Marcar ' + g.title + ' como comprado');
  button.innerHTML = g.bought ? tickIcon : bagIcon;
  button.append(pending ? node('span', 'Salvando…') : g.bought ? node('span', 'Comprado')
    : Object.assign(node('span'), {innerHTML: '<span class="long">Marcar como comprado</span><span class="short">Comprei</span>'}));
}
function purchaseToggle(g) {
  const button = node('button');
  button.type = 'button';
  paintPurchase(button, g);
  button.onclick = () => {
    pendingPurchases.add(g.id);
    paintPurchase(button, g);
    pendingPurchases.delete(g.id);
    void setPurchased(g, !g.bought);
  };
  return button;
}
function textButton(label, aria, onClick) {
  const button = node('button', label, 'text-link');
  button.type = 'button';
  button.setAttribute('aria-label', aria);
  button.onclick = onClick;
  return button;
}
function render() {
  const revision = ++viewRevision;
  observer.disconnect();
  const recipient = selectedFilter('recipientFilter'), status = selectedFilter('statusFilter'), order = el('sort').value;
  const query = fold(el('search').value.trim());
  const ranks = {Alta:0,'Média':1,Baixa:2};
  const searched = gifts.filter(g => !query || query.split(/\s+/).every(word => fold(g.title + ' ' + g.forWhom).includes(word)));
  const byRecipient = searched.filter(g => !recipient || recipient === g.forWhom);
  const bought = byRecipient.filter(g => g.bought).length;
  el('boughtCount').textContent = bought;
  el('openCount').textContent = byRecipient.length - bought;
  el('statusTotal').textContent = byRecipient.length;
  const byStatus = searched.filter(g => status === 'all' || (status === 'bought') === g.bought);
  for (const badge of el('recipientFilter').querySelectorAll('[data-recipient-count]')) {
    const person = badge.dataset.recipientCount;
    badge.textContent = person ? byStatus.filter(g => g.forWhom === person).length : byStatus.length;
  }
  const shown = byStatus.filter(g => !recipient || recipient === g.forWhom);
  shown.sort((a,b) => {
    if (order === 'name') return a.title.localeCompare(b.title,'pt-BR');
    if (order === 'priority') return Number(a.bought)-Number(b.bought) || ranks[a.priority]-ranks[b.priority] || b.updated-a.updated;
    return b.updated-a.updated;
  });
  const cards = el('cards'); cards.replaceChildren();
  for (const g of shown) {
    const card = node('article', '', 'card ' + recipientClass(g.forWhom) + (g.bought ? ' is-bought' : ''));
    card.style.setProperty('--tilt', tiltFor(g.id) + 'deg');
    // The polaroid and the title both open the details; the polaroid is for pointer users only.
    const polaroid = node('button', '', 'polaroid');
    polaroid.type = 'button';
    polaroid.tabIndex = -1;
    polaroid.setAttribute('aria-hidden', 'true');
    const print = node('span', '', 'print');
    print.innerHTML = '<span class="night">' + moonDrawing + '</span>';
    if (g.bought) print.append(node('span', 'comprado', 'stamp'));
    polaroid.append(print, forLine(g));
    polaroid.onclick = () => openViewer(g);
    const body = node('div', '', 'card-text');
    const title = node('h3');
    const open = node('button', g.title, 'card-title');
    open.type = 'button';
    open.onclick = () => openViewer(g);
    title.append(open);
    const notes = node('p', '', 'card-note');
    const actions = node('div', '', 'card-actions');
    const edit = textButton('editar', 'Editar ' + g.title, () => startEdit(g));
    actions.append(purchaseToggle(g), edit);
    body.append(title, notes, actions);
    card.append(polaroid, body);
    cards.append(card);
    card.loadDetails = async () => {
      try {
        const record = await readGift(g);
        if (revision !== viewRevision || !card.isConnected) return;
        if (record.photo) {
          const img = node('img');
          img.alt = '';
          img.src = record.photo;
          print.querySelector('.night').replaceWith(img);
        }
        notes.textContent = record.description;
        if (record.link && /^https?:\/\//i.test(record.link)) {
          const a = node('a', 'ver na loja', 'text-link');
          a.href = record.link; a.target = '_blank'; a.rel = 'noopener noreferrer';
          a.setAttribute('aria-label', 'Ver ' + g.title + ' na loja (abre em outra aba)');
          edit.before(a);
        }
      } catch (e) { if (revision === viewRevision) notes.textContent = e.message; }
    };
    observer.observe(card);
  }
  const purchased = shown.filter(g => g.bought).length;
  el('counter').textContent = shown.length
    ? purchased + ' de ' + shown.length + (shown.length === 1 ? ' presente comprado' : ' presentes comprados')
    : 'Nenhum presente aqui';
  el('progressBar').style.width = (shown.length ? purchased / shown.length * 100 : 0) + '%';
  const filtered = Boolean(query || recipient || status !== 'all');
  el('empty').hidden = !!shown.length;
  el('clearFilters').hidden = !filtered;
  el('emptyTitle').textContent = gifts.length ? 'Nenhum presente encontrado' : 'Qual vai ser o primeiro presente?';
  el('emptyText').textContent = gifts.length ? 'Tente outro nome ou outro filtro.' : 'Adicione uma ideia com uma foto, um link ou aquele detalhe que faz a diferença.';
  if (el('viewer').open && viewing) refreshViewer();
}

// ---------- Detalhes ----------
let viewing = null, viewerRequest = 0;
async function openViewer(g) {
  viewing = g.id;
  refreshViewer();
  if (!el('viewer').open) el('viewer').showModal();
}
async function refreshViewer() {
  const g = gifts.find(item => item.id === viewing);
  if (!g) { el('viewer').close(); return; }
  const request = ++viewerRequest;
  el('viewerTitle').textContent = g.title;
  el('viewerTags').replaceWith(Object.assign(forLine(g), {id: 'viewerTags'}));
  paintPurchase(el('viewerBuy'), g);
  el('viewer').classList.toggle('is-bought', g.bought);
  try {
    const record = await readGift(g);
    if (request !== viewerRequest) return;
    const photo = el('viewerPhoto');
    photo.hidden = !record.photo;
    if (record.photo) {
      const img = photo.querySelector('img') || photo.appendChild(node('img'));
      img.alt = 'Foto de ' + g.title;
      if (img.src !== record.photo) img.src = record.photo;
    } else photo.replaceChildren();
    el('viewerText').textContent = record.description || 'Sem descrição.';
    el('viewerText').classList.toggle('is-empty', !record.description);
    const link = el('viewerLink');
    link.hidden = !(record.link && /^https?:\/\//i.test(record.link));
    if (!link.hidden) link.href = record.link;
  } catch (e) { if (request === viewerRequest) el('viewerText').textContent = e.message; }
}
el('viewerBuy').onclick = () => {
  const g = gifts.find(item => item.id === viewing);
  if (!g) return;
  pendingPurchases.add(g.id);
  paintPurchase(el('viewerBuy'), g);
  pendingPurchases.delete(g.id);
  void setPurchased(g, !g.bought);
};
el('viewerEdit').onclick = () => {
  const g = gifts.find(item => item.id === viewing);
  el('viewer').close();
  if (g) startEdit(g);
};
el('viewer').addEventListener('close', () => { viewing = null; });
// Click on the dimmed backdrop closes the details.
el('viewer').addEventListener('click', event => { if (event.target === el('viewer')) el('viewer').close(); });
el('search').addEventListener('input', render);
el('clearFilters').onclick = () => {
  el('search').value = '';
  el('recipientFilter').querySelector('input[value=""]').checked = true;
  el('statusFilter').querySelector('input[value="all"]').checked = true;
  render();
};
async function refresh(force = false) {
  const number = ++requestNumber;
  try {
    const result = await api('/gifts');
    if (number !== requestNumber || !session) return;
    const changed = force || JSON.stringify(gifts) !== JSON.stringify(result.items);
    gifts = result.items;
    for (const key of details.keys()) if (!gifts.some(g => g.id === key)) details.delete(key);
    if (changed) render();
    el('sync').textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  } catch (e) { if (number === requestNumber) el('sync').textContent = e.message; }
}
async function enter() {
  session = 'aberta';
  el('loading').hidden = true; el('board').hidden = false; el('fab').hidden = false;
  el('empty').hidden = true; el('counter').textContent = 'Carregando…'; el('sync').textContent = '';
  await refresh(true);
}
el('refresh').onclick = () => refresh(true);
['recipientFilter','statusFilter','sort'].forEach(id => el(id).onchange = render);
setInterval(() => { if (session && !document.hidden) refresh(); },15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && session) refresh(); });

function setPhoto(value) {
  draftPhoto = value; el('preview').hidden = !value; el('removePhoto').hidden = !value;
  if (value) el('preview').src = value; else el('preview').removeAttribute('src');
}
function openForm(item) {
  el('giftForm').reset(); photoWork++; busy = false;
  editing = item || {id:crypto.randomUUID(),version:'new'};
  el('giftTitle').value = item?.title || ''; el('giftLink').value = item?.link || '';
  el('description').value = item?.description || ''; el('forWhom').value = item?.forWhom || selectedFilter('recipientFilter') || 'Lulu';
  el('priority').value = item?.priority || 'Média';
  el('editorTitle').textContent = item ? 'Editar presente' : 'Novo presente';
  el('editError').textContent = ''; el('delete').hidden = !item; el('save').disabled = false;
  setPhoto(item?.photo || ''); el('editor').showModal(); el('giftTitle').focus();
}
async function startEdit(g) {
  try { const record = await readGift(g); if (session && !el('editor').open) openForm(record); } catch(e) {notice(e.message);}
}
el('fab').onclick = () => openForm();
el('editor').addEventListener('close',()=>{photoWork++;setPhoto('');});
el('editor').addEventListener('cancel',event=>{if(busy) event.preventDefault();});
el('choose').onclick = () => el('photoFile').click();
el('removePhoto').onclick = () => {photoWork++; setPhoto(''); el('save').disabled=false;};
async function loadPhoto(file) {
  if (!file || busy) return;
  const job = ++photoWork; el('editError').textContent = ''; el('save').disabled = true;
  const objectUrl = URL.createObjectURL(file);
  try {
    if (!file.type.startsWith('image/') || file.size > 25*1024*1024) throw new Error('Escolha uma imagem de até 25 MB.');
    const img = new Image(); img.src = objectUrl; await img.decode();
    let size = 1200, photo;
    do {
      const scale = Math.min(1,size/Math.max(img.width,img.height)), canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(img.width*scale)); canvas.height = Math.max(1,Math.round(img.height*scale));
      const ctx = canvas.getContext('2d'); ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
      photo = canvas.toDataURL('image/jpeg',.82); size = Math.floor(size*.75);
    } while (photo.length > 690000 && size >= 160);
    if (photo.length > 690000) throw new Error('Escolha uma foto menor.');
    if (job === photoWork) setPhoto(photo);
  } catch(e) { if(job===photoWork) el('editError').textContent = e.name === 'EncodingError' ? 'Formato não reconhecido. Use JPG, PNG ou WebP.' : e.message; }
  finally { URL.revokeObjectURL(objectUrl); if(job===photoWork) el('save').disabled=false; }
}
el('photoFile').onchange = event => { loadPhoto(event.target.files[0]); event.target.value=''; };
el('drop').ondragover = event => {event.preventDefault();el('drop').classList.add('over');};
el('drop').ondragleave = () => el('drop').classList.remove('over');
el('drop').ondrop = event => {event.preventDefault();el('drop').classList.remove('over');loadPhoto(event.dataTransfer.files[0]);};
document.addEventListener('paste',event=>{
  if (!session || el('shareDialog').open || el('confirmDelete').open || el('viewer').open || busy) return;
  const data=event.clipboardData; const image=Array.from(data?.items||[]).find(i=>i.kind==='file'&&i.type.startsWith('image/'));
  if (image) {event.preventDefault();if(!el('editor').open)openForm();loadPhoto(image.getAsFile());return;}
  if(el('editor').open || event.target.closest('input,textarea,[contenteditable]')) return;
  const value=data?.getData('text/plain')?.trim(); if(!value)return;
  event.preventDefault();openForm();
  if(/^https?:\/\//i.test(value)) el('giftLink').value=value; else el('description').value=value.slice(0,2000);
});
function saving(on) {
  busy=on; el('save').disabled=on;el('delete').disabled=on;el('editor').querySelector('.close').disabled=on;
  el('save').textContent=on?'Salvando…':'Salvar presente';
}
el('giftForm').onsubmit = async event=>{
  event.preventDefault();if(busy||el('save').disabled)return;
  const title=el('giftTitle').value.trim(),link=el('giftLink').value.trim();
  if(!title || (link && !/^https?:\/\//i.test(link))) {el('editError').textContent='Informe um nome e, se houver link, use http ou https.';return;}
  const gift={title,link,description:el('description').value.trim(),forWhom:el('forWhom').value,priority:el('priority').value,bought:editing.bought ?? false,photo:draftPhoto};
  saving(true);el('editError').textContent='';
  try {await api('/gifts/'+editing.id,'PUT',gift,editing.version);el('editor').close();notice('Presente salvo.');await refresh(true);}
  catch(e){el('editError').textContent=e.message;}
  finally{saving(false);}
};
el('delete').onclick=()=>{el('deleteText').textContent='“'+el('giftTitle').value+'” será removido da lista dos dois.';el('confirmDelete').showModal();el('cancelDelete').focus();};
el('cancelDelete').onclick=()=>el('confirmDelete').close();
el('yesDelete').onclick=async()=>{
  el('confirmDelete').close();saving(true);
  try{await api('/gifts/'+editing.id,'DELETE',undefined,editing.version);el('editor').close();notice('Presente excluído.');await refresh(true);}
  catch(e){el('editError').textContent=e.message;}finally{saving(false);}
};
siteAccess.ready.then(enter);
