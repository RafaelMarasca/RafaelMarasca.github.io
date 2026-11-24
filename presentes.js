'use strict';
const apiOrigin = 'https://presentes-lulu-e-rafo.rafaelmarascamartins.chatgpt.site';
const accountEntry = location.hostname === 'rafaelmarasca.github.io';
const privateApp = location.origin === apiOrigin;
const el = id => document.getElementById(id);
const inviteFormat = /^[A-Za-z0-9_-]{43}$/;
const inviteKey = 'lulu.gifts.invite';
const sessionKey = 'lulu.gifts.session';
function stored(storage, key, value) {
  try {
    if (value === undefined) return window[storage].getItem(key) || '';
    if (value) window[storage].setItem(key, value);
    else window[storage].removeItem(key);
  } catch { /* The current tab still works when storage is unavailable. */ }
  return '';
}
function inviteFrom(value) {
  if (inviteFormat.test(value)) return value;
  try {
    const url = new URL(value);
    const key = new URLSearchParams(url.hash.slice(1)).get('convite');
    return inviteFormat.test(key) ? key : '';
  } catch { return ''; }
}
const incoming = inviteFrom(location.href);
let invite = incoming || stored('localStorage', inviteKey);
let session = stored('sessionStorage', sessionKey);
if (incoming) history.replaceState(null, '', location.pathname + location.search);
const privateEntry = el('privateEntry');
privateEntry.hidden = !accountEntry;
privateEntry.onclick = () => {
  const key = invite || inviteFrom(el('inviteInput').value.trim());
  privateEntry.href = apiOrigin + '/lista' + (key ? '#convite=' + key : '');
};
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
function showGate(message = '') {
  session = ''; stored('sessionStorage', sessionKey, '');
  gifts = []; details.clear(); requestNumber++; viewRevision++; observer.disconnect();
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  el('giftForm').reset(); draftPhoto = ''; el('preview').removeAttribute('src');
  el('cards').replaceChildren(); el('board').hidden = true; el('gate').hidden = false;
  el('inviteLabel').hidden = !!invite || privateApp || accountEntry; el('gateError').textContent = message;
  el('gateHint').textContent = invite || privateApp ? 'Digite o código compartilhado para ver e editar os presentes.' : 'Cole o convite privado e digite o código compartilhado.';
  if (accountEntry) {
    el('gateHint').textContent = 'Entre com a conta autorizada. Depois, confirme o código para abrir a lista.';
    el('pinLabel').hidden = true; el('pin').disabled = true; el('unlockButton').hidden = true;
  }
}
async function api(path, method = 'GET', body, version) {
  const headers = {};
  if (session) headers['X-Gift-Session'] = session;
  if (version) headers['X-Gift-Version'] = version;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response, data;
  try {
    response = await fetch(apiOrigin + path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache:'no-store', credentials:'same-origin', referrerPolicy:'no-referrer'});
    data = await response.json();
  } catch { throw new Error('Não foi possível conectar à lista. Confira sua conexão e tente de novo.'); }
  if (!response.ok) {
    if (response.status === 401 && session) showGate('Sua sessão terminou. Digite o código novamente.');
    throw new Error(data.error || 'Não foi possível concluir.');
  }
  return data;
}
el('unlock').addEventListener('submit', async event => {
  event.preventDefault();
  if (accountEntry) { privateEntry.click(); return; }
  const candidate = invite || inviteFrom(el('inviteInput').value.trim());
  if (!candidate && !privateApp) { el('gateError').textContent = 'Cole o link privado completo que você recebeu.'; return; }
  const button = event.submitter || el('unlock').querySelector('button');
  button.disabled = true; el('gateError').textContent = '';
  try {
    const data = await api('/unlock','POST',{invite:candidate,code:el('pin').value});
    invite = candidate; stored('localStorage',inviteKey,invite);
    session = data.session; stored('sessionStorage',sessionKey,session);
    el('pin').value = ''; el('inviteInput').value = '';
    await enter();
  } catch (e) {
    el('gateError').textContent = e.message;
    if (/Convite inválido/.test(e.message)) { invite = ''; stored('localStorage',inviteKey,''); el('inviteLabel').hidden = false; }
  } finally { button.disabled = false; }
});
function inviteLink() { const url = new URL('https://rafaelmarasca.github.io/presentes.html'); if (invite) url.hash = 'convite=' + invite; return url.href; }
el('share').onclick = async () => {
  try { await navigator.clipboard.writeText(inviteLink()); notice('Convite copiado. Envie o código separadamente.'); }
  catch { el('shareValue').value = inviteLink(); el('shareDialog').showModal(); el('shareValue').select(); }
};
el('lock').onclick = () => { showGate(); el('pin').focus(); };
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
function render() {
  const revision = ++viewRevision;
  observer.disconnect();
  const recipient = el('recipientFilter').value, status = el('statusFilter').value, order = el('sort').value;
  const ranks = {Alta:0,'Média':1,Baixa:2};
  const shown = gifts.filter(g => (!recipient || recipient === g.forWhom) && (status === 'all' || (status === 'bought') === g.bought));
  shown.sort((a,b) => {
    if (order === 'name') return a.title.localeCompare(b.title,'pt-BR');
    if (order === 'priority') return Number(a.bought)-Number(b.bought) || ranks[a.priority]-ranks[b.priority] || b.updated-a.updated;
    return b.updated-a.updated;
  });
  const cards = el('cards'); cards.replaceChildren();
  for (const g of shown) {
    const card = node('article','','card'), image = node('div','☾','card-image'), body = node('div','','card-body');
    image.setAttribute('aria-hidden','true');
    const meta = node('div','','meta'); meta.append(node('span','Para ' + g.forWhom),node('span','Prioridade ' + g.priority.toLowerCase()));
    const notes = node('p','','card-note'), actions = node('div','','actions'), edit = node('button','Editar');
    edit.onclick = () => startEdit(g); actions.append(edit);
    body.append(meta,node('h3',g.title),notes);
    if (g.bought) body.append(node('span','✓ Comprado','done'));
    body.append(actions); card.append(image,body); cards.append(card);
    card.loadDetails = async () => {
      try {
        const record = await readGift(g);
        if (revision !== viewRevision || !card.isConnected) return;
        if (record.photo) { const img = node('img'); img.alt = ''; img.src = record.photo; image.replaceChildren(img); }
        notes.textContent = record.description;
        if (record.link && /^https?:\/\//i.test(record.link)) {
          const a = node('a','Ver na loja','store-link'); a.href = record.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; actions.prepend(a);
        }
      } catch (e) { if (revision === viewRevision) notes.textContent = e.message; }
    };
    observer.observe(card);
  }
  el('counter').textContent = gifts.length + (gifts.length === 1 ? ' presente' : ' presentes') + ' · ' + gifts.filter(g=>g.bought).length + ' comprados';
  el('empty').hidden = !!shown.length;
  el('emptyTitle').textContent = gifts.length ? 'Nenhum presente neste filtro' : 'Qual vai ser o primeiro presente?';
  el('emptyText').textContent = gifts.length ? 'Escolha outro filtro para ver mais ideias.' : 'Adicione uma ideia com uma foto, um link ou aquele detalhe que faz a diferença.';
}
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
  el('gate').hidden = true; el('board').hidden = false;
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
  el('description').value = item?.description || ''; el('forWhom').value = item?.forWhom || el('recipientFilter').value || 'Lulu';
  el('priority').value = item?.priority || 'Média'; el('bought').checked = !!item?.bought;
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
  if (!session || el('shareDialog').open || el('confirmDelete').open || busy) return;
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
  const gift={title,link,description:el('description').value.trim(),forWhom:el('forWhom').value,priority:el('priority').value,bought:el('bought').checked,photo:draftPhoto};
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
if (!accountEntry && (invite || privateApp) && session) enter(); else showGate();
