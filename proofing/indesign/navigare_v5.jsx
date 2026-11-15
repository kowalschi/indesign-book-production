// Panou pentru lotul v5 de corecturi (corecturi_v5.csv), pe documentul unic retetar-01-02.indd.
// La fiecare intrare sare la pagina din document, selecteaza textul vizat, arata observatia si deschide in Acrobat
// pagina din PDF-ul OCR al originalului (impartit in 3). Nu modifica nimic in text.
// Datele: v5_date.jsx (generat de _lucru/genereaza_navigare_v5.py). Starea "rezolvat" -> navigare_v5_stare.txt.
#targetengine 'navigareV5'
#include 'v5_date.jsx'

// ---------- configurare
var DOCUMENTE = ['retetar-01-02.indd'];
var PDF_OCR = ['Pages from retetar_general_de_preparate_Partea_I_OCR.pdf',     // pag. originalului 1-440
               'Pages from retetar_general_de_preparate_Partea_II_OCR.pdf',    // 441-880
               'Pages from retetar_general_de_preparate_Partea_III_OCR.pdf'];  // 881-1320
// rezerva, daca Acrobat nu raspunde prin COM: linia de comanda /A "page=N"
var ACROBAT = File('C:/Program Files/Adobe/Acrobat Pro DC/Acrobat/Acrobat.exe').fsName;
function numePdf(k) { return 'fisier ' + (k + 1); }   // fisier 1 = Partea_I, 2 = Partea_II, 3 = Partea_III
function areOriginal(x) { return x.parte >= 0; }
function textOriginal(x) { return areOriginal(x) ? x.op + ' - ' + numePdf(x.parte) : '-'; }

var BIFA = String.fromCharCode(0x2713), SHY = String.fromCharCode(0xAD);

// ---------- text
function norm(s) {
    return String(s).toLowerCase().split(SHY).join('').replace(/\s+/g, ' ').replace(/^ +| +$/g, '');
}
function isWs(c) { return /\s/.test(c); }
function grep(s) {   // la fel ca regex() din genereaza_navigare_v5.py (numarul aparitiilor trebuie sa iasa la fel)
    var out = '', prev = '';
    s = String(s).split(SHY).join('');
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i), code = s.charCodeAt(i), piece;
        if (isWs(c)) {
            if (isWs(prev)) continue;
            piece = (prev === '-' || prev.charCodeAt(0) === 0x2013) ? '\\s*' : '\\s+';
        }
        else if (code > 126 || c === '"' || c === "'") piece = '\\x{' + ('000' + code.toString(16)).slice(-4) + '}';
        else if ('\\^$.|?*+()[]{}~'.indexOf(c) >= 0) piece = '\\' + c;
        else piece = c;
        out += piece;
        prev = c;
    }
    // un numar se cauta doar intreg; un cuvint se cauta pina la capatul lui
    if (/^\d/.test(s)) out = '(?<![\\d,.])' + out;
    if (/\d$/.test(s)) out = out + '(?![\\d,])';
    else if (/[A-Za-z0-9_\u00C0-\u024F]$/.test(s)) out = out + '(?!\\w)(?![\\x{00C0}-\\x{024F}])';   // si cu diacritice
    return out;
}

