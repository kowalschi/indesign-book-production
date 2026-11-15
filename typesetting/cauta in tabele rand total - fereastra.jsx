// Insert "Total | 1 kg" row - permanent window (palette) - Adobe InDesign
//
// Same search as "cauta in tabele rand total.jsx", but the window stays open:
// you can click in the document, edit, scroll, and then continue with the buttons.
//
//   [Start]   collects the tables (scope) and goes to the first place found
//   [Insert]  inserts "Total | 1 kg" before the found row, stays on the same place
//   [Next]    goes to the next place found
//   [Insert all remaining]  inserts here and at all following places
//   [Close]
//
// Running the script again while the window is open brings the window to front.

#target indesign
#targetengine "cautaRandTotal"

var CAUTA_RAND_TOTAL_LIB = true;   // the include below defines only the functions
#include "cauta in tabele rand total.jsx"

(function () {

    // window already open -> show it
    if ($.global.cautaRandTotalWin) {
        try {
            $.global.cautaRandTotalWin.show();
            return;
        } catch (e) { }
    }

    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var L = CautaRandTotal;
    var session = null;
    var W = 470;

    var win = new Window("palette", "Insert row Total (2-column tables)", undefined, { resizeable: false });
    win.orientation = "column";
    win.alignChildren = "fill";

    var ui = L.buildSettingsUI(win, app.activeDocument);

    // ---- found
    var pFound = win.add("panel", undefined, "Found");
    pFound.alignChildren = "left";
    var stPlace = line(pFound);
    var stRow = line(pFound);
    var stPrev = line(pFound);
    var stMsg = line(pFound);
    var stCounts = line(pFound);

    // ---- buttons
    var bar = win.add("group");
    bar.alignment = "center";
    var btnStart = bar.add("button", undefined, "Start");
    var btnInsert = bar.add("button", undefined, "Insert");
    var btnNext = bar.add("button", undefined, "Next");
    var btnAll = bar.add("button", undefined, "Insert all remaining");
    var btnClose = bar.add("button", undefined, "Close");

    showState("Press Start.");

    btnStart.onClick = function () {
        if (app.documents.length === 0) { alert("Please open a document first."); return; }
        var doc = app.activeDocument;
        var settings = ui.read(doc);
        if (!settings) return;
        session = new L.Session(doc, settings);
        if (!session.tables.length) {
            session = null;
            showState(settings.inDocument
                ? "No tables in this document."
                : "No tables found: put the cursor in a text with tables, or choose Whole document.");
            return;
        }
        goNext();
    };

    btnInsert.onClick = function () {
        if (!checkSession()) return;
        app.scriptPreferences.enableRedraw = true;
        if (session.insert()) {
            L.showMatch(session.m.table.rows[session.m.rowIndex]);
            showState("Row \"" + session.settings.text1 + " | " + session.settings.text2 +
                "\" inserted. Press Next to continue.");
        } else {
            showState(session.message || "Not inserted.");
        }
    };

    btnNext.onClick = function () {
        if (!checkSession()) return;
        goNext();
    };

    btnAll.onClick = function () {
        if (!checkSession()) return;
        if (!confirm("Insert the row at this place and at all following places without asking?")) return;
        session.insertAll();
        showState("Done (all remaining).");
        alert(session.report(false));
    };

    btnClose.onClick = function () { win.close(); };

    win.onClose = function () {
        $.global.cautaRandTotalWin = null;
    };

    $.global.cautaRandTotalWin = win;
    win.show();

    // ================================================================

    function goNext() {
        if (session.next()) {
            L.showMatch(session.m.table.rows[session.m.rowIndex]);
            showState("Insert row \"" + session.settings.text1 + " | " +
                session.settings.text2 + "\" before this row?");
        } else {
            showState("No more places found.");
            alert(session.report(false));
        }
    }

    // the document of the search must still be open
    function checkSession() {
        if (!session) { showState("Press Start first."); return false; }
        if (!session.doc.isValid) {
            session = null;
            showState("The document was closed. Press Start.");
            return false;
        }
        return true;
    }

    // updates the texts and the buttons
    function showState(msg) {
        var m = session ? session.m : null;
        if (m) {
            var prev = session.prevRow();
            stPlace.text = "Place: " + L.tablePlace(m.table) + "  |  table row " +
                (m.rowIndex + 1) + " of " + m.table.rows.length;
            stRow.text = "Row found:   " + L.shortText(L.rowText(m.table.rows[m.rowIndex]));
            stPrev.text = "Row before:  " +
                (prev ? L.shortText(L.rowText(prev)) : "(none - first row of the table)");
        } else {
            stPlace.text = "Place: -";
            stRow.text = "Row found:   -";
            stPrev.text = "Row before:  -";
        }
        stMsg.text = msg || "";
        stCounts.text = session ? session.countsLine() : "";

        btnInsert.enabled = !!(m && !session.inserted);
        btnNext.enabled = !!session && !!m;
        btnAll.enabled = !!session && !!m;
    }

    function line(parent) {
        var st = parent.add("statictext", undefined, "");
        st.preferredSize.width = W;
        return st;
    }

})();
