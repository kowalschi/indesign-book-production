// Insert "Total | 1 kg" row (retetar) - Adobe InDesign
//
// Profile 1 - tables with 2 columns.
// Searches the first column for a cell that contains "Valori nutritive"
// (so "II. Valori nutritive" is found too, case is ignored).
// The row before it must be:   Total | 1 kg
// If it is missing, the script stops at that place, selects the row and asks:
//   [Insert]  inserts the row and stays on the same place
//   [Next]    goes to the next place found
//   [Insert all remaining]  inserts here and everywhere else without asking
//   [Stop]
// The new row gets paragraph style "Text tabel" and bold text; "1 kg" is aligned right.
// Rows that already have "Total" above them are skipped automatically.
// Each insertion is one undo step (Ctrl+Z).
// Scope: tables of the story with the selection / cursor, or the whole document.
// Tables nested inside table cells are ignored.
//
// This file is also a library: "cauta in tabele rand total - fereastra.jsx"
// sets CAUTA_RAND_TOTAL_LIB = true and #includes it, then only the functions
// (global object CautaRandTotal) are defined and nothing runs.

#target indesign

var CautaRandTotal = (function () {

    var DEFAULTS = {
        cols: 2,
        search: "Valori nutritive",
        text1: "Total",
        text2: "1 kg",
        paraStyle: "Text tabel",
        fontStyle: "Bold"
    };

    // ================================================================ session
    // One search through the tables. Used by the dialogs and by the window.
    //   s.next()      -> goes to the next place that needs the row (s.m) or null
    //   s.insert()    -> inserts the row at the current place, stays there
    //   s.insertAll() -> inserts at the current place and at all following ones

    function Session(doc, settings) {
        this.doc = doc;
        this.settings = settings;
        this.tables = collectTables(doc, settings.inDocument);
        this.ti = 0;
        this.ri = 0;
        this.m = null;          // { table, rowIndex } of the "Valori nutritive" row
        this.inserted = false;  // row already inserted at the current place
        this.message = "";
        this.counts = { found: 0, inserted: 0, notInserted: 0, alreadyOk: 0 };
        this.errors = [];
    }

    Session.prototype.next = function () {
        if (this.m) {
            if (!this.inserted) this.counts.notInserted++;
            this.ri = this.m.rowIndex + 1;
        }
        this.m = null;
        this.inserted = false;
        while (true) {
            var m = this.findFrom();
            if (!m) return null;
            this.counts.found++;
            var prev = m.rowIndex > 0 ? m.table.rows[m.rowIndex - 1] : null;
            if (prev && isTotalRow(prev, this.settings)) {
                this.counts.alreadyOk++;
                this.ri = m.rowIndex + 1;
                continue;
            }
            this.m = m;
            return m;
        }
    };

    // next row (from position ti / ri) whose first cell contains the search text
    Session.prototype.findFrom = function () {
        var needle = this.settings.search.toLowerCase();
        for (; this.ti < this.tables.length; this.ti++, this.ri = 0) {
            var t = this.tables[this.ti];
            try {
                if (!t.isValid || t.columns.length !== DEFAULTS.cols) continue;
                var rows = t.rows;
                for (; this.ri < rows.length; this.ri++) {
                    var txt = cellText(rows[this.ri].cells[0]).toLowerCase();
                    if (txt.indexOf(needle) !== -1) {
                        return { table: t, rowIndex: this.ri };
                    }
                }
            } catch (e) {
                this.errors.push("Table " + (this.ti + 1) + ": " + e.message);
            }
        }
        return null;
    };

    // the current place is still the "Valori nutritive" row (the user may have
    // edited the document while the window was open)
    Session.prototype.isCurrentValid = function () {
        var m = this.m;
        try {
            if (!m || !m.table.isValid || m.rowIndex >= m.table.rows.length) return false;
            var txt = cellText(m.table.rows[m.rowIndex].cells[0]).toLowerCase();
            return txt.indexOf(this.settings.search.toLowerCase()) !== -1;
        } catch (e) {
            return false;
        }
    };

    Session.prototype.prevRow = function () {
        if (!this.m || this.m.rowIndex === 0) return null;
        return this.m.table.rows[this.m.rowIndex - 1];
    };

    // returns true when the row was inserted
    Session.prototype.insert = function () {
        this.message = "";
        if (!this.m || this.inserted) return false;
        if (!this.isCurrentValid()) {
            // search again in the same table, from its first row
            this.ri = 0;
            this.m = null;
            this.message = "The table was changed. Press Next to search again.";
            return false;
        }
        try {
            insertTotalRow(this.m.table, this.m.rowIndex, this.settings, this.errors);
            this.counts.inserted++;
            this.m.rowIndex++;      // the found row moved one row down
            this.inserted = true;
            return true;
        } catch (e) {
            this.errors.push(tablePlace(this.m.table) + ": " + e.message + " (line " + e.line + ")");
            this.message = "Error: " + e.message;
            return false;
        }
    };

    Session.prototype.insertAll = function () {
        if (this.m && !this.inserted) this.insert();
        while (this.next()) this.insert();
    };

    Session.prototype.report = function (stopped) {
        var s = this.settings, c = this.counts;
        var msg = (stopped ? "Stopped by user." : "Done.") +
            "\n\nRows with \"" + s.search + "\" found: " + c.found +
            "\nRow \"" + s.text1 + "\" inserted: " + c.inserted +
            "\nNot inserted (skipped with Next): " + c.notInserted +
            "\nAlready had \"" + s.text1 + "\" above: " + c.alreadyOk;
        if (this.errors.length) {
            msg += "\n\n" + this.errors.length + " errors:\n" + this.errors.slice(0, 15).join("\n");
        }
        return msg;
    };

    Session.prototype.countsLine = function () {
        var c = this.counts;
        return "Found " + c.found + "  |  inserted " + c.inserted +
            "  |  skipped " + c.notInserted + "  |  already OK " + c.alreadyOk +
            (this.errors.length ? "  |  errors " + this.errors.length : "");
    };

    // ================================================================ insert

    function isTotalRow(row, settings) {
        try {
            return trim(cellText(row.cells[0])).toLowerCase() === settings.text1.toLowerCase();
        } catch (e) {
            return false;
        }
    }

    function insertTotalRow(table, rowIndex, settings, errors) {
        app.doScript(function () {
            var target = table.rows[rowIndex];
            var newRow = table.rows.add(LocationOptions.BEFORE, target);

            // the "Valori nutritive" row may be merged over both columns:
            // the new row must have 2 separate cells
            if (newRow.cells.length < DEFAULTS.cols) {
                try { newRow.cells[0].unmerge(); } catch (e) { }
            }

            var c1 = newRow.cells[0], c2 = newRow.cells[1];
            c1.contents = settings.text1;
            c2.contents = settings.text2;
            formatCell(c1, settings, errors);
            formatCell(c2, settings, errors);
            c2.texts[0].justification = Justification.RIGHT_ALIGN; // "1 kg" right
        }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT,
            "Insert row " + settings.text1);
    }

    function formatCell(cell, settings, errors) {
        var t = cell.texts[0];
        if (settings.style && settings.style.isValid) {
            try { t.applyParagraphStyle(settings.style, true); } catch (e) {
                errors.push("Paragraph style: " + e.message);
            }
        }
        if (settings.fontStyle) {
            try { t.fontStyle = settings.fontStyle; } catch (e) {
                errors.push("Font style \"" + settings.fontStyle + "\" not available for font " +
                    safeFontName(t) + " (" + tablePlace(cell.parent) + ")");
            }
        }
    }

    function safeFontName(t) {
        try { return t.appliedFont.fontFamily; } catch (e) { return "?"; }
    }

    // ================================================================ settings UI
    // Builds the "Scope" and "Profile 1" panels inside parent (dialog or window).
    // Returns { read(doc) -> settings or null, setDocument(doc) }

    function buildSettingsUI(parent, doc) {
        var hasSel = app.selection.length > 0;

        var pScope = parent.add("panel", undefined, "Scope");
        pScope.orientation = "row";
        pScope.alignChildren = "left";
        var rbStory = pScope.add("radiobutton", undefined, "Story of the selection / cursor");
        var rbDoc = pScope.add("radiobutton", undefined, "Whole document");
        rbStory.value = hasSel;
        rbDoc.value = !hasSel;

        var p1 = parent.add("panel", undefined, "Profile 1 - tables with 2 columns");
        p1.alignChildren = "left";
        var fSearch = field(p1, "Find in column 1 (contains)", DEFAULTS.search);
        var fText1 = field(p1, "New row - column 1", DEFAULTS.text1);
        var fText2 = field(p1, "New row - column 2 (right)", DEFAULTS.text2);

        var gs = p1.add("group");
        var stl = gs.add("statictext", undefined, "Paragraph style");
        stl.preferredSize.width = 180;
        var ddStyle = gs.add("dropdownlist", undefined, []);
        ddStyle.preferredSize.width = 200;

        var fFont = field(p1, "Font style (empty = none)", DEFAULTS.fontStyle);
        var warn = p1.add("statictext", undefined, "");
        warn.preferredSize.width = 390;

        var styles = [], styleDoc = null;

        // fill the style list from doc; keeps the selected name when possible
        function setDocument(d) {
            var keep = ddStyle.selection ? ddStyle.selection.text : DEFAULTS.paraStyle;
            styleDoc = d;
            styles = d.allParagraphStyles;
            ddStyle.removeAll();
            var sel = -1, def = -1;
            for (var i = 0; i < styles.length; i++) {
                var n = stylePath(styles[i]);
                ddStyle.add("item", n);
                if (sel < 0 && n === keep) sel = i;
                if (def < 0 && styles[i].name.toLowerCase() === DEFAULTS.paraStyle.toLowerCase()) def = i;
            }
            if (sel < 0) sel = def;
            ddStyle.selection = sel >= 0 ? sel : 0;
            warn.text = def < 0
                ? "Warning: paragraph style \"" + DEFAULTS.paraStyle + "\" not found in this document."
                : "";
        }

        function read(d) {
            if (d !== styleDoc) setDocument(d);
            if (!trim(fSearch.text) || !trim(fText1.text)) {
                alert("Search text and column 1 text cannot be empty.");
                return null;
            }
            return {
                inDocument: rbDoc.value,
                search: trim(fSearch.text),
                text1: trim(fText1.text),
                text2: trim(fText2.text),
                style: ddStyle.selection ? styles[ddStyle.selection.index] : null,
                fontStyle: trim(fFont.text)
            };
        }

        setDocument(doc);
        return { read: read, setDocument: setDocument };
    }

    function field(parent, label, value) {
        var g = parent.add("group");
        var st = g.add("statictext", undefined, label);
        st.preferredSize.width = 180;
        var et = g.add("edittext", undefined, String(value));
        et.preferredSize.width = 200;
        return et;
    }

    function stylePath(st) {
        var n = st.name, p = st.parent;
        try {
            while (p && p.constructor.name === "ParagraphStyleGroup") {
                n = p.name + " / " + n;
                p = p.parent;
            }
        } catch (e) { }
        return n;
    }

    // ================================================================ modal run
    // (when this file is started directly from the Scripts panel)

    function runDialogs() {
        if (app.documents.length === 0) {
            alert("Please open a document first.");
            return;
        }
        var doc = app.activeDocument;

        var dlg = new Window("dialog", "Insert row Total (2-column tables)");
        dlg.orientation = "column";
        dlg.alignChildren = "fill";
        var ui = buildSettingsUI(dlg, doc);
        var bar = dlg.add("group");
        bar.alignment = "right";
        var btnOk = bar.add("button", undefined, "Start", { name: "ok" });
        bar.add("button", undefined, "Cancel", { name: "cancel" });
        var settings = null;
        btnOk.onClick = function () {
            settings = ui.read(doc);
            if (settings) dlg.close(1);
        };
        if (dlg.show() !== 1 || !settings) return;

        var s = new Session(doc, settings);
        if (!s.tables.length) {
            alert("No tables found.");
            return;
        }

        var dlgPos = null, stopped = false;
        while (s.next()) {
            var action;
            do {
                showMatch(s.m.table.rows[s.m.rowIndex]);
                var res = askUser(s, dlgPos);
                action = res.action;
                dlgPos = res.pos;
                if (action === "insert") s.insert();   // stay on the same place
            } while (action === "insert");
            if (action === "stop") { stopped = true; break; }
            if (action === "all") { s.insertAll(); break; }
        }
        alert(s.report(stopped));
    }

    // [Insert] [Next] [Insert all remaining] [Stop]
    function askUser(s, pos) {
        var m = s.m, st = s.settings, prev = s.prevRow();
        var dlg = new Window("dialog", "Insert row " + st.text1 + " - " + s.counts.found);
        dlg.orientation = "column";
        dlg.alignChildren = "fill";

        var info = dlg.add("panel", undefined, "Found");
        info.alignChildren = "left";
        info.add("statictext", undefined, "Place: " + tablePlace(m.table) +
            "  |  table row " + (m.rowIndex + 1) + " of " + m.table.rows.length);
        info.add("statictext", undefined, "Row found:   " +
            shortText(rowText(m.table.rows[m.rowIndex])));
        info.add("statictext", undefined, "Row before:  " +
            (prev ? shortText(rowText(prev)) : "(none - first row of the table)"));

        dlg.add("statictext", undefined, s.inserted
            ? "Row \"" + st.text1 + " | " + st.text2 + "\" inserted. Press Next to continue."
            : "Insert row \"" + st.text1 + " | " + st.text2 + "\" before this row?");

        var bar = dlg.add("group");
        bar.alignment = "right";
        var btnInsert = bar.add("button", undefined, "Insert");
        var btnNext = bar.add("button", undefined, "Next");
        var btnAll = bar.add("button", undefined, "Insert all remaining");
        var btnStop = bar.add("button", undefined, "Stop", { name: "cancel" });
        btnInsert.enabled = !s.inserted;
        dlg.defaultElement = s.inserted ? btnNext : btnInsert;
        dlg.cancelElement = btnStop;

        var res = { action: "stop", pos: pos };
        function done(a) {
            res.action = a;
            try { res.pos = [dlg.location[0], dlg.location[1]]; } catch (e) { }
            dlg.close(1);
        }
        btnInsert.onClick = function () { done("insert"); };
        btnNext.onClick = function () { done("next"); };
        btnAll.onClick = function () { done("all"); };
        btnStop.onClick = function () { done("stop"); };

        if (pos) {
            try { dlg.location = pos; } catch (e) { }
        }
        dlg.show();
        return res;
    }

    // ================================================================ helpers

    function cellText(cell) {
        try { return String(cell.contents); } catch (e) { return ""; }
    }

    function trim(s) {
        return String(s).replace(/^[\s ﻿]+|[\s ﻿]+$/g, "");
    }

    function rowText(row) {
        var parts = [];
        var cells = row.cells;
        for (var i = 0; i < cells.length; i++) parts.push(trim(cellText(cells[i])));
        return parts.join(" | ");
    }

    function shortText(s) {
        s = String(s).replace(/[\r\n]+/g, " ");
        return s.length > 70 ? s.substr(0, 67) + "..." : s;
    }

    // select the row and bring its page into view
    function showMatch(row) {
        try { row.select(); } catch (e) {
            try { row.cells[0].select(); } catch (e2) { }
        }
        try {
            var f = row.cells[0].insertionPoints[0].parentTextFrames[0];
            if (f && f.parentPage) app.activeWindow.activePage = f.parentPage;
        } catch (e) { }
    }

    // ================================================================ tables

    function collectTables(doc, inDocument) {
        var result = [];
        if (inDocument) {
            var stories = doc.stories.everyItem().getElements();
            for (var i = 0; i < stories.length; i++) addTables(stories[i].tables, result);
        } else {
            var seen = {};
            for (var s = 0; s < app.selection.length; s++) {
                var story = storyOf(app.selection[s]);
                if (!story || seen[story.id]) continue;
                seen[story.id] = true;
                addTables(story.tables, result);
            }
        }
        return result;
    }

    function storyOf(sel) {
        try { if (sel.parentStory) return sel.parentStory; } catch (e) { }
        try { if (sel.texts && sel.texts.length) return sel.texts[0].parentStory; } catch (e) { }
        try { return sel.parent.parentStory; } catch (e) { }
        return null;
    }

    function addTables(tables, result) {
        if (!tables.length) return;
        var list = tables.everyItem().getElements();
        for (var i = 0; i < list.length; i++) result.push(list[i]);
    }

    function tablePlace(t) {
        try {
            var f = t.storyOffset.parentTextFrames[0];
            if (f && f.parentPage) return "page " + f.parentPage.name;
            return "overset / pasteboard";
        } catch (e) {
            return "?";
        }
    }

    return {
        DEFAULTS: DEFAULTS,
        Session: Session,
        buildSettingsUI: buildSettingsUI,
        runDialogs: runDialogs,
        showMatch: showMatch,
        rowText: rowText,
        shortText: shortText,
        tablePlace: tablePlace
    };
})();

// started directly -> dialogs; #included by the window script -> library only
if (typeof CAUTA_RAND_TOTAL_LIB === "undefined" || !CAUTA_RAND_TOTAL_LIB) {
    CautaRandTotal.runDialogs();
}
