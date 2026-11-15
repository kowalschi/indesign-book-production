// Change case of titles - Adobe InDesign
// Changes the case of all paragraphs that use a chosen paragraph style:
// UPPERCASE, lowercase, Sentence case or Title Case.
// Option: capitalize the first letter of the text between quotes,
// e.g.  Covrigi „brașov”  ->  Covrigi „Brașov”  (Sentence case).
//
// Only the letters are changed, character by character, so local
// formatting (bold, italic, character styles) is kept.

#target indesign

(function () {

    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var LABEL = "changeCaseTitles";

    var MODES = ["UPPERCASE", "lowercase", "Sentence case", "Title Case"];
    var UPPER = 0, LOWER = 1, SENTENCE = 2, TITLE = 3;

    // Opening quotes. A straight quote (") opens and closes.
    var OPEN_QUOTES = "„“«‚‘‹";   // „ “ « ‚ ‘ ‹
    var STRAIGHT_QUOTES = "\"";

    // Romanian letters, in case toUpperCase / toLowerCase misses them
    var UP_MAP = { "ă": "Ă", "â": "Â", "î": "Î",
                   "ș": "Ș", "ş": "Ş", "ț": "Ț", "ţ": "Ţ" };
    var LOW_MAP = {};
    for (var k in UP_MAP) LOW_MAP[UP_MAP[k]] = k;

    // ---------------------------------------------------------------- styles

    var styles = [], styleNames = [];
    var all = doc.allParagraphStyles;
    for (var i = 0; i < all.length; i++) {
        if (all[i].name.indexOf("[No ") === 0) continue;
        styles.push(all[i]);
        styleNames.push(stylePath(all[i]));
    }

    var hasTextSelection = false;
    try {
        hasTextSelection = app.selection.length > 0 &&
            app.selection[0].hasOwnProperty("paragraphs");
    } catch (e) { }

    // Last used settings
    var saved = (app.extractLabel(LABEL) || "").split("\t");
    var savedStyle = saved[0] || "", savedMode = parseInt(saved[1], 10), savedQuotes = saved[2] !== "0";
    if (isNaN(savedMode)) savedMode = SENTENCE;

    // ---------------------------------------------------------------- dialog

    var w = new Window("dialog", "Change Case of Titles");
    w.orientation = "column";
    w.alignChildren = "fill";

    var pStyle = w.add("panel", undefined, "Paragraph style of the titles");
    pStyle.alignChildren = "fill";
    var dd = pStyle.add("dropdownlist", undefined, styleNames);
    dd.preferredSize = [380, -1];
    var stCount = pStyle.add("statictext", undefined, "");

    var pMode = w.add("panel", undefined, "Change to");
    pMode.alignChildren = "left";
    var rb = [];
    for (var m = 0; m < MODES.length; m++) rb.push(pMode.add("radiobutton", undefined, MODES[m]));
    var cbQuotes = pMode.add("checkbox", undefined, "Capitalize first letter between quotes  („brașov” → „Brașov”)");

    var pScope = w.add("panel", undefined, "Where");
    pScope.orientation = "row";
    var rbDoc = pScope.add("radiobutton", undefined, "Whole document");
    var rbSel = pScope.add("radiobutton", undefined, "Selection only");
    rbSel.enabled = hasTextSelection;
    rbDoc.value = true;

    var pPrev = w.add("panel", undefined, "Preview (first title found)");
    pPrev.alignChildren = "fill";
    var stBefore = pPrev.add("statictext", undefined, "");
    var stAfter = pPrev.add("statictext", undefined, "");
    stBefore.preferredSize = stAfter.preferredSize = [380, -1];

    var gBtn = w.add("group");
    gBtn.alignment = "right";
    gBtn.add("button", undefined, "Cancel", { name: "cancel" });
    var btnOk = gBtn.add("button", undefined, "Change", { name: "ok" });

    // Initial values
    dd.selection = 0;
    for (var d = 0; d < styleNames.length; d++) {
        if (styleNames[d] === savedStyle) { dd.selection = d; break; }
    }
    rb[savedMode].value = true;
    cbQuotes.value = savedQuotes;

    function currentMode() {
        for (var i = 0; i < rb.length; i++) if (rb[i].value) return i;
        return SENTENCE;
    }

    function refresh() {
        var mode = currentMode();
        // Title case already capitalizes, uppercase has nothing to do
        cbQuotes.enabled = (mode === SENTENCE || mode === LOWER);

        var found = dd.selection ? findTitles(styles[dd.selection.index], scopeTarget()) : [];
        stCount.text = found.length + " paragraphs with this style.";
        btnOk.enabled = found.length > 0;
        if (found.length) {
            var before = charsOf(found[0]);
            stBefore.text = "Before:  " + toPlain(before);
            stAfter.text = "After:     " + toPlain(convert(before, mode, cbQuotes.enabled && cbQuotes.value));
        } else {
            stBefore.text = "Before:";
            stAfter.text = "After:";
        }
    }

    dd.onChange = refresh;
    for (var r = 0; r < rb.length; r++) rb[r].onClick = refresh;
    cbQuotes.onClick = refresh;
    rbDoc.onClick = rbSel.onClick = refresh;

    refresh();

    if (w.show() !== 1) return;

    // ---------------------------------------------------------------- run

    var style = styles[dd.selection.index];
    var mode = currentMode();
    var quotes = cbQuotes.enabled && cbQuotes.value;
    var target = scopeTarget();

    app.insertLabel(LABEL, styleNames[dd.selection.index] + "\t" + mode + "\t" + (cbQuotes.value ? "1" : "0"));

    var changed = 0, titles = 0;
    app.doScript(function () {
        var found = findTitles(style, target);
        titles = found.length;
        for (var i = 0; i < found.length; i++) {
            if (applyCase(found[i], mode, quotes)) changed++;
        }
    }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "Change case of titles");

    alert("Done. " + changed + " of " + titles + " titles changed to " + MODES[mode] + ".");

    // ================================================================ functions

    function scopeTarget() {
        return (rbSel.value && hasTextSelection) ? app.selection[0] : doc;
    }

    // Text of every paragraph with the style (without the paragraph return)
    function findTitles(style, target) {
        app.findGrepPreferences = NothingEnum.NOTHING;
        app.changeGrepPreferences = NothingEnum.NOTHING;
        app.findGrepPreferences.findWhat = "[^\\r]+";
        app.findGrepPreferences.appliedParagraphStyle = style;
        var res = [];
        try { res = target.findGrep(); } catch (e) { }
        app.findGrepPreferences = NothingEnum.NOTHING;
        return res;
    }

    // Characters of a text as an array of strings ("" for special characters)
    function charsOf(text) {
        var c = text.characters.everyItem().contents;
        if (!(c instanceof Array)) c = [c];
        var out = [];
        for (var i = 0; i < c.length; i++) out.push(typeof c[i] === "string" ? c[i] : "");
        return out;
    }

    function toPlain(chars) {
        var s = chars.join("");
        return s.length > 70 ? s.substr(0, 70) + "…" : s;
    }

    // Change only the characters that differ, so formatting is kept
    function applyCase(text, mode, quotes) {
        var before = charsOf(text);
        var after = convert(before, mode, quotes);
        var any = false;
        for (var i = 0; i < before.length; i++) {
            if (after[i] !== before[i]) {
                text.characters[i].contents = after[i];
                any = true;
            }
        }
        return any;
    }

    function convert(chars, mode, quotes) {
        var out = [], i;
        if (mode === UPPER) {
            for (i = 0; i < chars.length; i++) out.push(up(chars[i]));
            return out;
        }

        var capNext = (mode !== LOWER);   // first letter of the title
        var inWord = false, inStraight = false;
        for (i = 0; i < chars.length; i++) {
            var c = chars[i];

            if (!isLetter(c)) {
                if (isQuoteOpen(c, inStraight)) {
                    if (quotes) capNext = true;
                    if (c === STRAIGHT_QUOTES) inStraight = true;
                } else if (c === STRAIGHT_QUOTES) {
                    inStraight = false;
                }
                if (mode === SENTENCE && /[.!?]/.test(c)) capNext = true;
                // an apostrophe inside a word keeps it one word (d'acord)
                if (!(inWord && /['’]/.test(c))) inWord = false;
                out.push(c);
                continue;
            }

            var startOfWord = !inWord;
            inWord = true;
            if (capNext || (mode === TITLE && startOfWord)) {
                out.push(up(c));
                capNext = false;
            } else {
                out.push(low(c));
            }
        }
        return out;
    }

    function isQuoteOpen(c, inStraight) {
        if (c === "") return false;
        if (OPEN_QUOTES.indexOf(c) >= 0) return true;
        if (c === STRAIGHT_QUOTES) return !inStraight;
        return false;
    }

    function isLetter(c) {
        return c !== "" && c.length === 1 && up(c) !== low(c);
    }

    function up(c) {
        if (UP_MAP.hasOwnProperty(c)) return UP_MAP[c];
        var u = c.toUpperCase();
        return u.length === c.length ? u : c;   // e.g. ß -> SS: keep original
    }

    function low(c) {
        if (LOW_MAP.hasOwnProperty(c)) return LOW_MAP[c];
        var l = c.toLowerCase();
        return l.length === c.length ? l : c;
    }

    function stylePath(st) {
        var name = st.name, p = st.parent;
        try {
            while (p && p.constructor.name === "ParagraphStyleGroup") {
                name = p.name + " / " + name;
                p = p.parent;
            }
        } catch (e) { }
        return name;
    }

})();
