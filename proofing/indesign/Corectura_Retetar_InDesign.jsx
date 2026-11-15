// Corectura_Retetar_InDesign.jsx
// Paletă permanentă pentru aplicarea corecturilor din CSV (…_indesign_find_replace.csv).
// Rulare: Window → Utilities → Scripts → dublu-clic pe script (documentul .indd deschis).
// Fiecare corectură se caută doar pe pagina ei; se arată rândul cu textul găsit și comentariul,
// iar utilizatorul alege: Aplică / Sari / Altă apariție / Rezolvat manual. Ctrl+Z anulează o corectură.

#targetengine "corecturaRetetar"

var CR = $.global.CR || ($.global.CR = { rows: [], view: [], pos: 0, hits: [], hitIdx: 0, csvFile: null, state: {}, win: null });

function trim(s) { return String(s).replace(/^\s+|\s+$/g, ""); }

function strOf(c) {
    if (c instanceof Array) {
        var s = "";
        for (var i = 0; i < c.length; i++) s += (typeof c[i] == "string") ? c[i] : " ";
        return s;
    }
    return (typeof c == "string") ? c : "";
}

// ---------- CSV ----------
function parseCSV(txt) {
    if (txt.charCodeAt(0) == 0xFEFF) txt = txt.substr(1);
    var rows = [], row = [], f = [], q = false, i, c, n = txt.length;
    for (i = 0; i < n; i++) {
        c = txt.charAt(i);
        if (q) {
            if (c == '"') { if (txt.charAt(i + 1) == '"') { f.push('"'); i++; } else q = false; }
            else f.push(c);
        } else if (c == '"') q = true;
        else if (c == ';') { row.push(f.join("")); f = []; }
        else if (c == '\n') { row.push(f.join("")); rows.push(row); row = []; f = []; }
        else if (c != '\r') f.push(c);
    }
    if (f.length || row.length) { row.push(f.join("")); rows.push(row); }
    return rows;
}

function loadCSV(file) {
    file.encoding = "UTF-8";
    if (!file.open("r")) { alert("Cannot open " + file.fsName); return false; }
    var t = file.read(); file.close();
    var a = parseCSV(t), h = a[0], ix = {}, i;
    for (i = 0; i < h.length; i++) ix[trim(h[i])] = i;
    if (ix.Cauta === undefined || ix.Pagina === undefined) { alert("The CSV does not have the Pagina / Cauta / Inlocuieste columns."); return false; }
    CR.rows = [];
    for (i = 1; i < a.length; i++) {
        var r = a[i];
        if (r.length < h.length) continue;
        CR.rows.push({
            id: r[ix.ID], page: parseInt(r[ix.Pagina], 10), occ: parseInt(r[ix.Aparitia], 10) || 1,
            tip: r[ix.Tip], cat: r[ix.Categorie], find: r[ix.Cauta], rep: r[ix.Inlocuieste],
            before: r[ix.Context_inainte], after: r[ix.Context_dupa], line: r[ix.Rand_complet], comment: r[ix.Comentariu]
        });
    }
    CR.csvFile = file;
    loadState();
    try { var m = new File(Folder.userData + "/corectura_retetar_ultimul_csv.txt"); m.encoding = "UTF-8"; m.open("w"); m.write(file.fsName); m.close(); } catch (e) {}
    return true;
}

// ---------- stare (salvată lângă CSV, se poate relua oricând) ----------
function stateFile() { return new File(CR.csvFile.fsName.replace(/\.csv$/i, "") + "_stare.txt"); }
function loadState() {
    CR.state = {};
    var f = stateFile();
    if (!f.exists) return;
    f.encoding = "UTF-8"; f.open("r");
    var ls = f.read().split("\n"); f.close();
    for (var i = 0; i < ls.length; i++) { var p = ls[i].split("\t"); if (p.length >= 2) CR.state[p[0]] = trim(p[1]); }
}
function setState(id, st) {
    CR.state[id] = st;
    var f = stateFile(), out = [];
    for (var k in CR.state) if (CR.state.hasOwnProperty(k)) out.push(k + "\t" + CR.state[k]);
    f.encoding = "UTF-8"; f.open("w"); f.write(out.join("\n")); f.close();
}

