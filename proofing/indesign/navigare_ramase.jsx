// Panou pentru ce a ramas de corectat: reparatiile si observatiile fara propunere.
// La fiecare intrare sare la pagina din documentul .indd potrivit (retetar-00/01/02), selecteaza textul vizat
// (daca il gaseste), arata comentariul si deschide in Acrobat pagina din PDF-ul OCR al originalului (impartit in 3).
// Nu modifica nimic in text. Datele: ramase_date.jsx (generat de _lucru/genereaza_navigare.py).
// Starea "rezolvat" -> navigare_stare.txt.
#targetengine 'navigareRamase'
#include 'ramase_date.jsx'

// ---------- configurare
var DOCUMENTE = ['retetar-00.indd', 'retetar-01.indd', 'retetar-02.indd'];
var PDF_OCR = ['Pages from retetar_general_de_preparate_Partea_I_OCR.pdf',     // pag. originalului 1-440
               'Pages from retetar_general_de_preparate_Partea_II_OCR.pdf',    // 441-880
               'Pages from retetar_general_de_preparate_Partea_III_OCR.pdf'];  // 881-1320
// rezerva, daca Acrobat nu raspunde prin COM: linia de comanda /A "page=N"
var ACROBAT = File('C:/Program Files/Adobe/Acrobat Pro DC/Acrobat/Acrobat.exe').fsName;
function numePdf(k) { return 'fisier ' + (k + 1); }   // fisier 1 = Partea_I, 2 = Partea_II, 3 = Partea_III

var BIFA = String.fromCharCode(0x2713), SHY = String.fromCharCode(0xAD);

// ---------- text
function norm(s) {
    return String(s).toLowerCase().split(SHY).join('').replace(/\s+/g, ' ').replace(/^ +| +$/g, '');
}
function isWs(c) { return /\s/.test(c); }
function grep(s) {
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
    // un numar se cauta doar intreg
    if (/^\d/.test(s)) out = '(?<![\\d,.])' + out;
    if (/\d$/.test(s)) out = out + '(?![\\d,])';
    return out;
}

// ---------- folderele (cerute o data, tinute minte in navigare_config.txt)
var AICI = File($.fileName).path;
var fConfig = File(AICI + '/navigare_config.txt');
var foldere = {indd: '', pdf: ''};
if (fConfig.exists) {
    fConfig.encoding = 'UTF-8'; fConfig.open('r');
    while (!fConfig.eof) { var m = fConfig.readln().match(/^(indd|pdf)=(.*)$/); if (m) foldere[m[1]] = m[2]; }
    fConfig.close();
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
if (lipsesc(foldere.indd, DOCUMENTE).length && !alegeFolder('indd', DOCUMENTE, 'Folderul cu documentele InDesign')) exit();
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
    stareOrig.text = 'PDF original: pag. ' + x.op + ' - ' + numePdf(x.parte) +
        (String(r) === 'true' ? '' : '  (se deschide in Acrobat, poate dura citeva minute; apoi apasa Original)');
}

// ---------- stare
var fStare = File(File($.fileName).path + '/navigare_stare.txt');
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
function gaseste(x, d, off) {
    var tinte = [x.gaseste], w0 = String(x.gaseste).split(/\s+/)[0];
    if (w0 && w0.length > 2 && w0 !== x.gaseste) tinte.push(w0);   // textul din CSV poate diferi putin de cel din document
    for (var ti = 0; ti < tinte.length; ti++) {
        var cands = [];
        app.findGrepPreferences = NothingEnum.nothing; app.changeGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = grep(tinte[ti]);
        for (var p = off - 1; p <= off + 1; p++) {
            if (p < 0 || p >= d.pages.length) continue;
            var items = d.pages[p].allPageItems;
            for (var k = 0; k < items.length; k++) {
                if (items[k].constructor.name !== 'TextFrame') continue;
                try {
                    var f = items[k].findGrep();
                    for (var j = 0; j < f.length; j++) {
                        var s = potrivire(context(f[j], true), x.cb, true) + potrivire(context(f[j], false), x.ca, false);
                        cands.push({t: f[j], scor: s - 15 * Math.abs(p - off)});
                    }
                } catch (e) {}
            }
        }
        app.findGrepPreferences = NothingEnum.nothing;
        if (cands.length) {
            cands.sort(function (u, v) { return v.scor - u.scor; });
            return {t: cands[0].t, n: cands.length, aprox: ti > 0, tinta: tinte[ti]};
        }
    }
    return null;
}

