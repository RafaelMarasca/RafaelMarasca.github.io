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

function notice(message) {
  clearTimeout(notifyTimer);
  el('notice').textContent = message;
  notifyTimer = setTimeout(() => { el('notice').textContent = ''; }, 4200);
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
    notice(bought ? 'Presente marcado como comprado.' : 'Presente voltou para Por comprar.');
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
const giftIcon = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5.5-1.5S9 7 12 7c3 0 6-.5 5.5-1.5S13.5 4 12 7"/></svg>';
function tags(g) {
  const box = node('div', '', 'tags');
  box.append(node('span', g.forWhom, 'tag ' + recipientClass(g.forWhom)),
    node('span', 'Prioridade ' + g.priority.toLowerCase(), 'tag priority-' + fold(g.priority)));
  return box;
}
function purchaseToggle(g, label) {
  const purchase = node('label', '', 'purchase');
  const check = node('input');
  check.type = 'checkbox';
  check.checked = g.bought;
  check.disabled = pendingPurchases.has(g.id);
  const action = g.bought ? 'Comprado' : label;
  check.setAttribute('aria-label', (g.bought ? 'Comprado' : 'Marcar como comprado') + ': ' + g.title);
  const caption = node('span', check.disabled ? 'Salvando…' : action);
  check.onchange = () => {
    check.disabled = true;
    caption.textContent = 'Salvando…';
    void setPurchased(g, check.checked);
  };
  purchase.append(check, caption);
  return purchase;
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
    // The photo and the title both open the details; the photo button is for pointer users only.
    const photo = node('button', '', 'card-photo');
    photo.type = 'button';
    photo.tabIndex = -1;
    photo.setAttribute('aria-hidden', 'true');
    photo.innerHTML = '<span class="placeholder">' + giftIcon + '</span>';
    if (g.bought) photo.append(node('span', 'Comprado ✓', 'bought-ribbon'));
    photo.onclick = () => openViewer(g);
    const body = node('div', '', 'card-body');
    const title = node('h3');
    const open = node('button', g.title, 'card-title');
    open.type = 'button';
    open.onclick = () => openViewer(g);
    title.append(open);
    const notes = node('p', '', 'card-note');
    const actions = node('div', '', 'card-actions');
    const edit = node('button', 'Editar', 'quiet');
    edit.type = 'button';
    edit.setAttribute('aria-label', 'Editar ' + g.title);
    edit.onclick = () => startEdit(g);
    actions.append(purchaseToggle(g, 'Comprar'), edit);
    body.append(tags(g), title, notes, actions);
    card.append(photo, body);
    cards.append(card);
    card.loadDetails = async () => {
      try {
        const record = await readGift(g);
        if (revision !== viewRevision || !card.isConnected) return;
        if (record.photo) {
          const img = node('img');
          img.alt = '';
          img.src = record.photo;
          photo.querySelector('.placeholder').replaceWith(img);
        }
        notes.textContent = record.description;
        if (record.link && /^https?:\/\//i.test(record.link)) {
          const a = node('a', 'Loja ↗', 'store-link');
          a.href = record.link; a.target = '_blank'; a.rel = 'noopener noreferrer';
          a.setAttribute('aria-label', 'Ver ' + g.title + ' na loja');
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
  el('viewerTags').replaceWith(Object.assign(tags(g), {id: 'viewerTags'}));
  const check = el('viewerBought');
  check.checked = g.bought;
  check.disabled = pendingPurchases.has(g.id);
  el('viewerBoughtText').textContent = check.disabled ? 'Salvando…' : g.bought ? 'Comprado' : 'Marcar como comprado';
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
el('viewerBought').onchange = () => {
  const g = gifts.find(item => item.id === viewing);
  if (!g) return;
  el('viewerBought').disabled = true;
  el('viewerBoughtText').textContent = 'Salvando…';
  void setPurchased(g, el('viewerBought').checked);
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
  el('loading').hidden = true; el('board').hidden = false;
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
el('add').onclick = () => openForm();
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