// ---------- folderele (cerute o data, tinute minte in navigare_v5_config.txt)
var AICI = File($.fileName).path;
var fConfig = File(AICI + '/navigare_v5_config.txt');
var foldere = {indd: '', pdf: ''};
if (fConfig.exists) {
    fConfig.encoding = 'UTF-8'; fConfig.open('r');
    while (!fConfig.eof) { var m = fConfig.readln().match(/^(indd|pdf)=(.*)$/); if (m) foldere[m[1]] = m[2]; }
    fConfig.close();
} else {   // prima rulare: folderul PDF-urilor din panoul vechi, daca exista
    var fVechi = File(AICI + '/navigare_config.txt');
    if (fVechi.exists) {
        fVechi.encoding = 'UTF-8'; fVechi.open('r');
        while (!fVechi.eof) { var mv = fVechi.readln().match(/^pdf=(.*)$/); if (mv) foldere.pdf = mv[1]; }
        fVechi.close();
    }
}
function lipsesc(folder, nume) {
    var l = [];
    for (var k = 0; k < nume.length; k++) if (!folder || !File(folder + '/' + nume[k]).exists) l.push(nume[k]);
    return l;
}
function alegeFolder(cheie, nume, titlu) {
    while (true) {
        var f = Folder.selectDialog(titlu + '\r(' + nume.join(', ') + ')', foldere[cheie] ? Folder(foldere[cheie]) : undefined);
        if (!f) return false;
        var l = lipsesc(f.fsName, nume);
        if (!l.length) { foldere[cheie] = f.fsName; return true; }
        alert('In ' + f.fsName + ' lipsesc:\r' + l.join('\r'));
    }
}
function salveazaConfig() {
    fConfig.encoding = 'UTF-8'; fConfig.open('w');
    fConfig.writeln('indd=' + foldere.indd); fConfig.writeln('pdf=' + foldere.pdf);
    fConfig.close();
}
if (lipsesc(foldere.indd, DOCUMENTE).length && !alegeFolder('indd', DOCUMENTE, 'Folderul cu documentul InDesign')) exit();
if (lipsesc(foldere.pdf, PDF_OCR).length && !alegeFolder('pdf', PDF_OCR, 'Folderul cu PDF-urile OCR ale originalului')) exit();
salveazaConfig();
function fisierIndd(k) { return File(foldere.indd + '/' + DOCUMENTE[k]); }
function fisierPdf(k) { return File(foldere.pdf + '/' + PDF_OCR[k]); }

function deschide(f) {
    var d = null;
    for (var k = 0; k < app.documents.length; k++)
        if (app.documents[k].saved && app.documents[k].fullName.fsName.toLowerCase() === f.fsName.toLowerCase()) d = app.documents[k];
    if (!d) d = app.open(f, true);
    if (d.windows.length === 0) d.windows.add();
    return d;
}

// ---------- originalul in Acrobat
// PDF deja deschis: salt prin COM (AcroExch), instantaneu. Altfel il deschid din linia de comanda (/A page=N),
// fara sa astept: un PDF de 1 GB se deschide in citeva minute, iar AVDoc.Open ar bloca InDesign tot atunci.
function vbsDeschideLaPagina(f, p) {
    return 'CreateObject("WScript.Shell").Run """' + ACROBAT + '"" /A ""page=' + p + '"" ""' + f + '""", 1, False\r';
}
function trimiteOriginal(x, inFata) {
    if (!areOriginal(x)) { stareOrig.text = 'Fara pagina in original (text nou: titlu, prefata, cuprins)'; return; }
    var f = fisierPdf(x.parte);
    var vbs = 'Dim acro, i, av, gasit\r' +
        'gasit = False\r' +
        'Set acro = CreateObject("AcroExch.App")\r' +
        'For i = 0 To acro.GetNumAVDocs() - 1\r' +
        '  Set av = acro.GetAVDoc(i)\r' +
        // GetTitle da titlul ferestrei Acrobat (tabul activ) pentru toate documentele -> comparam numele fisierului
        '  If StrComp(av.GetPDDoc().GetFileName(), "' + PDF_OCR[x.parte] + '", 1) = 0 Then\r' +
        '    av.GetAVPageView().GoTo ' + (x.op - 1) + '\r' +
        '    On Error Resume Next\r' +
        '    av.GetPDDoc().GetJSObject().bringToFront\r' +   // schimba tabul activ (AVDoc.BringToFront nu o face)
        '    On Error GoTo 0\r' +
        (inFata ? '    av.BringToFront\r' : '') +
        '    gasit = True\r' +
        '    Exit For\r' +
        '  End If\r' +
        'Next\r' +
        'If Not gasit Then ' + vbsDeschideLaPagina(f.fsName, x.op) +
        'returnValue = gasit\r';
    var r;
    try { r = app.doScript(vbs, ScriptLanguage.VISUAL_BASIC); }
    catch (e) { app.doScript(vbsDeschideLaPagina(f.fsName, x.op), ScriptLanguage.VISUAL_BASIC); r = false; }   // fara COM
    stareOrig.text = 'PDF original: pag. ' + textOriginal(x) +
        (String(r) === 'true' ? '' : '  (se deschide in Acrobat, poate dura citeva minute; apoi apasa Original)');
}