// ---------- panou
var w = new Window('palette', 'Corecturi ramase (' + RAMASE.length + ')', undefined, {resizeable: true});
w.orientation = 'column'; w.alignChildren = ['fill', 'fill'];
var gf = w.add('group'); gf.alignment = ['fill', 'top'];
gf.add('statictext', undefined, 'Arata:');
var dd = gf.add('dropdownlist', undefined, ['Toate', 'Reparatie', 'Sigur', 'Probabil', 'De verificat']);
var cbNerez = gf.add('checkbox', undefined, 'doar nerezolvate');
var cbOrig = gf.add('checkbox', undefined, 'arata si originalul');
dd.selection = 0; cbNerez.value = true; cbOrig.value = true;   // inainte de onChange
var nrLista = gf.add('statictext', undefined, '', {truncate: 'end'}); nrLista.preferredSize = [90, 20];
var lb = w.add('listbox', undefined, [], {numberOfColumns: 6, showHeaders: true,
    columnTitles: ['OK', 'Doc', 'Pag.', 'Pag. PDF orig.', 'ID', 'Motiv'], columnWidths: [30, 70, 40, 100, 45, 90]});
lb.preferredSize = [420, 260];
var det = w.add('edittext', undefined, '', {multiline: true, readonly: true, scrolling: true});
det.preferredSize = [420, 260];
var stare = w.add('statictext', undefined, '', {truncate: 'end'});
stare.preferredSize = [420, 20];
var stareOrig = w.add('statictext', undefined, '', {truncate: 'end'});
stareOrig.preferredSize = [420, 20];
var gb = w.add('group'); gb.alignment = ['fill', 'bottom'];
var bInapoi = gb.add('button', undefined, '< Inapoi'), bDu = gb.add('button', undefined, 'Du-ma din nou'),
    bInainte = gb.add('button', undefined, 'Inainte >'), bOrig = gb.add('button', undefined, 'Original'),
    bFoldere = gb.add('button', undefined, 'Foldere...'),
    bRez = gb.add('button', undefined, 'Rezolvat');

var vizibile = [];   // indicii din RAMASE afisati in lista
function categorie(x) { return x.motiv; }
function umple(pastreazaId) {
    var filtru = dd.selection ? dd.selection.text : 'Toate';
    lb.removeAll(); vizibile = [];
    var sel = -1;
    for (var i = 0; i < RAMASE.length; i++) {
        var x = RAMASE[i];
        if (filtru !== 'Toate' && categorie(x) !== filtru) continue;
        if (cbNerez.value && rezolvat[x.id] && x.id !== pastreazaId) continue;
        var it = lb.add('item', rezolvat[x.id] ? BIFA : '');
        it.subItems[0].text = DOCUMENTE[x.doc].replace('.indd', ''); it.subItems[1].text = String(x.dp);
        it.subItems[2].text = x.op + ' - ' + numePdf(x.parte); it.subItems[3].text = x.id; it.subItems[4].text = categorie(x);
        if (x.id === pastreazaId) sel = vizibile.length;
        vizibile.push(i);
    }
    var nrez = 0;
    for (var j = 0; j < vizibile.length; j++) if (!rezolvat[RAMASE[vizibile[j]].id]) nrez++;
    nrLista.text = nrez + ' / ' + vizibile.length + ' de facut';
    return sel;
}
function afiseaza(x) {
    var t = 'ID ' + x.id + (x.ret ? '   |   reteta ' + x.ret : '') + '   |   ' + x.motiv + '\r' +
        'InDesign: ' + DOCUMENTE[x.doc] + ', pagina ' + x.dp + '   (export vechi: pagina ' + x.pag + ')\r' +
        'PDF original: pag. ' + x.op + ' - ' + numePdf(x.parte) + '   (' + PDF_OCR[x.parte] + ';  pagina ' + x.orig + ' din carte)\r\r';
    if (x.c || x.r) t += 'Acum:  ' + x.c + '\rCorect:  ' + x.r + '\r\r';
    if (x.com) t += 'COMENTARIU:\r' + x.com + '\r\r';
    if (x.prop) t += 'PROPUNERE (dupa original):\r' + x.prop + '\r\r';
    if (x.rand) t += 'Rind din export:\r' + x.rand;
    det.text = t;
    stareOrig.text = 'PDF original: pag. ' + x.op + ' - ' + numePdf(x.parte);
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
            (g.n > 1 ? '  (' + g.n + ' aparitii, ales dupa context)' : '');
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
    var nrez = 0;
    for (var j = 0; j < vizibile.length; j++) if (!rezolvat[RAMASE[vizibile[j]].id]) nrez++;
    nrLista.text = nrez + ' / ' + vizibile.length + ' de facut';
    if (rezolvat[x.id]) mergi(i + 1); else bRez.text = 'Rezolvat';
};
bFoldere.onClick = function () {
    alegeFolder('indd', DOCUMENTE, 'Folderul cu documentele InDesign');
    alegeFolder('pdf', PDF_OCR, 'Folderul cu PDF-urile OCR ale originalului');
    salveazaConfig();
};
w.onResizing = w.onResize = function () { this.layout.resize(); };

umple(null);
w.show();
mergi(0);
