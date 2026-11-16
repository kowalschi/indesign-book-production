// Delete tables (retetar) - Adobe InDesign
// Deletes, in the story of the selection / cursor, every table that:
//   - has 2 columns
//   - first cell (column 1, row 1) text starts with "Din această materie primă"
// Leading spaces are ignored, comparison is not case sensitive, and both forms
// of the letter "ă" (single char or a + breve) are accepted.
// The paragraph that held the table is removed too when it has no other text.
// Asks for confirmation before deleting. Undo: one step (Ctrl+Z).
// Tables nested inside table cells are ignored.

#target indesign

(function () {

    var COLS = 2;
    // "Din această materie primă" (written with \u escapes so file encoding does not matter)
    var START_TEXT = "Din această materie primă";

    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }
    if (app.selection.length === 0) {
        alert("Please select a text frame or place the cursor in the story.");
        return;
    }

    // ---- stories of the selection
    var stories = [], seen = {};
    for (var s = 0; s < app.selection.length; s++) {
        var st = storyOf(app.selection[s]);
        if (!st || seen[st.id]) continue;
        seen[st.id] = true;
        stories.push(st);
    }
    if (!stories.length) {
        alert("No story found in the selection.");
        return;
    }

    // ---- find matching tables
    var found = [];
    var places = [];
    var wanted = normalize(START_TEXT);
    for (var i = 0; i < stories.length; i++) {
        var tables = stories[i].tables;
        if (!tables.length) continue;
        var list = tables.everyItem().getElements();
        for (var t = 0; t < list.length; t++) {
            if (isTarget(list[t])) {
                found.push(list[t]);
                places.push(tablePlace(list[t]));
            }
        }
    }

    if (!found.length) {
        alert("No table found with " + COLS + " columns and first cell starting with:\n\"" + START_TEXT + "\"");
        return;
    }

    var info = found.length + " table(s) will be deleted:\n" +
        places.slice(0, 15).join("\n") + (places.length > 15 ? "\n..." : "") +
        "\n\nContinue?";
    if (!confirm(info)) return;

    var deleted = 0, parasRemoved = 0, errors = [];
    app.doScript(function () {
        // delete from the end so earlier references stay valid
        for (var k = found.length - 1; k >= 0; k--) {
            try {
                if (removeWithParagraph(found[k])) parasRemoved++;
                deleted++;
            } catch (e) {
                errors.push(places[k] + ": " + e.message);
            }
        }
    }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "Delete tables (retetar)");

    var msg = "Done.\nTables deleted: " + deleted +
        "\nEmpty paragraphs removed: " + parasRemoved;
    if (errors.length) msg += "\n\n" + errors.length + " errors:\n" + errors.slice(0, 15).join("\n");
    alert(msg);

    // ================================================================ functions

    // Deletes the table. If its paragraph holds nothing else (only the table
    // and the paragraph return), the whole paragraph is removed, so no empty
    // line is left. Returns true when the paragraph was removed.
    function removeWithParagraph(table) {
        var para = table.storyOffset.paragraphs[0];
        var rest = String(para.contents)
            .replace(/\u0016/g, "")   // table anchor character
            .replace(/[\s  -​ ﻿]+/g, "");
        if (rest !== "") {
            table.remove();           // other text in the paragraph: keep it
            return false;
        }
        var story = para.parentStory;
        var endsWithReturn = /\r$/.test(String(para.contents));
        var prevIndex = para.characters[0].index - 1;
        para.remove();                // removes the table too
        // last paragraph of the story (no return of its own):
        // remove the return before it, otherwise an empty line stays at the end
        if (!endsWithReturn && prevIndex >= 0) {
            var prev = story.characters[prevIndex];
            if (prev.isValid && prev.contents === "\r") prev.remove();
        }
        return true;
    }

    function isTarget(table) {
        try {
            if (table.columns.length !== COLS) return false;
            var txt = table.rows[0].cells[0].contents; // column 1, row 1
            if (typeof txt !== "string") return false;
            return normalize(txt).indexOf(wanted) === 0;
        } catch (e) {
            return false;
        }
    }

    // trims leading whitespace, unifies spaces and "ă", lower case
    function normalize(s) {
        return String(s)
            .replace(/ă/g, "ă")
            .replace(/Ă/g, "Ă")
            .replace(/[\s  -​ ﻿]+/g, " ")
            .replace(/^\s+/, "")
            .toLowerCase();
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

})();
