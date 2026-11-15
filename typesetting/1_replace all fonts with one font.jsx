// Replace fonts by family - Adobe InDesign
// Replaces document fonts with another font family, keeping each font's style
// (Regular -> Regular, Bold -> Bold, Bold Italic -> Bold Italic, ...).
// If the new family has no exact style, the closest one is chosen
// (by weight, italic and width).
//
// List 1: every font used in the document (select the ones to replace).
// List 2: drop-down with all installed font families (with a filter box).
// Checkbox: replace ALL document fonts with the chosen family.

#target indesign

(function () {

    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;

    // ---------------------------------------------------------------- data

    // Fonts used in the document (unique by family + style)
    var docFonts = [];
    (function () {
        var seen = {};
        var all = doc.fonts.everyItem().getElements();
        for (var i = 0; i < all.length; i++) {
            var f = all[i], fam, sty;
            try { fam = f.fontFamily; sty = f.fontStyleName; }
            catch (e) {
                try {
                    var parts = String(f.name).split("\t");
                    fam = parts[0]; sty = parts.length > 1 ? parts[1] : "Regular";
                } catch (e2) { continue; }
            }
            if (!fam) continue;
            var key = fam + "\t" + sty;
            if (seen[key]) continue;
            seen[key] = true;
            docFonts.push({ font: f, family: fam, style: sty, status: statusText(f) });
        }
        docFonts.sort(function (a, b) {
            var x = (a.family + "\t" + a.style).toLowerCase(),
                y = (b.family + "\t" + b.style).toLowerCase();
            return x < y ? -1 : (x > y ? 1 : 0);
        });
    })();

    if (docFonts.length === 0) {
        alert("No fonts found in this document.");
        return;
    }

    // Installed families -> list of styles
    var familyStyles = {};
    var familyNames = [];
    (function () {
        // Font names are "Family\tStyle". Some fonts throw when asked for
        // fontFamily / fontStyleName, so use the name (and skip bad fonts).
        var names = [];
        try {
            names = app.fonts.everyItem().name;
            if (!(names instanceof Array)) names = [names];
        } catch (e) {
            var all = app.fonts.everyItem().getElements();
            for (var n = 0; n < all.length; n++) {
                try { names.push(all[n].name); } catch (e2) { }
            }
        }
        var fams = [], stys = [];
        for (var m = 0; m < names.length; m++) {
            var parts = String(names[m]).split("\t");
            if (parts.length < 2) continue;
            fams.push(parts[0]);
            stys.push(parts[1]);
        }
        for (var i = 0; i < fams.length; i++) {
            if (!fams[i]) continue;
            if (familyStyles.hasOwnProperty(fams[i]) &&
                ("\n" + familyStyles[fams[i]].join("\n") + "\n").indexOf("\n" + stys[i] + "\n") >= 0) continue;
            if (!familyStyles.hasOwnProperty(fams[i])) {
                familyStyles[fams[i]] = [];
                familyNames.push(fams[i]);
            }
            familyStyles[fams[i]].push(stys[i]);
        }
        familyNames.sort(function (a, b) {
            var x = a.toLowerCase(), y = b.toLowerCase();
            return x < y ? -1 : (x > y ? 1 : 0);
        });
    })();

    // ---------------------------------------------------------------- dialog

    var w = new Window("dialog", "Replace Fonts by Family");
    w.orientation = "column";
    w.alignChildren = "fill";

    var pList = w.add("panel", undefined, "Fonts used in document (" + docFonts.length + ")");
    pList.alignChildren = "fill";
    var lst = pList.add("listbox", undefined, undefined, {
        multiselect: true,
        numberOfColumns: 4,
        showHeaders: true,
        columnTitles: ["Font family", "Style", "Status", "Will become"],
        columnWidths: [210, 130, 90, 250]
    });
    lst.preferredSize = [700, 320];
    for (var i = 0; i < docFonts.length; i++) {
        var it = lst.add("item", docFonts[i].family);
        it.subItems[0].text = docFonts[i].style;
        it.subItems[1].text = docFonts[i].status;
        it.subItems[2].text = "";
        it.fontIndex = i;
    }
    var gSel = pList.add("group");
    gSel.add("statictext", undefined, "Ctrl / Shift + click to select several fonts.");
    var btnAll = gSel.add("button", undefined, "Select all");
    var btnNone = gSel.add("button", undefined, "Select none");

    var pNew = w.add("panel", undefined, "New font family");
    pNew.alignChildren = "left";
    var gFilter = pNew.add("group");
    gFilter.add("statictext", undefined, "Filter:");
    var edFilter = gFilter.add("edittext", undefined, "");
    edFilter.characters = 30;
    var gFam = pNew.add("group");
    gFam.add("statictext", undefined, "Family:");
    var dd = gFam.add("dropdownlist", undefined, []);
    dd.preferredSize = [400, -1];
    var stStyles = pNew.add("statictext", undefined, "", { multiline: true });
    stStyles.preferredSize = [660, 36];

    var pOpt = w.add("panel", undefined, "Options");
    pOpt.alignChildren = "left";
    var cbAll = pOpt.add("checkbox", undefined, "Replace ALL fonts in the document with the chosen font family");
    var cbStyles = pOpt.add("checkbox", undefined, "Also update paragraph and character styles");
    cbStyles.value = true;

    var gBtn = w.add("group");
    gBtn.alignment = "right";
    gBtn.add("button", undefined, "Cancel", { name: "cancel" });
    var btnOk = gBtn.add("button", undefined, "Replace", { name: "ok" });

    // ---------------------------------------------------------------- dialog logic

    function fillFamilies() {
        var flt = edFilter.text.toLowerCase();
        var prev = dd.selection ? dd.selection.text : null;
        dd.removeAll();
        var toSelect = null;
        for (var i = 0; i < familyNames.length; i++) {
            if (flt && familyNames[i].toLowerCase().indexOf(flt) < 0) continue;
            var item = dd.add("item", familyNames[i]);
            if (familyNames[i] === prev) toSelect = item;
        }
        if (toSelect) dd.selection = toSelect;
        else if (dd.items.length) dd.selection = 0;
        refresh();
    }

    function refresh() {
        var fam = dd.selection ? dd.selection.text : null;
        var styles = fam ? familyStyles[fam] : null;
        stStyles.text = styles ? "Styles available: " + styles.join(", ") : "No family selected.";
        for (var i = 0; i < lst.items.length; i++) {
            var it = lst.items[i];
            var src = docFonts[it.fontIndex];
            if (styles && (cbAll.value || it.selected)) {
                it.subItems[2].text = fam + " " + bestStyle(src.style, styles);
            } else {
                it.subItems[2].text = "";
            }
        }
        btnOk.enabled = !!fam && (cbAll.value || (lst.selection && lst.selection.length > 0));
    }

    edFilter.onChanging = fillFamilies;
    dd.onChange = refresh;
    lst.onChange = refresh;
    cbAll.onClick = refresh;
    btnAll.onClick = function () { lst.selection = lst.items; refresh(); };
    btnNone.onClick = function () { lst.selection = null; refresh(); };

    fillFamilies();

    if (w.show() !== 1) return;

    // ---------------------------------------------------------------- collect jobs

    var targetFamily = dd.selection.text;
    var targetStyles = familyStyles[targetFamily];
    var jobs = [];
    for (var j = 0; j < lst.items.length; j++) {
        if (!cbAll.value && !lst.items[j].selected) continue;
        var s = docFonts[lst.items[j].fontIndex];
        var newStyle = bestStyle(s.style, targetStyles);
        if (s.family === targetFamily && s.style === newStyle) continue;
        jobs.push({ src: s, style: newStyle, count: 0, styleCount: 0 });
    }

    if (jobs.length === 0) {
        alert("Nothing to replace.");
        return;
    }

    app.doScript(function () { run(jobs, targetFamily, targetStyles, cbAll.value, cbStyles.value); },
        ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "Replace fonts by family");

    // ---------------------------------------------------------------- report

    var total = 0, report = [];
    for (var k = 0; k < jobs.length; k++) {
        total += jobs[k].count;
        report.push(jobs[k].src.family + " " + jobs[k].src.style + "  ->  " +
            targetFamily + " " + jobs[k].style +
            "   (" + jobs[k].count + " text ranges, " + jobs[k].styleCount + " styles)");
    }
    showReport("Done. " + total + " text ranges changed.", report.join("\n"));

    // ================================================================ functions

    function run(jobs, fam, famStyles, allMode, doStyles) {
        // 1. Paragraph & character styles
        if (doStyles) {
            var pst = doc.allParagraphStyles, cst = doc.allCharacterStyles;
            updateStyles(pst, jobs, fam, famStyles, false);
            updateStyles(cst, jobs, fam, famStyles, allMode);
        }

        // 2. Text (local formatting + everything else)
        var fco = app.findChangeTextOptions;
        var saved = {
            includeFootnotes: fco.includeFootnotes,
            includeHiddenLayers: fco.includeHiddenLayers,
            includeLockedLayersForFind: fco.includeLockedLayersForFind,
            includeLockedStoriesForFind: fco.includeLockedStoriesForFind,
            includeMasterPages: fco.includeMasterPages
        };
        fco.includeFootnotes = true;
        fco.includeHiddenLayers = true;
        fco.includeLockedLayersForFind = true;
        fco.includeLockedStoriesForFind = true;
        fco.includeMasterPages = true;

        for (var i = 0; i < jobs.length; i++) {
            var jb = jobs[i];
            app.findTextPreferences = NothingEnum.NOTHING;
            app.changeTextPreferences = NothingEnum.NOTHING;
            try {
                app.findTextPreferences.appliedFont = jb.src.font;
            } catch (e) {
                try { app.findTextPreferences.appliedFont = jb.src.family; } catch (e2) { continue; }
            }
            app.findTextPreferences.fontStyle = jb.src.style;
            app.changeTextPreferences.appliedFont = fam;
            app.changeTextPreferences.fontStyle = jb.style;
            try {
                jb.count = doc.changeText().length;
            } catch (e3) { }
        }

        app.findTextPreferences = NothingEnum.NOTHING;
        app.changeTextPreferences = NothingEnum.NOTHING;
        for (var p in saved) { try { fco[p] = saved[p]; } catch (e4) { } }
    }

    function updateStyles(styles, jobs, fam, famStyles, allMode) {
        for (var i = 0; i < styles.length; i++) {
            var st = styles[i];
            var stFam = familyOf(st.appliedFont);
            var stSty = "";
            try { stSty = st.fontStyle; } catch (e) { }
            if (typeof stSty !== "string") stSty = "";

            if (stFam) {
                // Style defines a family: replace if it matches one of the jobs
                for (var j = 0; j < jobs.length; j++) {
                    var src = jobs[j].src;
                    var fontStyleOfStyle = stSty || styleOf(st.appliedFont);
                    if (stFam === src.family && (fontStyleOfStyle === src.style || !fontStyleOfStyle)) {
                        try {
                            st.appliedFont = fam;
                            st.fontStyle = jobs[j].style;
                            jobs[j].styleCount++;
                        } catch (e2) { }
                        break;
                    }
                }
            } else if (allMode && stSty) {
                // Character style with only a font style (e.g. "Bold"):
                // make sure that style exists in the new family
                var ns = bestStyle(stSty, famStyles);
                if (ns !== stSty) { try { st.fontStyle = ns; } catch (e3) { } }
            }
        }
    }

    function familyOf(f) {
        try {
            if (f && f.constructor && f.constructor.name === "Font") return f.fontFamily;
            if (typeof f === "string" && f) return f.split("\t")[0];
        } catch (e) { }
        return "";
    }

    function styleOf(f) {
        try {
            if (f && f.constructor && f.constructor.name === "Font") return f.fontStyleName;
            if (typeof f === "string" && f.indexOf("\t") > 0) return f.split("\t")[1];
        } catch (e) { }
        return "";
    }

    function statusText(f) {
        try {
            var s = f.status;
            if (s == FontStatus.INSTALLED) return "OK";
            if (s == FontStatus.NOT_AVAILABLE) return "Missing";
            if (s == FontStatus.SUBSTITUTED) return "Substituted";
            if (s == FontStatus.FAUXED) return "Faux";
            return String(s);
        } catch (e) { return "?"; }
    }

    // ---- style matching

    function norm(s) {
        return String(s).toLowerCase().replace(/[\s\-_]+/g, "").replace(/oblique/g, "italic");
    }

    function weightOf(s) {
        var n = norm(s);
        var table = [
            ["hairline", 100], ["thin", 100],
            ["extralight", 200], ["ultralight", 200],
            ["semibold", 600], ["demibold", 600],
            ["extrabold", 800], ["ultrabold", 800], ["heavy", 800],
            ["black", 900], ["ultra", 900],
            ["light", 300], ["medium", 500], ["demi", 600], ["bold", 700]
        ];
        for (var i = 0; i < table.length; i++) {
            if (n.indexOf(table[i][0]) >= 0) return table[i][1];
        }
        return 400; // regular, roman, book, normal, plain...
    }

    function isItalic(s) {
        var n = norm(s);
        return n.indexOf("italic") >= 0 || n.indexOf("kursiv") >= 0 || /it$/.test(n);
    }

    function widthOf(s) {
        var n = norm(s);
        if (/condensed|narrow|compressed|cond$|cn$/.test(n)) return -1;
        if (/extended|expanded|wide/.test(n)) return 1;
        return 0;
    }

    function isRegularName(s) {
        return /^(regular|roman|book|normal|plain|text)$/.test(norm(s));
    }

    function bestStyle(srcStyle, styles) {
        if (!styles || !styles.length) return srcStyle;
        var i, n = norm(srcStyle);

        // 1. exact (case / space insensitive)
        for (i = 0; i < styles.length; i++) {
            if (norm(styles[i]) === n) return styles[i];
        }

        // 2. same words in another order ("Italic Bold" vs "Bold Italic")
        var srcWords = wordKey(srcStyle);
        for (i = 0; i < styles.length; i++) {
            if (wordKey(styles[i]) === srcWords) return styles[i];
        }

        // 3. closest by weight / italic / width
        var w = weightOf(srcStyle), it = isItalic(srcStyle), wd = widthOf(srcStyle);
        var best = styles[0], bestScore = 1e9;
        for (i = 0; i < styles.length; i++) {
            var s = styles[i];
            var score = Math.abs(weightOf(s) - w);
            if (isItalic(s) !== it) score += 1000;
            if (widthOf(s) !== wd) score += 500;
            if (w === 400 && isRegularName(s)) score -= 1;   // prefer "Regular" for plain styles
            score += s.length / 1000;                         // prefer simpler names on ties
            if (score < bestScore) { bestScore = score; best = s; }
        }
        return best;
    }

    function wordKey(s) {
        var words = String(s).toLowerCase().replace(/oblique/g, "italic").split(/[\s\-_]+/);
        words.sort();
        return words.join(" ");
    }

    function showReport(title, text) {
        var r = new Window("dialog", "Replace Fonts - Report");
        r.alignChildren = "fill";
        r.add("statictext", undefined, title);
        var et = r.add("edittext", undefined, text, { multiline: true, readonly: true, scrolling: true });
        et.preferredSize = [700, 300];
        r.add("button", undefined, "OK", { name: "ok" });
        r.show();
    }

})();
