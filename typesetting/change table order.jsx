// Change table order (retetar) - Adobe InDesign
// In every recipe the 2-column table comes first and the 5-column table
// right after it. This script swaps them: the 2-column table is moved after
// the 5-column table.
//
// A pair is swapped only when:
//  - the 2-column table is directly followed by a 5-column table
//  - both are in the same story
//  - between them there is nothing but empty paragraphs / spaces / breaks
//    (any text, e.g. the next recipe's title, means they are NOT a pair)
//
// The tables are moved with their own paragraph (paragraph style, spacing),
// empty paragraphs between them stay between them.
// Running the script twice does nothing the second time (order is 5 -> 2).
// Everything can be undone with one Ctrl+Z.

#target indesign

(function () {

    var FIRST_COLS = 2;   // table that is now first
    var SECOND_COLS = 5;  // table that is now second

    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;

    // ---- scope: story with the cursor or whole document
    var stories = [];
    var selStory = null;
    try {
        if (app.selection.length > 0 && app.selection[0].hasOwnProperty("parentStory")) {
            selStory = app.selection[0].parentStory;
        }
    } catch (e) {}

    if (selStory && confirm("Only the story with the cursor / selection?\n\nYes = this story only\nNo = whole document")) {
        stories = [selStory];
    } else {
        stories = doc.stories.everyItem().getElements();
    }

    var counts = { swapped: 0, notAdjacent: 0 };
    var errors = [];

    app.doScript(run, ScriptLanguage.JAVASCRIPT, undefined,
        UndoModes.ENTIRE_SCRIPT, "Change table order (retetar)");

    var msg = "Done.\nPairs swapped (" + FIRST_COLS + " col <-> " + SECOND_COLS + " col): " + counts.swapped +
        "\nPairs skipped, text between tables: " + counts.notAdjacent;
    if (errors.length) {
        msg += "\n\n" + errors.length + " errors:\n" + errors.slice(0, 15).join("\n");
    }
    alert(msg);

    // ================================================================ run

    function run() {
        for (var s = 0; s < stories.length; s++) {
            var story = stories[s];
            var n = story.tables.length;
            if (n < 2) continue;

            // backwards, so a swap never changes the position of earlier tables
            for (var i = n - 2; i >= 0; i--) {
                try {
                    var t1 = story.tables[i];
                    var t2 = story.tables[i + 1];
                    if (t1.columns.length !== FIRST_COLS || t2.columns.length !== SECOND_COLS) continue;

                    if (swapPair(story, t1, t2)) {
                        counts.swapped++;
                        i--; // table i is now the 5-column one, don't pair it again
                    } else {
                        counts.notAdjacent++;
                    }
                } catch (e) {
                    errors.push("Story " + s + ", table " + (i + 1) + ": " + e.message);
                }
            }
        }
    }

    // ================================================================ swap

    // Returns false (and changes nothing) if the tables are not adjacent.
    function swapPair(story, t1, t2) {
        var a = t1.storyOffset.index; // anchor character of table 1
        var b = t2.storyOffset.index; // anchor character of table 2
        if (b <= a) return false;

        var addedReturn = false;
        var u1 = unitOf(story, a);
        var u2 = unitOf(story, b);

        // gap = characters between the two units, must be "empty"
        var gapStart = u1.end + 1;
        var gapEnd = u2.start - 1;
        if (gapEnd >= gapStart) {
            var gap = story.characters.itemByRange(gapStart, gapEnd).contents;
            if (gap instanceof Array) gap = gap.join("");
            if (!/^[\s﻿]*$/.test(String(gap))) return false;
        }

        // table 2 is the last thing in the story, without a paragraph return:
        // add one so both tables keep their own paragraph, removed at the end
        if (u2.isParagraph && !u2.hasReturn) {
            story.insertionPoints[-1].contents = "\r";
            u2.end++;
            addedReturn = true;
        }

        var len1 = u1.end - u1.start + 1;
        var len2 = u2.end - u2.start + 1;
        var lenGap = Math.max(0, gapEnd - gapStart + 1);

        // 1. table 2 (with its paragraph) before table 1
        //    [T1][gap][T2][rest]  ->  [T2][T1][gap][rest]
        story.characters.itemByRange(u2.start, u2.end)
            .move(LocationOptions.BEFORE, story.insertionPoints[u1.start]);

        // 2. table 1 after the gap
        //    [T2][T1][gap][rest]  ->  [T2][gap][T1][rest]
        if (lenGap > 0) {
            var s1 = u1.start + len2;
            story.characters.itemByRange(s1, s1 + len1 - 1)
                .move(LocationOptions.BEFORE, story.insertionPoints[s1 + len1 + lenGap]);
        }

        if (addedReturn) {
            var last = story.characters[-1];
            if (last.contents === "\r") last.remove();
        }
        return true;
    }

    // Text unit to move for the table anchored at index idx:
    // the whole paragraph if it holds only the table, otherwise just the anchor.
    function unitOf(story, idx) {
        var anchor = story.characters[idx];
        var para = anchor.paragraphs[0];
        var pStart = para.characters[0].index;
        var pLen = para.characters.length;
        var pEnd = pStart + pLen - 1;
        var lastChar = para.characters[-1].contents;
        var hasReturn = (lastChar === "\r");
        var textLen = hasReturn ? pLen - 1 : pLen;

        if (pStart === idx && textLen === 1) {
            return { start: pStart, end: pEnd, isParagraph: true, hasReturn: hasReturn };
        }
        return { start: idx, end: idx, isParagraph: false, hasReturn: false };
    }

})();