// ---------- căutare pe pagină ----------
function escFind(s) { return s.replace(/\^/g, "^^").replace(/­/g, "^-"); }

function setFindPrefs(s) {
    app.findTextPreferences = NothingEnum.nothing;
    app.changeTextPreferences = NothingEnum.nothing;
    var o = app.findChangeTextOptions;
    o.caseSensitive = true; o.wholeWord = false; o.includeFootnotes = true; o.includeHiddenLayers = true;
    o.includeLockedLayersForFind = true; o.includeLockedStoriesForFind = true; o.includeMasterPages = false;
    app.findTextPreferences.findWhat = escFind(s);
}

function pageTexts(page) {
    var out = [], items = page.allPageItems, i, j, k;
    for (i = 0; i < items.length; i++) {
        if (items[i].constructor.name != "TextFrame") continue;
        var t = items[i].texts[0];
        out.push(t);
        try {
            for (j = 0; j < t.tables.length; j++) {
                var cells = t.tables[j].cells.everyItem().getElements();
                for (k = 0; k < cells.length; k++) out.push(cells[k].texts[0]);
            }
        } catch (e) {}
    }
    return out;
}

function findOnPage(page, s) {
    var res = [], seen = {};
    if (s === "") return res;
    setFindPrefs(s);
    var texts = pageTexts(page);
    for (var i = 0; i < texts.length; i++) {
        var h;
        try { h = texts[i].findText(); } catch (e) { continue; }
        for (var j = 0; j < h.length; j++) {
            var key = h[j].parent.toSpecifier() + "#" + h[j].index;
            if (seen[key]) continue;
            seen[key] = 1; res.push(h[j]);
        }
    }
    app.findTextPreferences = NothingEnum.nothing;
    return res;
}

// one native search over the whole document; returns { h: hit, pi: page index (-1 = not on a page) }
function findInDocument(doc, s) {
    var res = [];
    if (s === "") return res;
    setFindPrefs(s);
    var h = [];
    try { h = doc.findText(); } catch (e) {}
    app.findTextPreferences = NothingEnum.nothing;
    for (var i = 0; i < h.length; i++) {
        var pi = -1;
        try { pi = h[i].parentTextFrames[0].parentPage.documentOffset; } catch (e) {}
        res.push({ h: h[i], pi: pi });
    }
    return res;
}

function ctxOf(h) {
    var p = h.parent, i = h.index, n = h.characters.length, b = "", a = "";
    try { if (i > 0) b = strOf(p.characters.itemByRange(Math.max(0, i - 40), i - 1).contents); } catch (e) {}
    try { var L = p.characters.length; if (i + n < L) a = strOf(p.characters.itemByRange(i + n, Math.min(L - 1, i + n + 39)).contents); } catch (e) {}
    return { b: b.replace(/\s+/g, " "), a: a.replace(/\s+/g, " ") };
}

// cât de bine se potrivește contextul din InDesign cu cel din PDF
function score(r, c) {
    var s = 0, i, rb = r.before.replace(/\s+/g, " "), ra = r.after.replace(/\s+/g, " ");
    for (i = 1; i <= Math.min(rb.length, c.b.length); i++) { if (rb.charAt(rb.length - i) == c.b.charAt(c.b.length - i)) s++; else break; }
    for (i = 0; i < Math.min(ra.length, c.a.length); i++) { if (ra.charAt(i) == c.a.charAt(i)) s++; else break; }
    return s;
}

function lineView(h) {
    try {
        var ln = h.lines[0], s = strOf(ln.contents).replace(/[\r\n]+$/, ""), off = h.index - ln.index, n = h.characters.length;
        return s.substr(0, off) + " «" + s.substr(off, n) + "» " + s.substr(off + n);
    } catch (e) { return "(" + e + ")"; }
}