// ---------- stare
var fStare = File(AICI + '/navigare_v5_stare.txt');
var rezolvat = {};
if (fStare.exists) {
    fStare.encoding = 'UTF-8'; fStare.open('r');
    while (!fStare.eof) { var l = fStare.readln().replace(/\s/g, ''); if (l) rezolvat[l] = true; }
    fStare.close();
}
function salveazaStare() {
    fStare.encoding = 'UTF-8'; fStare.open('w');
    for (var k in rezolvat) if (rezolvat[k]) fStare.writeln(k);
    fStare.close();
}

// ---------- cautarea textului vizat
function potrivire(a, b, dinCapat) {   // cite caractere comune la capatul dinspre textul gasit
    a = norm(a); b = norm(b);
    var n = 0, m = Math.min(a.length, b.length);
    while (n < m && (dinCapat ? a.charAt(a.length - 1 - n) === b.charAt(b.length - 1 - n) : a.charAt(n) === b.charAt(n))) n++;
    return n;
}
function context(t, inainte) {
    try {
        var ch = t.parent.characters, i0 = t.characters[0].index - ch[0].index, i1 = i0 + t.characters.length;
        if (inainte) return i0 > 0 ? ch.itemByRange(Math.max(0, i0 - 40), i0 - 1).contents : '';
        return i1 < ch.length ? ch.itemByRange(i1, Math.min(ch.length - 1, i1 + 39)).contents : '';
    } catch (e) { return ''; }
}
function cadrePagina(pg) {   // cadrele de text de pe pagina, de sus in jos, de la stinga la dreapta
    var items = pg.allPageItems, fr = [];
    for (var k = 0; k < items.length; k++) if (items[k].constructor.name === 'TextFrame') fr.push(items[k]);
    fr.sort(function (a, b) {
        var ga = a.geometricBounds, gb = b.geometricBounds;
        return Math.abs(ga[0] - gb[0]) > 2 ? ga[0] - gb[0] : ga[1] - gb[1];
    });
    return fr;
}
function gasestePePagina(pg) {   // presupune findGrepPreferences deja setate
    var fr = cadrePagina(pg), out = [];
    for (var k = 0; k < fr.length; k++) {
        try { var f = fr[k].findGrep(); for (var j = 0; j < f.length; j++) out.push(f[j]); } catch (e) {}
    }
    return out;
}
function gaseste(x, d, off) {
    var tinte = [x.gaseste], w0 = String(x.gaseste).split(/\s+/)[0];
    if (w0 && w0.length > 2 && w0 !== x.gaseste) tinte.push(w0);   // textul din CSV poate diferi putin de cel din document
    for (var ti = 0; ti < tinte.length; ti++) {
        app.findGrepPreferences = NothingEnum.nothing; app.changeGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = grep(tinte[ti]);
        // 1. aparitia aleasa dinainte (din PDF, dupa antetul retetei), daca pe pagina sint tot atitea aparitii
        if (ti === 0 && x.n > 1 && x.k >= 0) {
            var pe = gasestePePagina(d.pages[off]);
            if (pe.length === x.n) {
                app.findGrepPreferences = NothingEnum.nothing;
                return {t: pe[x.k], n: pe.length, aprox: false, tinta: tinte[ti], dupaReteta: true};
            }
        }
        // 2. altfel: pagina si vecinele, alese dupa context
        var cands = [];
        for (var p = off - 1; p <= off + 1; p++) {
            if (p < 0 || p >= d.pages.length) continue;
            var f = gasestePePagina(d.pages[p]);
            for (var j = 0; j < f.length; j++) {
                var s = potrivire(context(f[j], true), x.cb, true) + potrivire(context(f[j], false), x.ca, false);
                cands.push({t: f[j], scor: s - 15 * Math.abs(p - off), ord: cands.length});
            }
        }
        app.findGrepPreferences = NothingEnum.nothing;
        if (cands.length) {
            cands.sort(function (u, v) { return v.scor - u.scor || u.ord - v.ord; });
            return {t: cands[0].t, n: cands.length, aprox: ti > 0, tinta: tinte[ti], dupaReteta: false};
        }
    }
    return null;
}

