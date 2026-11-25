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
    if ((tag === 'div' || tag === 'p') && /^(left|center|right)$/.test(node.getAttribute('align') || ''))
      clean.setAttribute('align', node.getAttribute('align'));
    if (clean.style) {
      for (const key of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'textDecoration', 'textAlign'])
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
    await saveChain.catch(() => {});
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
    clearTimeout(autosaveTimer);
    lastSaved = null;
    showSaveState();
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
  // ---------- Salvamento automático ----------
  // Saves run one at a time so two of them never race for the same revision.
  let saveChain = Promise.resolve(), saving = false, autosaveTimer, checkTimer, lastSaved;
  const saveState = byId('save-state');
  const isDirty = () => baseline !== JSON.stringify(layout());
  const clock = date => date.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  function queueSave() {
    const next = saveChain.catch(() => {}).then(async () => {
      saving = true;
      showSaveState();
      try {
        const title = await saveDraft();
        lastSaved = new Date();
        return title;
      } finally { saving = false; showSaveState(); }
    });
    saveChain = next;
    return next;
  }
  function showSaveState(error) {
    saveState.dataset.state = error ? 'error' : saving ? 'saving' : isDirty() ? 'dirty' : editingId ? 'saved' : '';
    saveState.textContent = error || (saving ? 'Salvando…' : isDirty() ? (saveNote.disabled ? '' : 'Alterações ainda não salvas') :
      editingId ? (lastSaved ? 'Salvo às ' + clock(lastSaved) : 'Salvo') : '');
  }
  async function autosave() {
    if (!isDirty() || saveNote.disabled) return showSaveState();
    if (busy || saving || loadingPhotos || gesture) { autosaveTimer = setTimeout(autosave, 1500); return; }
    try { await queueSave(); }
    catch (error) { showSaveState(error?.name === 'Error' ? error.message : 'Não foi possível salvar automaticamente.'); return; }
    if (isDirty()) scheduleAutosave();
  }
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(autosave, 2500);
  }
  document.addEventListener('bilhetinho:mudou', () => {
    // renderCard runs on every pointer move, so compare layouts only once things settle.
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => {
      showSaveState();
      if (isDirty()) scheduleAutosave();
    }, 300);
  });
  window.addEventListener('beforeunload', event => {
    if (saving || (isDirty() && !saveNote.disabled)) event.preventDefault();
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !byId('editor-view').hidden) {
      event.preventDefault();
      if (!saveNote.disabled) saveNote.click();
    }
  });
  saveNote.onclick = () => run(async () => {
    clearTimeout(autosaveTimer);
    await queueSave();
    feedback.textContent = 'Salvo em Meus bilhetinhos.';
  });
  byId('new-note').onclick = () => switchTo(undefined);
  listDrafts().catch(() => { libraryStatus.textContent = 'O armazenamento deste navegador está indisponível.'; });

  // ---------- Bilhetinhos publicados ----------
  const at = date => new Date(date + 'T12:00:00');
  const fmt = options => new Intl.DateTimeFormat('pt-BR', options);
  const dayMonth = fmt({day:'numeric', month:'long'});
  const weekday = fmt({weekday:'long'});
  const weekdayShort = fmt({weekday:'short'});
  const monthShort = fmt({month:'short'});
  const monthYear = fmt({month:'long', year:'numeric'});
  const relative = new Intl.RelativeTimeFormat('pt-BR', {numeric:'auto'});
  const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
  const fold = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const daysBetween = (from, to) => Math.round((at(to) - at(from)) / 864e5);
  function whenLabel(date) {
    const days = daysBetween(publicToday, date);
    if (days === 0) return 'Bilhetinho de hoje';
    if (days === -1) return 'Bilhetinho de ontem';
    if (days > 0) return 'Abre ' + relative.format(days, 'day');
    const ago = -days;
    if (ago < 7) return capital(relative.format(days, 'day'));
    if (ago < 31) return capital(relative.format(-Math.floor(ago / 7), 'week'));
    if (ago < 365) return capital(relative.format(-Math.floor(ago / 30), 'month'));
    return capital(relative.format(-Math.floor(ago / 365), 'year'));
  }

  const archive = document.querySelector('.note-archive');
  const search = byId('archive-search');
  const monthPicker = byId('archive-month');
  const dayPicker = byId('archive-date');
  const archiveList = byId('archive-list');
  const publicStatus = byId('public-status');
  let selected, when = 'all';

  function noteLink(date) {
    const url = new URL(location.href);
    url.searchParams.set('dia', date);
    url.hash = '';
    return url;
  }
  const isFuture = item => item.date > publicToday;
  const latest = () => publications.find(item => item.date === publicToday) ||
    publications.find(item => !isFuture(item)) || publications[publications.length - 1];

  let previewUrl, imageRequest = 0;
  async function showPublication(date, {scroll = false} = {}) {
    const generation = ++imageRequest;
    const img = byId('daily-preview');
    const wait = byId('daily-wait');
    img.hidden = wait.hidden = true;
    img.removeAttribute('src');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    const index = publications.findIndex(item => item.date === date);
    const item = publications[index];
    byId('daily-note').hidden = !item;
    selected = item?.date;
    renderArchive();
    if (!item) return;
    const time = byId('daily-date');
    time.textContent = dayMonth.format(at(date));
    time.dateTime = date;
    const kicker = byId('daily-kicker');
    kicker.textContent = whenLabel(date);
    kicker.classList.toggle('is-today', date === publicToday);
    byId('daily-weekday').textContent = weekday.format(at(date)) + ' · ' + date.slice(0, 4);
    byId('older-note').disabled = index === publications.length - 1;
    byId('newer-note').disabled = index === 0;
    const home = latest();
    byId('go-today').hidden = !home || home.date === date;
    byId('go-today').textContent = home?.date === publicToday ? 'Voltar para hoje' : 'Ir para o mais recente';
    img.alt = item.title;
    if (scroll) byId('daily-note').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
    try {
      const blob = await (await noteAccess.request('/bilhetinhos/' + date)).blob();
      if (generation !== imageRequest) return;
      previewUrl = URL.createObjectURL(blob);
      img.src = previewUrl;
      img.hidden = false;
    } catch {
      if (generation !== imageRequest) return;
      wait.textContent = isFuture(item) ? 'Este bilhetinho abre em ' + formatDate(date) + '. ♡' : 'Não foi possível abrir este bilhetinho.';
      wait.hidden = false;
    }
  }
  function select(date, options) {
    history.replaceState(null, '', noteLink(date));
    publicStatus.textContent = '';
    showPublication(date, options);
  }
  function step(offset) {
    const index = publications.findIndex(item => item.date === selected);
    const next = publications[index + offset];
    if (next) select(next.date);
  }
  byId('older-note').onclick = () => step(1);
  byId('newer-note').onclick = () => step(-1);
  byId('daily-note').addEventListener('keydown', event => {
    if (event.target.closest('input, select, textarea')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); step(-1); }
  });
  byId('go-today').onclick = () => { const home = latest(); if (home) select(home.date); };
  byId('copy-link').onclick = async () => {
    const link = noteLink(selected).href;
    try { await navigator.clipboard.writeText(link); publicStatus.textContent = 'Link copiado.'; }
    catch { publicStatus.textContent = link; }
  };

  function matches(item) {
    if (when === 'past' && isFuture(item)) return false;
    if (when === 'future' && !isFuture(item)) return false;
    if (monthPicker.value && !item.date.startsWith(monthPicker.value)) return false;
    const query = fold(search.value.trim());
    if (!query) return true;
    const haystack = fold([item.title, formatDate(item.date), weekday.format(at(item.date)), item.date].join(' '));
    return query.split(/\s+/).every(word => haystack.includes(word));
  }
  const text = (tag, content, className) => Object.assign(document.createElement(tag), {textContent:content, className:className || ''});
  function renderArchive() {
    const shown = publications.filter(matches);
    byId('archive-count').textContent = shown.length !== publications.length
      ? shown.length + ' de ' + publications.length + ' bilhetinhos'
      : publications.length + (publications.length === 1 ? ' bilhetinho' : ' bilhetinhos');
    byId('archive-empty').hidden = shown.length > 0;
    const groups = new Map();
    for (const item of shown) {
      const key = item.date.slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    archiveList.replaceChildren(...[...groups].map(([month, items]) => {
      const group = document.createElement('section');
      group.className = 'archive-month';
      const list = document.createElement('ul');
      for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'archive-item' + (isFuture(item) ? ' is-future' : '');
        if (item.date === selected) button.setAttribute('aria-current', 'true');
        const tile = text('span', '', 'day-tile');
        tile.setAttribute('aria-hidden', 'true');
        tile.append(text('small', weekdayShort.format(at(item.date)).replace('.', '')),
          text('b', String(Number(item.date.slice(8)))),
          text('small', monthShort.format(at(item.date)).replace('.', '')));
        const body = text('span', '', 'archive-text');
        const date = text('time', capital(weekday.format(at(item.date))) + ', ' + formatDate(item.date));
        date.dateTime = item.date;
        body.append(date, text('span', item.title, 'archive-title'));
        button.append(tile, body);
        if (item.date === publicToday) button.append(text('span', 'hoje', 'archive-badge'));
        else if (isFuture(item)) button.append(text('span', 'agendado', 'archive-badge'));
        button.onclick = () => select(item.date, {scroll:true});
        const li = document.createElement('li');
        li.append(button);
        list.append(li);
      }
      group.append(text('h3', capital(monthYear.format(at(month + '-01')))), list);
      return group;
    }));
  }
  function fillMonths() {
    const current = monthPicker.value;
    const counts = new Map();
    for (const item of publications) counts.set(item.date.slice(0, 7), (counts.get(item.date.slice(0, 7)) || 0) + 1);
    monthPicker.replaceChildren(new Option('Todos os meses', ''),
      ...[...counts].map(([month, count]) => new Option(capital(monthYear.format(at(month + '-01'))) + ' (' + count + ')', month)));
    monthPicker.value = counts.has(current) ? current : '';
    if (publications.length) {
      dayPicker.min = publications[publications.length - 1].date;
      dayPicker.max = publications[0].date;
    }
  }
  search.oninput = monthPicker.onchange = renderArchive;
  for (const chip of archive.querySelectorAll('[data-when]')) chip.onclick = () => {
    when = chip.dataset.when;
    for (const other of archive.querySelectorAll('[data-when]')) other.setAttribute('aria-pressed', String(other === chip));
    renderArchive();
  };
  byId('clear-filters').onclick = () => {
    search.value = monthPicker.value = '';
    archive.querySelector('[data-when="all"]').click();
  };
  dayPicker.onchange = () => {
    const date = dayPicker.value;
    if (!date || !publications.length) return;
    if (publications.some(item => item.date === date)) { select(date, {scroll:true}); return; }
    // Sem bilhetinho nesse dia: abre o mais próximo.
    const nearest = publications.reduce((best, item) =>
      Math.abs(daysBetween(item.date, date)) < Math.abs(daysBetween(best.date, date)) ? item : best);
    select(nearest.date, {scroll:true});
    publicStatus.textContent = 'Não há bilhetinho em ' + formatDate(date) + '. Mostrando o mais próximo, de ' + formatDate(nearest.date) + '.';
  };

  const remote = async (path, options) => (await noteAccess.request(path, options)).json();
  let fetchNumber = 0;
  async function refreshPublic(preferred) {
    const number = ++fetchNumber;
    try {
      const result = await remote('/bilhetinhos');
      if (number !== fetchNumber) return;
      publicToday = result.today || today();
      publications = [...result.items].sort((a, b) => b.date.localeCompare(a.date));
      fillMonths();
      archive.hidden = !publications.length;
      const param = new URL(location.href).searchParams.get('dia');
      const asked = preferred || (/^\d{4}-\d{2}-\d{2}$/.test(param || '') ? param : null);
      const found = publications.some(item => item.date === asked);
      publicStatus.textContent = asked && !found ? 'Ainda não há bilhetinho para ' + formatDate(asked) + '.' :
        (publications.length ? '' : 'Ainda não há bilhetinhos publicados.');
      const keep = !preferred && selected && publications.some(item => item.date === selected);
      const date = found ? asked : keep ? selected : latest()?.date;
      if (date !== selected || !previewUrl) showPublication(date);
      else renderArchive();
    } catch { if (number === fetchNumber) publicStatus.textContent = 'Não foi possível carregar os bilhetinhos publicados.'; }
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
        const title = await queueSave();
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
