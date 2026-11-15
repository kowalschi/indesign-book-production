// Aplica corecturile aprobate in cele 3 documente ale book-ului „Rețetar general”.
// Datele: corecturi_date.jsx (generat din pagina de revizuire). Jurnal: corecturi_jurnal.csv lingă script.
//
// SIMULARE = true  -> doar cauta si scrie jurnalul, nu modifica nimic (ruleaza intii asa).
// SIMULARE = false -> aplica, marcheaza textul schimbat cu conditia „Corectura script” si salveaza documentele;
//                     inainte de prima modificare face o copie a fiecarui .indd (…_inainte_corectura.indd).
#target indesign
#include "corecturi_date.jsx"

var SIMULARE = true;   // corecturile din lotul 1 sint deja aplicate - nu rula din nou pe aceleasi date
var MARCHEAZA = true;
var CONDITIE = 'Corectura script';
var TOLERANTA_PAGINI = 2;   // cit de departe de pagina din export poate fi gasit textul

// ---------- text
function norm(s) {
    return String(s).toLowerCase().replace(/\u00AD/g, '').replace(/[\s\u2028\u2029\uFEFF]+/g, ' ')
        .replace(/^ +| +$/g, '');
}
function isWs(c) { return /[\s\u2028\u2029]/.test(c); }

// GREP InDesign: caracterele non-ASCII ca \x{....}, spatiile flexibile (spatiu, tab, sfirsit de rind)
function grep(s, loose) {
    var out = '', prev = '';
    s = String(s).replace(/\u00AD/g, '');
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i), code = s.charCodeAt(i), piece;
        if (c === '\u00B6') piece = '\\r';
        else if (isWs(c)) {
            if (isWs(prev)) continue;
            piece = (prev === '-' || prev === '\u2013') ? '\\s*' : '\\s+';
        }
        else if (code > 126 || c === '"' || c === "'") piece = '\\x{' + ('000' + code.toString(16)).slice(-4) + '}';
        else if ('\\^$.|?*+()[]{}~'.indexOf(c) >= 0) piece = '\\' + c;
        else piece = c;
        if (loose && out && !isWs(c) && !isWs(prev)) out += '~-?';
        out += piece;
        prev = c;
    }
    // un numar se cauta doar intreg: „0 kg” nu trebuie gasit in „5,200 kg”
    if (/^\d/.test(s)) out = '(?<![\\d,.])' + out;
    if (/\d$/.test(s)) out = out + '(?![\\d,])';
    return out;
}
function textNou(s) { return String(s).replace(/~-/g, '\u00AD').replace(/\u00B6/g, '\r'); }

function prefixComun(a, b) {
    var n = 0;
    while (n < a.length && n < b.length && (a.charAt(n) === b.charAt(n) || (isWs(a.charAt(n)) && isWs(b.charAt(n))))) n++;
    return n;
}
function sufixComun(a, b, max) {
    var n = 0;
    while (n < max && (a.charAt(a.length - 1 - n) === b.charAt(b.length - 1 - n) ||
           (isWs(a.charAt(a.length - 1 - n)) && isWs(b.charAt(b.length - 1 - n))))) n++;
    return n;
}

// ---------- book
var book = app.books.length ? (app.activeBook || app.books[0]) : null;
if (!book) {
    var fb = File.openDialog('Alege book-ul (.indb)', '*.indb');
    if (!fb) exit();
    book = app.open(fb);
}
var docs = [], start = [], total = 0, deschiseDeScript = [];
for (var b = 0; b < book.bookContents.length; b++) {
    var fn = book.bookContents[b].fullName, era = false;
    for (var k = 0; k < app.documents.length; k++)
        if (String(app.documents[k].fullName) === String(fn)) era = true;
    var d = app.open(fn, false);
    if (!era) deschiseDeScript.push(d);
    docs.push(d); start.push(total); total += d.pages.length;
}

function paginaGlobala(page, di) { return start[di] + page.documentOffset + 1; }
function docPentru(pag) {
    for (var i = docs.length - 1; i >= 0; i--) if (pag > start[i]) return i;
    return 0;
}

function cadrePePagini(di, p0, p1) {
    var res = [], d = docs[di];
    for (var p = p0; p <= p1; p++) {
        var off = p - start[di] - 1;
        if (off < 0 || off >= d.pages.length) continue;
        var items = d.pages[off].allPageItems;
        for (var k = 0; k < items.length; k++)
            if (items[k].constructor.name === 'TextFrame') res.push(items[k]);
    }
    return res;
}

