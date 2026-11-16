// Format tables (retetar) - Adobe InDesign
// Shows a dialog with one profile per table type. Tables are recognised by
// their number of columns:
//
//  Profile 1 - table with 2 columns
//    - column widths 95.3 / 25.5 mm
//    - no stroke, no fill, text vertically centered
//    - horizontal text alignment is kept as is
//    - row heights "at least": first row (header) 4.3, other rows 4.3
//
//  Profile 2 - table with 5 columns (follows table 1)
//    - column widths 53.212 / 17 / 17 / 17 / 17 mm
//    - stroke black 0.5 pt on all lines, no fill, text vertically centered
//    - first column text left, other columns centered; header cells centered
//    - header = 3 rows (merged cells are kept as they are), each row "at least"
//      4.3, other rows 5
//
//  Profile 3 - table with 3 columns (Materia prima | 100 de portii | u/m)
//    - column widths 71.512 / 30 / 20 mm
//    - stroke, row heights and alignment like table 2
//    - header = 2 rows (col 1 merged over 2 rows, cols 2-3 merged in row 1;
//      merged cells are kept as they are)
//
// All values can be changed in the dialog (decimal comma or point).
// Each table is checked first (sizes, strokes, fill, alignment); tables that are
// already correct are not touched. Tables nested inside table cells are ignored.
// Scope: tables of the story with the selection / cursor, or the whole document.

#target indesign

