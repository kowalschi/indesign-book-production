// Decrease row height - Adobe InDesign
// Decreases the height of the rows of the selected cells by STEP every time
// the script is run. Select cells (or rows, or a whole table, or put the
// cursor in a cell) and run the script.
// Rows keep their mode ("at least" or "exactly").
//
// STEP is in UNITS (change to MeasurementUnits.POINTS for points).

#target indesign

(function () {

    var STEP = 0.1;
    var UNITS = MeasurementUnits.MILLIMETERS;

    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var rows = selectedRows();

    if (rows.length === 0) {
        alert("Please select one or more table cells.");
        return;
    }

    var errors = [];

    // Work in UNITS, then restore the user's vertical ruler units
    var vp = doc.viewPreferences;
    var savedUnits = vp.verticalMeasurementUnits;
    vp.verticalMeasurementUnits = UNITS;
    try {
        app.doScript(run, ScriptLanguage.JAVASCRIPT, undefined,
            UndoModes.ENTIRE_SCRIPT, "Decrease row height " + STEP);
    } finally {
        vp.verticalMeasurementUnits = savedUnits;
    }

    if (errors.length) {
        alert(errors.length + " rows could not be changed:\n" + errors.slice(0, 15).join("\n"));
    }

    // ================================================================ functions

    function run() {
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            try {
                var h = round(row.height - STEP);
                if (row.autoGrow) row.minimumHeight = h;
                row.height = h;
            } catch (e) {
                errors.push("Row " + (row.index + 1) + ": " + e.message);
            }
        }
    }

    // Unique rows of the selected cells
    function selectedRows() {
        var result = [], seen = {};
        if (app.selection.length === 0) return result;

        for (var s = 0; s < app.selection.length; s++) {
            var sel = app.selection[s];
            var cells = cellsOf(sel);
            for (var i = 0; i < cells.length; i++) {
                var row = cells[i].parentRow;
                var key = row.parent.id + "_" + row.index;
                if (seen[key]) continue;
                seen[key] = true;
                result.push(row);
            }
        }
        return result;
    }

    function cellsOf(sel) {
        var name = sel.constructor.name;
        if (name === "Cell" || name === "Table" || name === "Row" || name === "Column") {
            return sel.cells.everyItem().getElements();
        }
        // Text cursor / text selection inside a cell
        try {
            if (sel.parent && sel.parent.constructor.name === "Cell") return [sel.parent];
        } catch (e) { }
        return [];
    }

    function round(v) {
        return Math.round(v * 1000) / 1000;
    }

})();