// ---------- panou
var TIPURI = ['Toate'], vazut = {};
for (var it0 = 0; it0 < RAMASE.length; it0++) if (!vazut[RAMASE[it0].motiv]) { vazut[RAMASE[it0].motiv] = 1; TIPURI.push(RAMASE[it0].motiv); }
TIPURI = [TIPURI[0]].concat(TIPURI.slice(1).sort());

var w = new Window('palette', 'Corecturi v5 (' + RAMASE.length + ')', undefined, {resizeable: true});
w.orientation = 'column'; w.alignChildren = ['fill', 'fill'];
var gf = w.add('group'); gf.alignment = ['fill', 'top'];
gf.add('statictext', undefined, 'Tip:');
var dd = gf.add('dropdownlist', undefined, TIPURI);
var cbNerez = gf.add('checkbox', undefined, 'doar nerezolvate');
var cbOrig = gf.add('checkbox', undefined, 'arata si originalul');
dd.selection = 0; cbNerez.value = true; cbOrig.value = true;   // inainte de onChange
var nrLista = gf.add('statictext', undefined, '', {truncate: 'end'}); nrLista.preferredSize = [90, 20];
var lb = w.add('listbox', undefined, [], {numberOfColumns: 6, showHeaders: true,
    columnTitles: ['OK', 'Pag.', 'Reteta', 'Pag. PDF orig.', 'ID', 'Tip'], columnWidths: [30, 45, 55, 100, 55, 150]});
lb.preferredSize = [460, 260];
var det = w.add('edittext', undefined, '', {multiline: true, readonly: true, scrolling: true});
det.preferredSize = [460, 260];
var stare = w.add('statictext', undefined, '', {truncate: 'end'});
stare.preferredSize = [460, 20];
var stareOrig = w.add('statictext', undefined, '', {truncate: 'end'});
stareOrig.preferredSize = [460, 20];
var gb = w.add('group'); gb.alignment = ['fill', 'bottom'];
var bInapoi = gb.add('button', undefined, '< Inapoi'), bDu = gb.add('button', undefined, 'Du-ma din nou'),
    bInainte = gb.add('button', undefined, 'Inainte >'), bOrig = gb.add('button', undefined, 'Original'),
    bFoldere = gb.add('button', undefined, 'Foldere...'),
    bRez = gb.add('button', undefined, 'Rezolvat');