function cauta(di, pattern, pag) {
    app.findGrepPreferences = NothingEnum.nothing;
    app.findChangeGrepOptions.includeFootnotes = true;
    app.findChangeGrepOptions.includeLockedStoriesForFind = true;
    app.findChangeGrepOptions.includeMasterPages = false;
    app.findGrepPreferences.findWhat = pattern;
    var cadre = cadrePePagini(di, pag - TOLERANTA_PAGINI, pag + TOLERANTA_PAGINI), gasite = [];
    for (var k = 0; k < cadre.length; k++) {
        try { var f = cadre[k].texts[0].findGrep(); } catch (e) { continue; }   // cadre fara text valid
        for (var j = 0; j < f.length; j++) gasite.push(f[j]);
    }
    if (!gasite.length) {   // textul poate trece dintr-un cadru in altul: cauta in articolele de pe pagini
        var vazute = {};
        for (var k = 0; k < cadre.length; k++) {
            try { var st = cadre[k].parentStory, key = st.id; } catch (e) { continue; }
            if (vazute[key]) continue;
            vazute[key] = 1;
            try { var f = st.findGrep(); } catch (e) { continue; }
            for (var j = 0; j < f.length; j++) gasite.push(f[j]);
        }
    }
    app.findGrepPreferences = NothingEnum.nothing;
    var res = [];
    for (var j = 0; j < gasite.length; j++) {
        try {
            var t = gasite[j], fr = t.parentTextFrames;
            if (!fr.length || !fr[0].parentPage) continue;
            var pg = paginaGlobala(fr[0].parentPage, di);
        } catch (e) { continue; }
        if (Math.abs(pg - pag) > TOLERANTA_PAGINI) continue;
        if (atinsDejaDeScript(t)) continue;   // nu corecta textul tocmai produs de alta corectura
        res.push({t: t, pag: pg});
    }
    return res;
}

function atinsDejaDeScript(t) {
    try {
        var rs = t.textStyleRanges;
        for (var i = 0; i < rs.length; i++) {
            var cs = rs[i].appliedConditions;
            for (var k = 0; k < cs.length; k++) if (cs[k].name === CONDITIE) return true;
        }
    } catch (e) {}
    return false;
}

function scorContext(c, x) {
    var host = c.t.parent, idx = c.t.insertionPoints[0].index, len = c.t.characters.length, n = host.characters.length;
    var before = idx > 0 ? host.characters.itemByRange(Math.max(0, idx - 45), idx - 1).contents : '';
    var after = idx + len < n ? host.characters.itemByRange(idx + len, Math.min(n - 1, idx + len + 44)).contents : '';
    var b = norm(before), a = norm(after), cb = norm(x.cb), ca = norm(x.ca), s = 0;
    while (s < b.length && s < cb.length && b.charAt(b.length - 1 - s) === cb.charAt(cb.length - 1 - s)) s++;
    var s2 = 0;
    while (s2 < a.length && s2 < ca.length && a.charAt(s2) === ca.charAt(s2)) s2++;
    return s + s2;
}

function alege(cands, x) {
    var best = null, second = -1e9, peAceeasi = [];
    for (var i = 0; i < cands.length; i++) {
        var c = cands[i];
        c.scor = scorContext(c, x) - 15 * Math.abs(c.pag - x.pag);
        if (c.pag === x.pag) peAceeasi.push(c);
    }
    cands.sort(function (u, v) { return v.scor - u.scor; });
    best = cands[0];
    if (cands.length > 1) second = cands[1].scor;
    var nota = '';
    if (cands.length > 1 && best.scor === second) {   // context egal: a cita aparitie pe pagina (din CSV)
        if (peAceeasi.length >= x.ap) { best = peAceeasi[x.ap - 1]; nota = 'ales dupa nr. aparitiei'; }
        else nota = 'ambiguu';
    }
    return {c: best, nota: nota, n: cands.length};
}

function conditie(d) {
    var c = d.conditions.itemByName(CONDITIE);
    if (!c.isValid) c = d.conditions.add({name: CONDITIE, indicatorMethod: ConditionIndicatorMethod.USE_HIGHLIGHT,
                                         indicatorColor: UIColors.YELLOW});
    return c;
}

