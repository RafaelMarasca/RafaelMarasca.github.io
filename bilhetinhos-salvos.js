'use strict';

// Rebuild only text and the formatting produced by the editor.
function restoreText(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  function copy(node) {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.data);
    const tag = node.localName;
    const allowed = ['div', 'p', 'br', 'font', 'span', 'b', 'strong', 'i', 'em', 'u', 's'];
    const clean = allowed.includes(tag) ? document.createElement(tag) : document.createDocumentFragment();
    if (tag === 'font') {
      for (const key of ['face', 'size', 'color']) if (node.hasAttribute(key)) clean.setAttribute(key, node.getAttribute(key));
    }
    if (clean.style) {
      for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'textDecoration'])
        clean.style[key] = node.style[key];
    }
    for (const child of node.childNodes) clean.append(copy(child));
    return clean;
  }
  return copy(template.content);
}

(() => {
  const byId = id => document.getElementById(id);
  const dateInput = byId('pin-date');
  const feedback = byId('save-status');
  const libraryStatus = byId('library-status');
  const dialog = byId('publish-dialog');
  const datePicker = byId('published-dates');
  const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Sao_Paulo'}).format(new Date());
  const formatDate = date => new Intl.DateTimeFormat('pt-BR', {dateStyle:'long'}).format(new Date(date + 'T12:00:00'));
  dateInput.value = today();
  let editingId, revision, busy = false, publications = [], publicToday;
  let dbPromise;
  const imageIds = new WeakMap();
  let serial = 0;

  function layout() {
    return {
      style: document.querySelector('[name=style]:checked').value,
      paper: document.querySelector('[name=paper]:checked').value,
      boxes: textBoxes.map(({editor, left, top, width, minHeight, angle}) =>
        ({html:editor.innerHTML, left, top, width, minHeight, angle})),
      photos: photos.map(photo => {
        const {size, x, y, handleLeft, angle} = placements.get(photo);
        if (!imageIds.has(photo)) imageIds.set(photo, ++serial);
        return {imageId:imageIds.get(photo), name:photo.getAttribute('aria-label'), size, x, y, handleLeft, angle};
      })
    };
  }
  let baseline = JSON.stringify(layout());

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function database() {
    if (!dbPromise) {
      const request = indexedDB.open('lulu-bilhetinhos', 1);
      request.onupgradeneeded = () => {
        for (const name of ['drafts', 'summaries']) request.result.createObjectStore(name, {keyPath:'id'});
      };
      dbPromise = requestResult(request).catch(error => { dbPromise = null; throw error; });
    }
    return dbPromise;
  }
  const png = canvas => new Promise((resolve, reject) => canvas.toBlob(blob =>
    blob ? resolve(blob) : reject(new Error('Não foi possível salvar a imagem.')), 'image/png'));

  async function encrypt(bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return {iv, data:await crypto.subtle.encrypt({name:'AES-GCM', iv}, noteAccess.draftKey, bytes)};
  }
  function decrypt(sealed) {
    return crypto.subtle.decrypt({name:'AES-GCM', iv:sealed.iv}, noteAccess.draftKey, sealed.data);
  }
  const sealJSON = value => encrypt(new TextEncoder().encode(JSON.stringify(value)));
  const openJSON = async value => JSON.parse(new TextDecoder().decode(await decrypt(value)));
  async function sealDraft({id, version, blobs, ...layout}) {
    return {id, version, sealed:await sealJSON(layout),
      blobs:await Promise.all(blobs.map(async blob => encrypt(await blob.arrayBuffer())))};
  }
  async function readDraft(db, id) {
    const entry = await requestResult(db.transaction('drafts').objectStore('drafts').get(id));
    if (!entry?.sealed) return entry;
    return {id, version:entry.version, ...await openJSON(entry.sealed),
      blobs:await Promise.all(entry.blobs.map(async blob => new Blob([await decrypt(blob)], {type:'image/png'})))};
  }
  async function writePair(db, record, summary, expectedVersion) {
    const tx = db.transaction(['drafts', 'summaries'], 'readwrite');
    const summaries = tx.objectStore('summaries');
    let conflict = false;
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () => reject(conflict ? new Error('Este bilhetinho mudou em outra aba. Abra a versão salva para continuar.') : tx.error);
      const check = summaries.get(record.id);
      check.onsuccess = () => {
        if (check.result?.version !== expectedVersion) { conflict = true; tx.abort(); return; }
        tx.objectStore('drafts').put(record);
        summaries.put(summary);
      };
    });
  }
  async function saveDraft() {
    const db = await database();
    const draft = layout();
    const id = editingId || crypto.randomUUID();
    const updated = Date.now();
    const title = [...textBoxes.map(box => editorText(box.editor).trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ')].slice(0, 100).join('') || 'Bilhetinho com foto';
    const blobs = await Promise.all(photos.map(png));
    const version = crypto.randomUUID();
    const record = await sealDraft({id, version, ...draft, blobs, date:dateInput.value});
    await writePair(db, record, {id, updated, version, sealed:await sealJSON(title)}, revision);
    editingId = id;
    revision = version;
    baseline = JSON.stringify(draft);
    saveNote.textContent = 'Salvar alterações';
    await listDrafts();
    return title;
  }

  function confirmSwitch() {
    return baseline === JSON.stringify(layout()) || confirm('Descartar as alterações que ainda não foram salvas?');
  }
  async function openDraft(id) {
    if (!confirmSwitch()) return;
    let record, images = [];
    if (id) {
      record = await readDraft(await database(), id);
      if (!record) throw new Error('Bilhetinho indisponível.');
      images = await Promise.all(record.blobs.map((blob, index) => readPhoto(new File([blob], record.photos[index].name))));
    }
    gesture = selectedPhoto = activeBox = savedRange = typingFormat = null;
    photos.length = textBoxes.length = boxSerial = 0;
    placements.clear();
    for (const element of [boxList, controls, photoList, byId('text-layers')]) element.replaceChildren();
    document.querySelector('[name=style][value=' + (record?.style || 'antigo') + ']').checked = true;
    document.querySelector('[name=paper][value=' + (record?.paper || 'creme') + ']').checked = true;
    for (const box of record?.boxes || [null]) addTextBox(false, box);
    images.forEach((photo, i) => {
      appendPhoto(photo);
      const {size, x, y, handleLeft, angle} = record.photos[i];
      Object.assign(placements.get(photo), {size, x, y, handleLeft, angle});
    });
    activateBox(textBoxes[0]);
    refreshPaper();
    editingId = id;
    revision = record?.version;
    dateInput.value = record?.date || today();
    saveNote.textContent = id ? 'Salvar alterações' : 'Salvar bilhetinho';
    feedback.textContent = photoStatus.textContent = '';
    baseline = JSON.stringify(layout());
    return true;
  }

  async function listDrafts() {
    const db = await database();
    const summaries = await requestResult(db.transaction('summaries').objectStore('summaries').getAll());
    for (const summary of summaries) {
      if (summary.sealed) {
        summary.title = await openJSON(summary.sealed);
      } else {
        // Upgrade the original plaintext pair atomically, keeping its ID and revision.
        const {id, version, updated, title} = summary;
        const old = await readDraft(db, id);
        if (old?.version === version) await writePair(db, await sealDraft(old), {id, version, updated, sealed:await sealJSON(title)}, version);
      }
    }
    const list = byId('saved-notes');
    list.replaceChildren();
    for (const note of summaries.sort((a, b) => b.updated - a.updated)) {
      const li = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = note.title;
      const button = document.createElement('button');
      button.textContent = 'Editar';
      button.setAttribute('aria-label', 'Editar ' + note.title);
      button.onclick = () => switchTo(note.id);
      li.append(title, button);
      list.append(li);
    }
    libraryStatus.textContent = summaries.length ? '' : 'Nenhum bilhetinho salvo ainda.';
  }
  async function run(action, report = feedback) {
    if (busy || loadingPhotos) return;
    busy = true;
    const main = document.querySelector('main');
    main.inert = true;
    try { return await action(); }
    catch (error) { report.textContent = error?.name === 'Error' ? error.message : 'Não foi possível salvar ou abrir o bilhetinho neste navegador.'; }
    finally { busy = main.inert = false; }
  }
  async function switchTo(id) {
    if (await run(() => openDraft(id), libraryStatus)) {
      changeView(true);
      message.focus();
    }
  }
  function showView() {
    const editing = location.hash === '#editor';
    byId('collection-view').hidden = editing;
    byId('editor-view').hidden = !editing;
    byId('toggle-notes').textContent = editing ? 'Ver bilhetinhos' : 'Abrir editor';
    if (editing) renderCard();
  }
  function changeView(editing) {
    const url = new URL(location.href);
    url.hash = editing ? 'editor' : 'bilhetinhos';
    if (url.href !== location.href) history.pushState(null, '', url);
    showView();
    byId(editing ? 'editor-title' : 'collection-title').focus();
  }
  byId('toggle-notes').onclick = () => changeView(byId('editor-view').hidden);
  window.addEventListener('hashchange', showView);
  showView();
  saveNote.onclick = () => run(async () => {
    await saveDraft();
    feedback.textContent = 'Salvo em Meus bilhetinhos.';
  });
  byId('new-note').onclick = () => switchTo(undefined);
  listDrafts().catch(() => { libraryStatus.textContent = 'O armazenamento deste navegador está indisponível.'; });

  function noteLink(date) {
    const url = new URL(location.href);
    url.searchParams.set('dia', date);
    url.hash = '';
    return url;
  }
  let previewUrl, imageRequest = 0;
  async function showPublication(date) {
    const generation = ++imageRequest;
    const img = byId('daily-preview');
    img.hidden = true;
    img.removeAttribute('src');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const item = publications.find(item => item.date === date);
    byId('daily-note').hidden = !item;
    if (!item) return;
    byId('daily-title').textContent = date === publicToday ? 'Bilhetinho do dia' : 'Bilhetinho de ' + formatDate(date);
    const time = byId('daily-date');
    time.textContent = formatDate(date);
    time.dateTime = date;
    time.hidden = date !== publicToday;
    img.alt = item.title;
    byId('published-link').href = noteLink(date);
    datePicker.value = date;
    try {
      const blob = await (await noteAccess.request('/bilhetinhos/' + date)).blob();
      if (generation !== imageRequest) return;
      previewUrl = URL.createObjectURL(blob);
      img.src = previewUrl;
      img.hidden = false;
    } catch {
      if (generation === imageRequest) byId('public-status').textContent = 'Não foi possível abrir este bilhetinho.';
    }
  }
  datePicker.onchange = () => { history.replaceState(null, '', noteLink(datePicker.value)); showPublication(datePicker.value); };
  const remote = async (path, options) => (await noteAccess.request(path, options)).json();
  let fetchNumber = 0;
  async function refreshPublic(preferred) {
    const number = ++fetchNumber;
    try {
      const result = await remote('/bilhetinhos');
      if (number !== fetchNumber) return;
      publications = result.items;
      publicToday = result.today;
      datePicker.replaceChildren(...publications.map(item => new Option(formatDate(item.date), item.date)));
      const date = preferred || new URL(location.href).searchParams.get('dia');
      const found = publications.some(item => item.date === date);
      byId('public-status').textContent = date && !found ? 'Ainda não há publicação para esta data.' :
        (publications.length ? '' : 'Ainda não há bilhetinhos publicados.');
      showPublication(found ? date : publications[0]?.date);
    } catch { if (number === fetchNumber) byId('public-status').textContent = 'Não foi possível carregar os bilhetinhos publicados.'; }
  }
  refreshPublic();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshPublic(); });

  pinNote.onclick = () => {
    if (!dateInput.reportValidity()) return;
    byId('publish-detail').textContent = 'Quem tiver a senha poderá ler o bilhetinho de ' + formatDate(dateInput.value) +
      (dateInput.value > today() ? ', a partir desse dia (horário de Brasília).' : '.');
    byId('publish-error').textContent = '';
    dialog.showModal();
  };
  byId('cancel-publish').onclick = () => dialog.close();
  dialog.oncancel = event => { if (busy) event.preventDefault(); };
  byId('publish-form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (busy) return;
    form.inert = true;
    const error = byId('publish-error');
    error.textContent = 'Preparando a publicação…';
    try {
      await run(async () => {
        const date = dateInput.value;
        const path = '/bilhetinhos/' + date;
        const {version} = await remote(path + '/version');
        if (version !== 'new' && !confirm('Substituir o bilhetinho já publicado para ' + formatDate(date) + '?')) {
          dialog.close(); return;
        }
        const title = await saveDraft();
        await document.fonts.ready;
        renderCard();
        const image = exportCard().toDataURL('image/jpeg', .88);
        await remote(path, {method:'PUT', headers:{'X-Gift-Version':version,'Content-Type':'application/json'},
          body:JSON.stringify({title, image})});
        dialog.close();
        feedback.textContent = (date > today() ? 'Publicação agendada para ' : 'Bilhetinho publicado para ') + formatDate(date) + '.';
        await refreshPublic(date > today() ? undefined : date);
      }, error);
    } finally { form.inert = false; }
  };
})();
