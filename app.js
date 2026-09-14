(function () {
  'use strict';

  var DATA_URL = 'https://storage.googleapis.com/dcba-apiary-data/apiary_data.json';

  var inspections = [];

  function parseYesNo(v) {
    var s = (v || '').trim().toLowerCase();
    if (s === 'yes') return 'yes';
    if (s === 'no') return 'no';
    return null;
  }

  function parseList(v) {
    return (v || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function parseTimestamp(v) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec((v || '').trim());
    if (m) {
      return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
    }
    var fallback = new Date(v);
    return isNaN(fallback) ? new Date(0) : fallback;
  }

  function parseData(json) {
    var cols = json.columns || [];
    var idx = {};
    cols.forEach(function (name, i) { idx[name] = i; });
    var get = function (row, name) {
      var i = idx[name];
      return (i != null && row[i] != null) ? String(row[i]) : '';
    };

    var records = [];
    (json.data || []).forEach(function (row, rowIndex) {
      var hive = get(row, 'Hive Number').trim();
      if (!hive) return;
      records.push({
        id: 'row-' + rowIndex,
        hive: hive,
        timestamp: parseTimestamp(get(row, 'Timestamp')),
        inspector: get(row, 'Inspected By').trim(),
        bees: parseYesNo(get(row, 'Sufficient Bees')),
        honey: parseYesNo(get(row, 'Sufficient Honey/Nectar')),
        pollen: parseYesNo(get(row, 'Sufficient Pollen')),
        queen: parseYesNo(get(row, 'Queen Observed')),
        broodPresent: parseList(get(row, 'Brood [Yes]')),
        broodAbsent: parseList(get(row, 'Brood [No]')),
        sufficientBrood: parseYesNo(get(row, 'Sufficient Brood')),
        goodPattern: parseYesNo(get(row, 'Good Brood Pattern')),
        notes: get(row, 'Notes').trim(),
        checkNext: get(row, 'Check Next Inspection').trim()
      });
    });
    return records;
  }

  function renderStatus(message, showRetry) {
    $('#hive-table').classList.add('hidden');
    $('#add-hive-tile').classList.add('hidden');
    var status = $('#hive-status');
    status.innerHTML = '<div class="tl-empty">' + escapeHtml(message) + '</div>';
    if (showRetry) {
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'add-tile';
      retry.textContent = 'Try again';
      retry.addEventListener('click', loadData);
      status.appendChild(retry);
    }
    $('#home-sub').textContent = '';
  }

  function loadData() {
    renderStatus('Loading hive data…', false);
    fetch(DATA_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        inspections = parseData(json);
        $('#hive-status').innerHTML = '';
        $('#hive-table').classList.remove('hidden');
        $('#add-hive-tile').classList.remove('hidden');
        openHome();
      })
      .catch(function (err) {
        console.error('Failed to load apiary data:', err);
        renderStatus("Couldn't load hive data — check your connection and try again.", true);
      });
  }

  var formState = null;
  var returnTarget = { view: 'home' };
  var currentHistoryHive = null;

  var $ = function (sel) { return document.querySelector(sel); };
  var views = {
    home: $('#view-home'),
    form: $('#view-form'),
    history: $('#view-history')
  };

  function showView(name) {
    Object.keys(views).forEach(function (k) { views[k].classList.toggle('active', k === name); });
    window.scrollTo(0, 0);
  }

  // ---------- Home ----------
  function allHiveIds() {
    var ids = [];
    inspections.forEach(function (r) { if (ids.indexOf(r.hive) === -1) ids.push(r.hive); });
    return ids.sort(function (a, b) {
      var an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
      if (an && bn) return Number(a) - Number(b);
      if (an) return -1;
      if (bn) return 1;
      return a.localeCompare(b);
    });
  }

  function lastForHive(hiveId) {
    var entries = inspections.filter(function (r) { return r.hive === hiveId; });
    if (!entries.length) return null;
    entries.sort(function (a, b) { return b.timestamp - a.timestamp; });
    return entries[0];
  }

  function fmtDate(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }
  function fmtDateFull(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtTime(d) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function tagMini(label, value) {
    var cls = value === 'yes' ? 'good' : value === 'no' ? 'bad' : 'unknown';
    return '<div class="tag-mini ' + cls + '">' + label + '</div>';
  }

  function renderHome() {
    var ids = allHiveIds();
    var total = inspections.length;
    $('#home-sub').textContent = ids.length + ' hive' + (ids.length === 1 ? '' : 's') + ' · ' + total + ' inspection' + (total === 1 ? '' : 's') + ' logged';

    var body = $('#hive-table-body');
    body.innerHTML = '';
    ids.forEach(function (id) {
      var last = lastForHive(id);
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'hive-row';
      row.dataset.hive = id;
      var title = /^\d+$/.test(id) ? 'Hive ' + id : id;

      var hiveCell = '<div class="hive-cell"><div class="serif num">' + escapeHtml(title) + '</div>';
      hiveCell += '<div class="meta">' + (last ? fmtDate(last.timestamp) : 'No inspections') + '</div></div>';

      var tagsCell = '<div class="tag-mini-row">';
      tagsCell += tagMini('Bees', last ? last.bees : null);
      tagsCell += tagMini('Honey', last ? last.honey : null);
      tagsCell += tagMini('Pollen', last ? last.pollen : null);
      tagsCell += tagMini('Queen seen', last ? last.queen : null);
      tagsCell += '</div>';

      row.innerHTML = hiveCell + tagsCell;
      row.addEventListener('click', function () { openHistory(id); });
      body.appendChild(row);
    });
  }

  function openHome() {
    renderHome();
    showView('home');
  }

  // ---------- Form ----------
  function newFormState() {
    return {
      hive: null,
      bees: null, honey: null, pollen: null, queen: null,
      broodPresent: [], broodAbsent: [],
      sufficientBrood: null, goodPattern: null
    };
  }

  function openForm(returnTo, prefillHive) {
    returnTarget = returnTo || { view: 'home' };
    formState = newFormState();

    $('#input-inspector').value = '';
    $('#input-notes').value = '';
    $('#input-checknext').value = '';
    $('#input-hive-other').value = '';
    $('#input-hive-other').style.display = 'none';
    $('#hive-error').textContent = '';

    document.querySelectorAll('.toggle').forEach(function (b) { b.classList.remove('selected'); });
    document.querySelectorAll('.brood-chip').forEach(function (b) { b.classList.remove('selected'); });

    buildHiveChips();
    if (prefillHive) selectHive(prefillHive === 'other' ? 'other' : prefillHive);

    showView('form');
  }

  function buildHiveChips() {
    var row = $('#hive-chip-row');
    row.innerHTML = '';
    allHiveIds().forEach(function (id) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'hive-chip';
      chip.dataset.hive = id;
      chip.textContent = id;
      chip.addEventListener('click', function () { selectHive(id); });
      row.appendChild(chip);
    });
    var other = document.createElement('button');
    other.type = 'button';
    other.className = 'hive-chip other';
    other.dataset.hive = 'other';
    other.textContent = 'Other';
    other.addEventListener('click', function () { selectHive('other'); });
    row.appendChild(other);
  }

  function selectHive(value) {
    formState.hive = value;
    $('#hive-error').textContent = '';
    document.querySelectorAll('.hive-chip').forEach(function (c) {
      c.classList.toggle('selected', c.dataset.hive === value);
    });
    var otherInput = $('#input-hive-other');
    if (value === 'other') {
      otherInput.style.display = 'block';
      otherInput.focus();
    } else {
      otherInput.style.display = 'none';
      otherInput.value = '';
    }
  }

  // Yes/No toggle groups (click again to clear — every field here is optional)
  document.querySelectorAll('.toggle-group').forEach(function (group) {
    var field = group.dataset.field;
    group.querySelectorAll('.toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.dataset.value;
        var alreadySelected = btn.classList.contains('selected');
        group.querySelectorAll('.toggle').forEach(function (b) { b.classList.remove('selected'); });
        if (alreadySelected) {
          formState[field] = null;
        } else {
          btn.classList.add('selected');
          formState[field] = value;
        }
      });
    });
  });

  // Brood present/absent chip groups (multi-select)
  document.querySelectorAll('.chip-row').forEach(function (group) {
    var field = group.dataset.field;
    group.querySelectorAll('.brood-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.dataset.value;
        var idx = formState[field].indexOf(value);
        if (idx === -1) {
          formState[field].push(value);
          btn.classList.add('selected');
        } else {
          formState[field].splice(idx, 1);
          btn.classList.remove('selected');
        }
      });
    });
  });

  function onSave() {
    if (!formState.hive) {
      $('#hive-error').textContent = 'Select a hive to continue.';
      return;
    }
    var hiveId = formState.hive;
    if (hiveId === 'other') {
      var name = $('#input-hive-other').value.trim();
      if (!name) {
        $('#hive-error').textContent = 'Name this hive to continue.';
        return;
      }
      hiveId = name;
    }

    var record = {
      id: 'insp-' + Date.now(),
      hive: hiveId,
      timestamp: new Date(),
      inspector: $('#input-inspector').value.trim(),
      bees: formState.bees, honey: formState.honey, pollen: formState.pollen, queen: formState.queen,
      broodPresent: formState.broodPresent.slice(),
      broodAbsent: formState.broodAbsent.slice(),
      sufficientBrood: formState.sufficientBrood, goodPattern: formState.goodPattern,
      notes: $('#input-notes').value.trim(),
      checkNext: $('#input-checknext').value.trim()
    };
    inspections.push(record);
    openHistory(hiveId);
  }

  // ---------- History ----------
  function openHistory(hiveId) {
    currentHistoryHive = hiveId;
    var entries = inspections.filter(function (r) { return r.hive === hiveId; });
    entries.sort(function (a, b) { return b.timestamp - a.timestamp; });

    var title = /^\d+$/.test(hiveId) ? 'Hive ' + hiveId : hiveId;
    $('#hist-title').textContent = title;
    $('#hist-sub').textContent = entries.length + ' inspection' + (entries.length === 1 ? '' : 's') + ' logged';

    var tl = $('#timeline');
    tl.innerHTML = '';

    if (!entries.length) {
      tl.innerHTML = '<div class="tl-empty">No inspections logged yet for this hive.</div>';
    }

    entries.forEach(function (r, i) {
      var entry = document.createElement('div');
      entry.className = 'tl-entry';

      var rail = '<div class="tl-rail"><div class="tl-dot"></div>' + (i < entries.length - 1 ? '<div class="tl-line"></div>' : '') + '</div>';

      var badges = '';
      badges += yesNoBadge(r.bees, 'Bees', 'No bees');
      badges += yesNoBadge(r.honey, 'Honey', 'No honey');
      badges += yesNoBadge(r.pollen, 'Pollen', 'No pollen');
      badges += yesNoBadge(r.queen, 'Queen seen', 'No queen seen');

      var broodChips = r.broodPresent.map(function (s) { return '<div class="badge brood">' + escapeHtml(s) + '</div>'; }).join('');

      var card = '<div class="tl-card">';
      card += '<div class="tl-top"><div class="tl-date">' + fmtDateFull(r.timestamp) + '</div><div class="tl-time">' + fmtTime(r.timestamp) + '</div></div>';
      card += '<div class="tl-inspector">' + (r.inspector ? escapeHtml(r.inspector) : '—') + '</div>';
      if (badges) card += '<div class="badge-row">' + badges + '</div>';
      if (broodChips) card += '<div class="badge-row">' + broodChips + '</div>';
      if (r.notes) card += '<div class="tl-notes">' + escapeHtml(r.notes) + '</div>';
      if (r.checkNext) card += '<div class="tl-checknext"><b>Check next inspection:</b> ' + escapeHtml(r.checkNext) + '</div>';
      card += '</div>';

      entry.innerHTML = rail + card;
      tl.appendChild(entry);
    });

    showView('history');
  }

  function yesNoBadge(value, yesLabel, noLabel) {
    if (value === 'yes') return '<div class="badge good">' + yesLabel + '</div>';
    if (value === 'no') return '<div class="badge bad">' + noLabel + '</div>';
    return '';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- Wiring ----------
  $('#btn-new-inspection').addEventListener('click', function () { openForm({ view: 'home' }); });
  $('#add-hive-tile').addEventListener('click', function () { openForm({ view: 'home' }, 'other'); });
  $('#form-back').addEventListener('click', function () {
    if (returnTarget.view === 'history') openHistory(returnTarget.hive);
    else openHome();
  });
  $('#btn-save').addEventListener('click', onSave);
  $('#history-back').addEventListener('click', openHome);
  $('#fab-new').addEventListener('click', function () {
    openForm({ view: 'history', hive: currentHistoryHive }, currentHistoryHive);
  });

  loadData();
})();