function aplica(c, x, d) {
    var host = c.t.parent, base = c.t.insertionPoints[0].index;
    var F = c.t.contents, T = textNou(x.r);
    var i = prefixComun(F, T), j = sufixComun(F, T, Math.min(F.length, T.length) - i);
    var mid = T.substring(i, T.length - j), a = base + i, z = base + F.length - j;   // [a, z) se inlocuieste
    if (z > a) {
        if (mid) host.characters.itemByRange(a, z - 1).contents = mid;
        else host.characters.itemByRange(a, z - 1).remove();
    } else if (mid) host.insertionPoints[a].contents = mid;
    if (MARCHEAZA && mid) {
        try { host.characters.itemByRange(a, a + mid.length - 1).applyConditions([conditie(d)], false); } catch (e) {}
    }
}

// ---------- rulare
var jurnal = [['ID', 'Status', 'Pagina export', 'Pagina gasita', 'Document', 'Candidati', 'Cauta', 'Inlocuieste', 'Nota']];
var st = {aplicat: 0, gasit: 0, 'deja corect': 0, negasit: 0, eroare: 0};
var lista = CORECTURI.slice().sort(function (u, v) { return v.pag - u.pag; });   // de la final: reflow-ul nu muta paginile ramase

if (!SIMULARE) {
    for (var i = 0; i < docs.length; i++) {
        if (docs[i].modified) { alert('Salvează întîi documentul ' + docs[i].name + ' și rulează din nou.'); exit(); }
        var fn = docs[i].fullName, copie = File(String(fn).replace(/\.indd$/i, '_inainte_corectura.indd'));
        if (!copie.exists) File(fn).copy(copie);
    }
}

var bar = new Window('palette', 'Corecturi');
bar.pb = bar.add('progressbar', undefined, 0, lista.length); bar.pb.preferredSize = [400, 16];
bar.txt = bar.add('statictext', undefined, ''); bar.txt.preferredSize = [400, 16];
bar.show();

function ruleaza() {
    for (var n = 0; n < lista.length; n++) {
        var x = lista[n], di = docPentru(x.pag), status, pg = '', nota = '', nc = 0;
        bar.pb.value = n + 1; bar.txt.text = 'ID ' + x.id + ' · pagina ' + x.pag + ' · ' + (n + 1) + '/' + lista.length;
        if (n % 20 === 0) bar.update();
        try {
            var cands = cauta(di, grep(x.c, false), x.pag);
            if (!cands.length) { cands = cauta(di, grep(x.c, true), x.pag); if (cands.length) nota = 'cu despărțiri în text'; }
            if (cands.length) {
                var ch = alege(cands, x);
                pg = ch.c.pag; nc = ch.n; nota = (nota ? nota + '; ' : '') + ch.nota;
                if (ch.nota === 'ambiguu') status = 'negasit';
                else if (SIMULARE) status = 'gasit';
                else { aplica(ch.c, x, docs[di]); status = 'aplicat'; }
            } else if (x.r && cauta(di, grep(x.r, false), x.pag).length) { status = 'deja corect'; nota = 'textul nou exista deja pe pagina - verifica'; }
            else status = 'negasit';
        } catch (e) { status = 'eroare'; nota = String(e); }
        st[status]++;
        jurnal.push([x.id, status, x.pag, pg, docs[di].name, nc, x.c, x.r, nota]);
    }
}
if (SIMULARE) ruleaza();
else app.doScript(ruleaza, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, 'Corecturi script');
bar.close();

if (!SIMULARE) for (var i = 0; i < docs.length; i++) docs[i].save();
for (var i = 0; i < deschiseDeScript.length; i++) deschiseDeScript[i].close(SaveOptions.NO);   // cele deschise fara fereastra

var log = File(File($.fileName).path + '/corecturi_jurnal.csv');
log.encoding = 'UTF-8'; log.open('w'); log.write('\uFEFF');
for (var i = 0; i < jurnal.length; i++) {
    var row = [];
    for (var k = 0; k < jurnal[i].length; k++) row.push('"' + String(jurnal[i][k]).replace(/"/g, '""').replace(/[\r\n]/g, '\u00B6') + '"');
    log.writeln(row.join(';'));
}
log.close();

alert((SIMULARE ? 'SIMULARE \u2013 nu s-a modificat nimic.\n' : 'Corecturi aplicate și documente salvate.\n') +
      'Pagini în book: ' + total + ' (exportul PDF are 2007)\n' +
      (SIMULARE ? 'găsite: ' + st.gasit : 'aplicate: ' + st.aplicat) +
      '\ndeja corecte: ' + st['deja corect'] + '\nnegăsite: ' + st.negasit + '\nerori: ' + st.eroare +
      '\n\nJurnal: ' + log.fsName);