(function () {

    var UNIT = "mm";

    // ---- default values shown in the dialog
    var DEFAULTS = {
        t1: { cols: 2, w1: 95.3,   w2: 25.5, headerRows: 1, headerH: 4.3, bodyH: 4.3 },
        t2: { cols: 5, w1: 53.212, w2: 17,   headerRows: 3, headerH: 4.3, bodyH: 4.5, stroke: 0.5 },
        t3: { cols: 3, w1: 71.512, w2: 30, w3: 20, headerRows: 2, headerH: 4.3, bodyH: 4.5, stroke: 0.5 }
    };

    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var noneSwatch = doc.swatches.itemByName("None");
    var blackSwatch = null;

    var settings = showDialog();
    if (!settings) return;

    var counts = { t1: 0, t2: 0, t3: 0, ok1: 0, ok2: 0, ok3: 0, skipped: 0, colsChanged: 0, rowsChanged: 0 };
    var errors = [];
    var others = [];        // tables not changed (not 2 / 5 columns): where they are
    var cursorReport = "";  // details of the table where the cursor is

    app.doScript(run, ScriptLanguage.JAVASCRIPT, undefined,
        UndoModes.ENTIRE_SCRIPT, "Format tables (retetar)");

    var msg = "Done.\nTable 1 (" + DEFAULTS.t1.cols + " columns): " + counts.t1 +
        " formatted, " + counts.ok1 + " already correct" +
        "\nTable 2 (" + DEFAULTS.t2.cols + " columns): " + counts.t2 +
        " formatted, " + counts.ok2 + " already correct" +
        "\nTable 3 (" + DEFAULTS.t3.cols + " columns): " + counts.t3 +
        " formatted, " + counts.ok3 + " already correct" +
        "\nOther tables, not changed: " + counts.skipped +
        "\n\nColumns resized: " + counts.colsChanged +
        "\nRows resized: " + counts.rowsChanged;
    if (others.length) {
        msg += "\n\nNot changed (other column count):\n" + others.slice(0, 10).join("\n") +
            (others.length > 10 ? "\n..." : "");
    }
    if (errors.length) {
        msg += "\n\n" + errors.length + " errors:\n" + errors.slice(0, 15).join("\n");
    }
    if (cursorReport) {
        msg += "\n\n---- Table at cursor ----\n" + cursorReport;
    }
    alert(msg);

    // ================================================================ dialog

    function showDialog() {
        var hasSel = app.selection.length > 0;
        var dlg = new Window("dialog", "Format tables (retetar)");
        dlg.orientation = "column";
        dlg.alignChildren = "fill";

        var pScope = dlg.add("panel", undefined, "Scope");
        pScope.orientation = "row";
        pScope.alignChildren = "left";
        var rbStory = pScope.add("radiobutton", undefined, "Story of the selection / cursor");
        var rbDoc = pScope.add("radiobutton", undefined, "Whole document");
        rbStory.value = hasSel;
        rbDoc.value = !hasSel;

        // ---- profile 1
        var p1 = dlg.add("panel", undefined, "Table 1 - 2 columns");
        p1.alignChildren = "left";
        var on1 = p1.add("checkbox", undefined, "Format tables with 2 columns");
        on1.value = true;
        var g1 = p1.add("group");
        g1.orientation = "column";
        g1.alignChildren = "left";
        var f1 = {
            w1: field(g1, "Column 1 width (mm)", DEFAULTS.t1.w1),
            w2: field(g1, "Column 2 width (mm)", DEFAULTS.t1.w2),
            headerRows: field(g1, "Header rows (0 = none)", DEFAULTS.t1.headerRows),
            headerH: field(g1, "Header row height, at least (mm)", DEFAULTS.t1.headerH),
            bodyH: field(g1, "Other rows height, at least (mm)", DEFAULTS.t1.bodyH)
        };
        p1.add("statictext", undefined, "No stroke, no fill, text centered vertically,\nhorizontal alignment kept as is (col 1 left, col 2 right).", { multiline: true });
        on1.onClick = function () { g1.enabled = on1.value; };

        // ---- profile 2
        var p2 = dlg.add("panel", undefined, "Table 2 - 5 columns");
        p2.alignChildren = "left";
        var on2 = p2.add("checkbox", undefined, "Format tables with 5 columns");
        on2.value = true;
        var g2 = p2.add("group");
        g2.orientation = "column";
        g2.alignChildren = "left";
        var f2 = {
            w1: field(g2, "Column 1 width (mm)", DEFAULTS.t2.w1),
            w2: field(g2, "Columns 2-5 width (mm)", DEFAULTS.t2.w2),
            headerRows: field(g2, "Header rows (0 = none)", DEFAULTS.t2.headerRows),
            headerH: field(g2, "Each header row height, at least (mm)", DEFAULTS.t2.headerH),
            bodyH: field(g2, "Other rows height, at least (mm)", DEFAULTS.t2.bodyH),
            stroke: field(g2, "Stroke black, weight (pt)", DEFAULTS.t2.stroke)
        };
        p2.add("statictext", undefined, "No fill, text centered vertically; column 1 left, columns 2-5 centered,\nheader cells centered. Merged header cells are kept.", { multiline: true });
        on2.onClick = function () { g2.enabled = on2.value; };

        // ---- profile 3
        var p3 = dlg.add("panel", undefined, "Table 3 - 3 columns");
        p3.alignChildren = "left";
        var on3 = p3.add("checkbox", undefined, "Format tables with 3 columns");
        on3.value = true;
        var g3 = p3.add("group");
        g3.orientation = "column";
        g3.alignChildren = "left";
        var f3 = {
            w1: field(g3, "Column 1 width (mm)", DEFAULTS.t3.w1),
            w2: field(g3, "Column 2 width (mm)", DEFAULTS.t3.w2),
            w3: field(g3, "Column 3 width (mm)", DEFAULTS.t3.w3),
            headerRows: field(g3, "Header rows (0 = none)", DEFAULTS.t3.headerRows),
            headerH: field(g3, "Each header row height, at least (mm)", DEFAULTS.t3.headerH),
            bodyH: field(g3, "Other rows height, at least (mm)", DEFAULTS.t3.bodyH),
            stroke: field(g3, "Stroke black, weight (pt)", DEFAULTS.t3.stroke)
        };
        p3.add("statictext", undefined, "Like table 2: no fill, centered vertically; column 1 left,\nother columns and header cells centered. Merged header cells are kept.", { multiline: true });
        on3.onClick = function () { g3.enabled = on3.value; };

        var bar = dlg.add("group");
        bar.alignment = "right";
        var btnOk = bar.add("button", undefined, "Format", { name: "ok" });
        bar.add("button", undefined, "Cancel", { name: "cancel" });

        var result = null;
        btnOk.onClick = function () {
            var r = {
                inDocument: rbDoc.value,
                t1: on1.value ? readFields(f1, DEFAULTS.t1) : null,
                t2: on2.value ? readFields(f2, DEFAULTS.t2) : null,
                t3: on3.value ? readFields(f3, DEFAULTS.t3) : null
            };
            if ((on1.value && !r.t1) || (on2.value && !r.t2) || (on3.value && !r.t3)) {
                alert("Please enter valid numbers (widths and heights greater than 0).");
                return;
            }
            if (!r.t1 && !r.t2 && !r.t3) {
                alert("Select at least one table profile.");
                return;
            }
            result = r;
            dlg.close(1);
        };

        if (dlg.show() !== 1) return null;
        return result;
    }

    function field(parent, label, value) {
        var g = parent.add("group");
        var st = g.add("statictext", undefined, label);
        st.preferredSize.width = 230;
        var et = g.add("edittext", undefined, String(value));
        et.preferredSize.width = 70;
        return et;
    }

    // Numbers from the edit fields ("95,3" and "95.3" both accepted).
    // Returns null when something is not valid.
    function readFields(f, defaults) {
        var out = { cols: defaults.cols };
        for (var k in f) {
            if (!f.hasOwnProperty(k)) continue;
            var v = parseFloat(String(f[k].text).replace(",", "."));
            if (isNaN(v) || v < 0) return null;
            if (v === 0 && k !== "headerRows") return null;
            out[k] = v;
        }
        out.headerRows = Math.round(out.headerRows);
        return out;
    }

    // ================================================================ functions

    function run() {
        var progress = createProgress("Format tables (retetar)");
        progress.message("Collecting tables...");
        var tables = settings.inDocument ? collectDocumentTables() : collectSelectionTables();
        progress.setMax(tables.length);
        // read/compare dimensions in mm, whatever the document units are
        var oldUnit = app.scriptPreferences.measurementUnit;
        app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS;
        try {
            var cursorTable = null;
            try { cursorTable = tableAtCursor(); } catch (e) { }
            if (cursorTable) {
                try { cursorReport = "BEFORE: " + describeTable(cursorTable); }
                catch (e) { cursorReport = "BEFORE: " + e.message; }
            }
            formatAll(tables, progress);
            if (cursorTable) {
                try { cursorReport += "\n\nAFTER: " + describeTable(cursorTable); }
                catch (e) { cursorReport += "\n\nAFTER: " + e.message; }
            }
        } finally {
            app.scriptPreferences.measurementUnit = oldUnit;
            progress.close();
        }
    }

    function formatAll(tables, progress) {
        for (var i = 0; i < tables.length; i++) {
            progress.step(i + 1, "Table " + (i + 1) + " of " + tables.length);
            var t = tables[i];
            try {
                var cols = t.columns.length;
                if (settings.t1 && cols === settings.t1.cols) {
                    if (isTableOk(t, settings.t1, 1)) {
                        counts.ok1++;
                    } else {
                        formatTable1(t, settings.t1);
                        counts.t1++;
                    }
                } else if (settings.t2 && cols === settings.t2.cols) {
                    if (isTableOk(t, settings.t2, 2)) {
                        counts.ok2++;
                    } else {
                        formatTable2(t, settings.t2);
                        counts.t2++;
                    }
                } else if (settings.t3 && cols === settings.t3.cols) {
                    if (isTableOk(t, settings.t3, 3)) {
                        counts.ok3++;
                    } else {
                        formatTable2(t, settings.t3); // same style as table 2
                        counts.t3++;
                    }
                } else {
                    counts.skipped++;
                    others.push(tablePlace(t) + ": " + cols + " columns");
                }
            } catch (e) {
                errors.push("Table " + (i + 1) + ": " + e.message + " (line " + e.line + ")");
            }
        }
    }

    // Progress bar window (palette, stays open while the script works)
    function createProgress(title) {
        var w = new Window("palette", title);
        w.orientation = "column";
        w.alignChildren = "fill";
        var label = w.add("statictext", undefined, "");
        label.preferredSize.width = 360;
        var bar = w.add("progressbar", undefined, 0, 1);
        bar.preferredSize = [360, 14];
        var timeLabel = w.add("statictext", undefined, "");
        timeLabel.preferredSize.width = 360;
        w.show();
        w.update();
        var startTime = new Date().getTime();
        return {
            message: function (text) {
                label.text = text;
                w.update();
            },
            setMax: function (max) {
                bar.maxvalue = Math.max(1, max);
                bar.value = 0;
                startTime = new Date().getTime(); // estimate counts only the formatting
                timeLabel.text = "Estimating time...";
                w.update();
            },
            // value = number of the item about to be processed (value - 1 are done)
            step: function (value, text) {
                bar.value = value;
                label.text = text;
                var done = value - 1;
                var now = new Date().getTime();
                var elapsed = now - startTime;
                if (done > 0 && elapsed > 0) {
                    var remaining = elapsed / done * (bar.maxvalue - done);
                    timeLabel.text = "Elapsed " + formatDuration(elapsed) +
                        "  |  Remaining ~" + formatDuration(remaining) +
                        "  |  Finish at ~" + formatClock(new Date(now + remaining));
                }
                w.update();
            },
            close: function () {
                try { w.close(); } catch (e) { }
            }
        };
    }

    // 75000 ms -> "1m 15s"
    function formatDuration(ms) {
        var sec = Math.round(ms / 1000);
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        if (h > 0) return h + "h " + m + "m";
        if (m > 0) return m + "m " + s + "s";
        return s + "s";
    }

    // Date -> "14:05:09"
    function formatClock(d) {
        function pad(n) { return (n < 10 ? "0" : "") + n; }
        return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }

    // Tables in all stories (tables nested inside table cells are not searched)
    function collectDocumentTables() {
        var result = [];
        var stories = doc.stories.everyItem().getElements();
        for (var i = 0; i < stories.length; i++) {
            addTables(stories[i].tables, result);
        }
        return result;
    }

    // Tables of the stories that contain the selection
    function collectSelectionTables() {
        var result = [], seen = {};
        for (var s = 0; s < app.selection.length; s++) {
            var story = storyOf(app.selection[s]);
            if (!story || seen[story.id]) continue;
            seen[story.id] = true;
            addTables(story.tables, result);
        }
        return result;
    }

    function storyOf(sel) {
        try {
            if (sel.parentStory) return sel.parentStory;
        } catch (e) { }
        // text frame selected -> its story
        try {
            if (sel.texts && sel.texts.length) return sel.texts[0].parentStory;
        } catch (e) { }
        try {
            return sel.parent.parentStory;
        } catch (e) { }
        return null;
    }

    function addTables(tables, result) {
        if (!tables.length) return;
        var list = tables.everyItem().getElements();
        for (var i = 0; i < list.length; i++) result.push(list[i]);
    }

    function isTableOk(table, p, profile) {
        return tableProblem(table, p, profile) === "";
    }

    // ---- check the entire table
    // returns "" when everything is already correct, otherwise the first problem found
    // (read in one call per property; any doubt -> problem, table is formatted)
    function tableProblem(table, p, profile) {
        try {
            // column widths
            var widths = asArray(table.columns.everyItem().width);
            for (var c = 0; c < widths.length; c++) {
                var tw = colWidth(p, c);
                if (!sameSize(widths[c], tw)) {
                    return "column " + (c + 1) + " width " + round2(widths[c]) + " mm (should be " + tw + ")";
                }
            }
            // row heights ("at least")
            var minH = asArray(table.rows.everyItem().minimumHeight);
            var grow = asArray(table.rows.everyItem().autoGrow);
            for (var r = 0; r < minH.length; r++) {
                var th = r < p.headerRows ? p.headerH : p.bodyH;
                if (grow[r] !== true) return "row " + (r + 1) + " height is fixed, not 'at least'";
                if (!sameSize(minH[r], th)) {
                    return "row " + (r + 1) + " height " + round2(minH[r]) + " mm (should be " + th + ")";
                }
            }

            var cells = table.cells.everyItem();
            // vertical centered
            if (!allEqual(asArray(cells.verticalJustification), VerticalJustification.CENTER_ALIGN)) {
                return "text not centered vertically in all cells";
            }
            // no fill
            if (!allNamed(asArray(cells.fillColor), "None")) return "some cells have a fill";
            // strokes
            var weight = profile === 1 ? 0 : p.stroke;
            var colorName = profile === 1 ? null : "Black"; // weight 0: color does not matter
            var sides = ["top", "bottom", "left", "right"];
            for (var i = 0; i < sides.length; i++) {
                var s = sides[i];
                if (!allSameSize(asArray(cells[s + "EdgeStrokeWeight"]), ptToMm(weight))) {
                    return s + " cell stroke is not " + weight + " pt";
                }
                if (!sameSize(table[s + "BorderStrokeWeight"], ptToMm(weight))) {
                    return s + " table border is not " + weight + " pt";
                }
                if (colorName) {
                    if (!allNamed(asArray(cells[s + "EdgeStrokeColor"]), colorName)) {
                        return s + " cell stroke is not " + colorName;
                    }
                    if (!allNamed([table[s + "BorderStrokeColor"]], colorName)) {
                        return s + " table border is not " + colorName;
                    }
                }
            }

            // tables 2 and 3: horizontal alignment
            if (profile !== 1) {
                var list = table.cells.everyItem().getElements();
                for (var k = 0; k < list.length; k++) {
                    var cell = list[k];
                    var parts = String(cell.name).split(":"); // "column:row"
                    var col = parseInt(parts[0], 10), row = parseInt(parts[1], 10);
                    var left = row >= p.headerRows && col === 0 && cell.columnSpan === 1;
                    var want = left ? Justification.LEFT_ALIGN : Justification.CENTER_ALIGN;
                    var paras = cell.paragraphs;
                    for (var q = 0; q < paras.length; q++) {
                        if (paras[q].justification != want) {
                            return "cell " + (col + 1) + ":" + (row + 1) + " should be " +
                                (left ? "left" : "centered");
                        }
                    }
                }
            }
            return "";
        } catch (e) {
            return "check failed: " + e.message;
        }
    }

    function round2(v) {
        return Math.round(Number(v) * 100) / 100;
    }

    // ---- report for the table where the cursor is (to understand why a table
    // was or was not changed)
    function tableAtCursor() {
        if (!app.selection.length) return null;
        var o = app.selection[0];
        for (var guard = 0; o && guard < 20; guard++) {
            var n = "";
            try { n = o.constructor.name; } catch (e) { return null; }
            if (n === "Table") return o;
            if (n === "Cell" || n === "Row" || n === "Column") return o.parent;
            if (n === "Story" || n === "Document" || n === "Application") return null;
            try { o = o.parent; } catch (e) { return null; }
        }
        return null;
    }

    function describeTable(t) {
        var cols = t.columns.length;
        var nested = false;
        try { nested = t.parent.constructor.name === "Cell"; } catch (e) { }
        var s = cols + " columns, " + t.rows.length + " rows";
        if (nested) s += ", NESTED inside a table cell (not searched by this script)";
        var w = asArray(t.columns.everyItem().width);
        var ws = [];
        for (var i = 0; i < w.length; i++) ws.push(round2(w[i]));
        s += "\nwidths (mm): " + ws.join(" / ");
        var p = null, profile = 0;
        if (cols === DEFAULTS.t1.cols) { p = settings.t1; profile = 1; }
        else if (cols === DEFAULTS.t2.cols) { p = settings.t2; profile = 2; }
        else if (cols === DEFAULTS.t3.cols) { p = settings.t3; profile = 3; }
        if (!profile) return s + "\n-> not 2, 3 or 5 columns, the script does not change it";
        if (!p) return s + "\n-> profile " + profile + " is turned off in the dialog";
        var prob = tableProblem(t, p, profile);
        return s + "\n-> " + (prob === "" ? "all correct" : "problem: " + prob);
    }

    // where a table is: "page 12"
    function tablePlace(t) {
        try {
            var f = t.storyOffset.parentTextFrames[0];
            if (f && f.parentPage) return "page " + f.parentPage.name;
            return "overset / pasteboard";
        } catch (e) {
            return "?";
        }
    }

    function allEqual(arr, value) {
        for (var i = 0; i < arr.length; i++) if (arr[i] != value) return false;
        return true;
    }

    function allSameSize(arr, value) {
        for (var i = 0; i < arr.length; i++) if (!sameSize(arr[i], value)) return false;
        return true;
    }

    // true if every swatch in arr has this name
    function allNamed(arr, name) {
        for (var i = 0; i < arr.length; i++) {
            var o = arr[i];
            var n = (typeof o === "string") ? o : o.name;
            if (n !== name) return false;
        }
        return true;
    }

    function ptToMm(pt) {
        return pt * 25.4 / 72;
    }

    // ---- table 1: no stroke, no fill, alignment kept
    function formatTable1(table, p) {
        table.cells.everyItem().verticalJustification = VerticalJustification.CENTER_ALIGN;
        applyDimensions(table, p);
        setStrokes(table, 0, noneSwatch);
        table.cells.everyItem().fillColor = noneSwatch;
    }

    // ---- table 2: black 0.5 stroke, no fill, col 1 left, others centered
    function formatTable2(table, p) {
        table.cells.everyItem().verticalJustification = VerticalJustification.CENTER_ALIGN;
        applyDimensions(table, p);
        setStrokes(table, p.stroke, getBlack());
        table.cells.everyItem().fillColor = noneSwatch;

        var cells = table.cells.everyItem().getElements();
        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            try {
                var isHeader = cell.parentRow.index < p.headerRows;
                var left = !isHeader && cell.parentColumn.index === 0 && cell.columnSpan === 1;
                cell.paragraphs.everyItem().justification =
                    left ? Justification.LEFT_ALIGN : Justification.CENTER_ALIGN;
            } catch (e) {
                errors.push("Align cell " + cell.name + ": " + e.message);
            }
        }
    }

    // Checks column widths and row heights first; only what is wrong is changed
    function applyDimensions(table, p) {
        setColumnWidths(table, p);
        setRowHeights(table, p);
    }

    // target width of column c (0-based): w1 for the first, w3 for the third
    // when the profile has it, otherwise w2
    function colWidth(p, c) {
        if (c === 0) return p.w1;
        if (c === 2 && p.w3) return p.w3;
        return p.w2;
    }

    // Only columns whose width differs from the target are changed.
    // (measurement unit is set to mm in run(), so the values read are in mm)
    function setColumnWidths(table, p) {
        var widths = asArray(table.columns.everyItem().width);
        var changed = 0;
        for (var c = 0; c < widths.length; c++) {
            var target = colWidth(p, c);
            if (sameSize(widths[c], target)) continue;
            table.columns[c].width = target + UNIT;
            changed++;
        }
        if (changed) counts.colsChanged += changed;
        return changed;
    }

    // Rows are "at least": header rows and body rows.
    // Only rows that are not already "at least" the target height are changed.
    function setRowHeights(table, p) {
        var rows = table.rows;
        var minH = asArray(rows.everyItem().minimumHeight);
        var grow = asArray(rows.everyItem().autoGrow);
        var changed = 0;
        for (var r = 0; r < minH.length; r++) {
            var target = (r < p.headerRows ? p.headerH : p.bodyH);
            if (grow[r] === true && sameSize(minH[r], target)) continue;
            var h = target + UNIT;
            var row = rows[r];
            row.autoGrow = true;
            row.minimumHeight = h;
            row.height = h;
            changed++;
        }
        if (changed) counts.rowsChanged += changed;
        return changed;
    }

    function sameSize(actual, target) {
        return Math.abs(Number(actual) - target) < 0.01; // mm tolerance
    }

    function asArray(v) {
        return (v instanceof Array) ? v : [v];
    }

    // Stroke on all cell edges and on the table borders
    function setStrokes(table, weight, color) {
        var sides = ["top", "bottom", "left", "right"];
        var cells = table.cells.everyItem();
        for (var i = 0; i < sides.length; i++) {
            var s = sides[i];
            // weight in points (the script works in mm, so the unit is given explicitly)
            cells[s + "EdgeStrokeWeight"] = weight + "pt";
            cells[s + "EdgeStrokeColor"] = color;
            table[s + "BorderStrokeWeight"] = weight + "pt";
            table[s + "BorderStrokeColor"] = color;
        }
    }

    function getBlack() {
        if (blackSwatch && blackSwatch.isValid) return blackSwatch;
        blackSwatch = doc.swatches.itemByName("Black");
        if (!blackSwatch.isValid) {
            blackSwatch = doc.colors.add({
                name: "Black", model: ColorModel.PROCESS,
                space: ColorSpace.CMYK, colorValue: [0, 0, 0, 100]
            });
        }
        return blackSwatch;
    }

})();