var vizibile = [];   // indicii din RAMASE afisati in lista
function umple(pastreazaId) {
    var filtru = dd.selection ? dd.selection.text : 'Toate';
    lb.removeAll(); vizibile = [];
    var sel = -1;
    for (var i = 0; i < RAMASE.length; i++) {
        var x = RAMASE[i];
        if (filtru !== 'Toate' && x.motiv !== filtru) continue;
        if (cbNerez.value && rezolvat[x.id] && x.id !== pastreazaId) continue;
        var it = lb.add('item', rezolvat[x.id] ? BIFA : '');
        it.subItems[0].text = String(x.dp); it.subItems[1].text = x.ret || '-';
        it.subItems[2].text = textOriginal(x); it.subItems[3].text = x.id; it.subItems[4].text = x.motiv;
        if (x.id === pastreazaId) sel = vizibile.length;
        vizibile.push(i);
    }
    numara();
    return sel;
}
function numara() {
    var nrez = 0;
    for (var j = 0; j < vizibile.length; j++) if (!rezolvat[RAMASE[vizibile[j]].id]) nrez++;
    nrLista.text = nrez + ' / ' + vizibile.length + ' de facut';
}
function afiseaza(x) {
    var t = 'ID ' + x.id + (x.ret ? '   |   reteta ' + x.ret : '') + '   |   ' + x.motiv + '\r' +
        'InDesign: ' + DOCUMENTE[x.doc] + ', pagina ' + x.dp + '\r' +
        (areOriginal(x) ? 'PDF original: pag. ' + textOriginal(x) + '   (' + PDF_OCR[x.parte] + ';  pagina ' + x.orig + ' din carte)'
                        : 'PDF original: -  (text nou, fara corespondent in original)') + '\r\r';
    t += 'Acum:  ' + x.c + '\r';
    t += 'Corect:  ' + (x.r || '(de stabilit)') + '\r\r';
    if (x.com) t += 'OBSERVATII:\r' + x.com + '\r\r';
    if (x.gaseste !== x.c) t += 'Se cauta in document: ' + x.gaseste + '\r';
    det.text = t;
    stareOrig.text = areOriginal(x) ? 'PDF original: pag. ' + textOriginal(x) : 'Fara pagina in original';
}
function du(x) {
    var d = deschide(fisierIndd(x.doc)), off = Math.min(x.dp, d.pages.length) - 1;
    app.activeDocument = d;
    var win = d.layoutWindows[0];
    app.select(NothingEnum.nothing);
    win.activePage = d.pages[off];
    win.zoom(ZoomOptions.FIT_PAGE);
    var g = x.gaseste ? gaseste(x, d, off) : null;
    if (g) {
        app.select(g.t);
        try { win.activePage = g.t.parentTextFrames[0].parentPage; } catch (e) {}
        stare.text = (g.aprox ? 'Gasit doar inceputul: "' + g.tinta + '"' : 'Text selectat: "' + g.tinta + '"') +
            (g.n > 1 ? '  (' + g.n + ' aparitii, ales dupa ' + (g.dupaReteta ? 'reteta' : 'context') + ')' : '');
    } else {
        stare.text = x.gaseste ? 'Textul "' + x.gaseste + '" nu e pe pagina - cauta de mina' : 'Pagina deschisa (fara text de selectat)';
    }
}
function curent() { return lb.selection ? RAMASE[vizibile[lb.selection.index]] : null; }
function mergi(i) { if (i >= 0 && i < vizibile.length) lb.selection = i; }   // declanseaza onChange
function incearca(f, x) { try { f(x); } catch (e) { stare.text = 'Eroare: ' + e.message; } }

lb.onChange = function () {
    var x = curent(); if (!x) return;
    afiseaza(x); incearca(du, x);
    if (cbOrig.value) incearca(trimiteOriginal, x);
    bRez.text = rezolvat[x.id] ? 'Nerezolvat' : 'Rezolvat';
};
dd.onChange = cbNerez.onClick = function () {
    var x = curent(), s = umple(x ? x.id : null);
    if (s >= 0) lb.selection = s; else mergi(0);
};
bDu.onClick = function () { var x = curent(); if (x) incearca(du, x); };
bOrig.onClick = function () { var x = curent(); if (x) try { trimiteOriginal(x, true); } catch (e) { stare.text = 'Eroare: ' + e.message; } };
bInapoi.onClick = function () { mergi((lb.selection ? lb.selection.index : 1) - 1); };
bInainte.onClick = function () { mergi((lb.selection ? lb.selection.index : -1) + 1); };
bRez.onClick = function () {
    var x = curent(); if (!x) return;
    var i = lb.selection.index;
    rezolvat[x.id] = !rezolvat[x.id]; salveazaStare();
    lb.items[i].text = rezolvat[x.id] ? BIFA : '';
    numara();
    if (rezolvat[x.id]) mergi(i + 1); else bRez.text = 'Rezolvat';
};
bFoldere.onClick = function () {
    alegeFolder('indd', DOCUMENTE, 'Folderul cu documentul InDesign');
    alegeFolder('pdf', PDF_OCR, 'Folderul cu PDF-urile OCR ale originalului');
    salveazaConfig();
};
w.onResizing = w.onResize = function () { this.layout.resize(); };

umple(null);
w.show();
mergi(0);