// înlocuiește doar partea care diferă, ca să păstreze formatarea
function applyFix(h, f, r) {
    var p = 0, s = 0;
    while (p < f.length && p < r.length && f.charAt(p) == r.charAt(p)) p++;
    while (s < f.length - p && s < r.length - p && f.charAt(f.length - 1 - s) == r.charAt(r.length - 1 - s)) s++;
    var del = f.length - p - s, ins = r.substring(p, r.length - s), par = h.parent, start = h.index + p;
    if (del > 0) h.characters.itemByRange(p, p + del - 1).remove();
    if (ins.length) par.insertionPoints[start].contents = ins;
    return par.insertionPoints[start];
}

// ---------- paleta ----------
function buildUI() {
    var w = new Window("palette", "Recipe Proofing – Find / Replace", undefined, { resizeable: true });
    w.orientation = "column"; w.alignChildren = ["fill", "top"]; w.spacing = 6; w.margins = 10;

    var g1 = w.add("group");
    var bLoad = g1.add("button", undefined, "Load CSV…");
    var stFile = g1.add("statictext", undefined, "(no file)"); stFile.alignment = ["fill", "center"]; stFile.characters = 50;

    var g2 = w.add("group");
    var cE = g2.add("checkbox", undefined, "Text edits"); cE.value = true;
    var cC = g2.add("checkbox", undefined, "Characters ǎ / cedilla"); cC.value = true;
    var cN = g2.add("checkbox", undefined, "Notes"); cN.value = true;
    var cP = g2.add("checkbox", undefined, "Unresolved only"); cP.value = true;
    var cAll = g2.add("checkbox", undefined, "Search all pages"); cAll.value = false;
    g2.add("statictext", undefined, "Page offset:");
    var eOff = g2.add("edittext", undefined, "0"); eOff.characters = 4;

    var g3 = w.add("group");
    var stPos = g3.add("statictext", undefined, "—"); stPos.alignment = ["fill", "center"]; stPos.characters = 55;
    g3.add("statictext", undefined, "ID:");
    var eGo = g3.add("edittext", undefined, ""); eGo.characters = 5;
    var bGo = g3.add("button", undefined, "Go");

    var p1 = w.add("panel", undefined, "Line from PDF"); p1.alignChildren = "fill";
    var tPdf = p1.add("edittext", undefined, "", { multiline: true, readonly: true }); tPdf.preferredSize = [620, 40];
    var p2 = w.add("panel", undefined, "Line from InDesign  (found text between « »)"); p2.alignChildren = "fill";
    var tInd = p2.add("edittext", undefined, "", { multiline: true, readonly: true }); tInd.preferredSize = [620, 40];

    var p3 = w.add("panel", undefined, "Correction"); p3.alignChildren = "fill";
    var r1 = p3.add("group"); r1.add("statictext", undefined, "Find:").preferredSize.width = 90;
    var eFind = r1.add("edittext", undefined, ""); eFind.alignment = ["fill", "center"];
    var r2 = p3.add("group"); r2.add("statictext", undefined, "Replace with:").preferredSize.width = 90;
    var eRep = r2.add("edittext", undefined, ""); eRep.alignment = ["fill", "center"];
    var r3 = p3.add("group"); r3.alignChildren = ["fill", "top"]; r3.add("statictext", undefined, "Comment:").preferredSize.width = 90;
    var tCom = r3.add("edittext", undefined, "", { multiline: true, readonly: true }); tCom.preferredSize = [520, 44]; tCom.alignment = ["fill", "fill"];

    var stStat = w.add("statictext", undefined, " "); stStat.characters = 80;

    var g4 = w.add("group"); g4.alignment = "center"; g4.spacing = 12;
    var BIG = [150, 46];
    var bPrev = g4.add("button", undefined, "« Previous"); bPrev.preferredSize = BIG;
    var bApply = g4.add("button", undefined, "Apply"); bApply.preferredSize = BIG;
    var bSkip = g4.add("button", undefined, "Next »"); bSkip.preferredSize = BIG;
    var bApplyNext = g4.add("button", undefined, "Apply + Next »"); bApplyNext.preferredSize = [180, 46];
    try { var fnt = ScriptUI.newFont("dialog", "BOLD", 14); bPrev.graphics.font = bApply.graphics.font = bApplyNext.graphics.font = bSkip.graphics.font = fnt; } catch (e) {}

    var g5 = w.add("group"); g5.alignment = "center";
    var bFind = g5.add("button", undefined, "Search again");
    var bAlt = g5.add("button", undefined, "Other match");
    var bDone = g5.add("button", undefined, "Resolved manually");

    function cur() { return CR.view.length ? CR.rows[CR.view[CR.pos]] : null; }
    function status(s) { stStat.text = s; }
    function stateTxt(r) { var s = CR.state[r.id]; return s ? "   [state: " + s + "]" : ""; }

    function pass(r) {
        var ok = (r.tip == "Notă") ? cN.value : (r.cat == "caractere" ? cC.value : cE.value);
        if (!ok) return false;
        if (cP.value) { var st = CR.state[r.id]; if (st == "aplicat" || st == "rezolvat manual") return false; }
        return true;
    }
    function rebuild(keepId) {
        CR.view = [];
        var p = 0;
        for (var i = 0; i < CR.rows.length; i++) if (pass(CR.rows[i])) { if (CR.rows[i].id == keepId) p = CR.view.length; CR.view.push(i); }
        CR.pos = p;
        showCurrent();
    }

    function showHitIdx() {
        var h = CR.hits[CR.hitIdx];
        try { app.select(h); } catch (e) {}
        try { h.showText(); } catch (e) {}
        tInd.text = lineView(h);
        bAlt.text = "Other match (" + (CR.hitIdx + 1) + "/" + CR.hits.length + ")";
    }

    function locate(r) {
        CR.hits = []; CR.hitIdx = 0; tInd.text = ""; bAlt.text = "Other match";
        if (!app.documents.length) { status("Open the InDesign document."); return; }
        var doc = app.activeDocument, pi = r.page - 1 + (parseInt(eOff.text, 10) || 0);
        if (pi < 0 || pi >= doc.pages.length) { status("Page " + (pi + 1) + " does not exist in the document."); return; }
        var pg = doc.pages[pi], hits = findOnPage(pg, eFind.text), pgOf = [], i;
        for (i = 0; i < hits.length; i++) pgOf.push(pi);
        if (!hits.length && cAll.value) {
            var all = findInDocument(doc, eFind.text);
            for (i = 0; i < all.length; i++) { if (all[i].pi < 0) continue; hits.push(all[i].h); pgOf.push(all[i].pi); }
        }
        if (!hits.length) {
            try { app.activeWindow.activePage = pg; } catch (e) {}
            if (r.rep !== "" && r.rep != r.find && findOnPage(pg, r.rep).length) status("The wrong text no longer appears on page " + pg.name + " – it seems already corrected." + stateTxt(r));
            else status("Text not found on page " + pg.name + ". Fix it manually or skip." + stateTxt(r));
            return;
        }
        var sc = [];
        for (i = 0; i < hits.length; i++) sc.push({ h: hits[i], s: score(r, ctxOf(hits[i])), k: i, d: Math.abs(pgOf[i] - pi) });
        sc.sort(function (a, b) { return (a.d - b.d) || (b.s - a.s) || (Math.abs(a.k - (r.occ - 1)) - Math.abs(b.k - (r.occ - 1))); });
        for (i = 0; i < sc.length; i++) CR.hits.push(sc[i].h);
        status("Found on page " + doc.pages[pgOf[sc[0].k]].name + (hits.length > 1 ? " (" + hits.length + " matches – check it is the right one)" : "") + stateTxt(r));
        showHitIdx();
    }

    function showCurrent() {
        var r = cur();
        if (!r) { stPos.text = "No corrections in the list (check the filters)."; tPdf.text = tInd.text = eFind.text = eRep.text = tCom.text = ""; status(" "); return; }
        stPos.text = "Correction " + (CR.pos + 1) + " / " + CR.view.length + "   ·   ID " + r.id + "   ·   page " + r.page + "   ·   " + r.tip + " (" + r.cat + ")";
        tPdf.text = r.line; eFind.text = r.find; eRep.text = r.rep;
        tCom.text = r.comment || (r.tip == "Notă" ? "" : "„" + r.find + "” → „" + r.rep + "”");
        locate(r);
    }

    function go(d) {
        if (!CR.view.length) return;
        var p = CR.pos + d;
        if (p >= CR.view.length) { alert("That was the last correction in the list."); return; }
        if (p < 0) p = 0;
        CR.pos = p; showCurrent();
    }

    function doApply(next) {
        var r = cur(); if (!r) return;
        if (!CR.hits.length) { alert("Text not found on the page – fix it manually and press \"Resolved manually\"."); return; }
        var rep = eRep.text;
        if (r.tip == "Notă" && rep === "") { alert("This is a note without a replacement.\nType the correct text in \"Replace with\" or fix it manually."); return; }
        var h = CR.hits[CR.hitIdx], ip = null;
        try {
            app.doScript(function () { ip = applyFix(h, eFind.text, rep); }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "Correction " + r.id);
        } catch (e) { alert("Error while applying: " + e); return; }
        setState(r.id, "aplicat");
        if (next) go(1);
        else { status("Applied." + stateTxt(r)); try { tInd.text = strOf(ip.lines[0].contents); } catch (e) {} CR.hits = []; }
    }

    bLoad.onClick = function () {
        var f = File.openDialog("Choose the proofing CSV", "*.csv");
        if (f && loadCSV(f)) { stFile.text = f.displayName; rebuild(null); }
    };
    cE.onClick = cC.onClick = cN.onClick = cP.onClick = function () { var r = cur(); rebuild(r ? r.id : null); };
    eOff.onChange = function () { showCurrent(); };
    bGo.onClick = function () {
        var id = trim(eGo.text);
        for (var i = 0; i < CR.view.length; i++) if (CR.rows[CR.view[i]].id == id) { CR.pos = i; showCurrent(); return; }
        alert("ID " + id + " is not in the filtered list.");
    };
    bPrev.onClick = function () { go(-1); };
    bFind.onClick = function () { var r = cur(); if (r) locate(r); };
    cAll.onClick = function () { var r = cur(); if (r) locate(r); };
    eFind.onChange =function () { var r = cur(); if (r) locate(r); };
    bAlt.onClick = function () { if (CR.hits.length > 1) { CR.hitIdx = (CR.hitIdx + 1) % CR.hits.length; showHitIdx(); } };
    bApply.onClick = function () { doApply(false); };
    bApplyNext.onClick = function () { doApply(true); };
    bSkip.onClick = function () { var r = cur(); if (r && !CR.state[r.id]) setState(r.id, "sărit"); go(1); };
    bDone.onClick = function () { var r = cur(); if (r) setState(r.id, "rezolvat manual"); go(1); };
    w.onResizing = w.onResize = function () { this.layout.resize(); };

    w.rebuild = rebuild;
    w.stFile = stFile;
    return w;
}

(function main() {
    // rebuild on every run so code changes show up (persistent engine would keep the old window)
    if (CR.win) { try { CR.win.close(); } catch (e) {} CR.win = null; }
    CR.win = buildUI();
    // încarcă automat ultimul CSV folosit sau CSV-ul de lângă script
    var f = null;
    try {
        var m = new File(Folder.userData + "/corectura_retetar_ultimul_csv.txt");
        if (m.exists) { m.encoding = "UTF-8"; m.open("r"); var pth = trim(m.read()); m.close(); if (File(pth).exists) f = File(pth); }
    } catch (e) {}
    if (!f) {
        try { var lst = File($.fileName).parent.getFiles("*_indesign_find_replace.csv"); if (lst.length) f = lst[0]; } catch (e) {}
    }
    CR.win.show();
    if (f && loadCSV(f)) { CR.win.stFile.text = f.displayName; CR.win.rebuild(null); }
})();
