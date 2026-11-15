// Move the title to next page - Adobe InDesign
// Paragraphs with the paragraph style chosen in the dialog are moved to the
// next page when their line is lower on the page than a limit (default 158 mm).
//
//  - Y is measured from the top edge of the page, at the baseline of the
//    paragraph's first line (or last line, chosen in the dialog)
//  - the paragraph gets a new style "<chosen style>_nextpage", made in the same
//    style group, based on the chosen style, with "Start Paragraph: On Next
//    Page" (Keep Options); no characters are added. Local overrides are kept.
//    If the "_nextpage" style already exists it is reused.
//  - Action "Restore original style" undoes this: every paragraph with
//    "<chosen style>_nextpage" gets "<chosen style>" again (local overrides
//    kept). In the dialog you can pick either the original or the "_nextpage"
//    style. Optionally the "_nextpage" style is deleted when no longer used.
//  - paragraphs are checked in text order, so after each move the following
//    paragraphs are measured at their new position
//  - overset paragraphs and paragraphs on the pasteboard are skipped
//
// Scope: story of the selection / cursor, or the whole document.
// Everything can be undone with one Ctrl+Z.

#target indesign

(function () {

    var DEFAULT_LIMIT = 180; // mm
    var SUFFIX = "_nextpage"; // added to the name of the new style

    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;

    var settings = showDialog();
    if (!settings) return;

    var counts = { checked: 0, moved: 0, skipped: 0, restored: 0 };
    var errors = [];
    var movedPages = [];
    var nextPageStyle = null; // created on the first move
    var styleDeleted = false;

    if (settings.restore) {
        app.doScript(runRestore, ScriptLanguage.JAVASCRIPT, undefined,
            UndoModes.ENTIRE_SCRIPT, "Restore original title style");

        var rmsg = "Done.\nParagraphs with style \"" + settings.nextStyle.name + "\": " + counts.checked +
            "\nRestored to \"" + settings.style.name + "\": " + counts.restored;
        if (styleDeleted) rmsg += "\n\nThe style \"" + settings.nextStyleName + "\" was deleted.";
        if (errors.length) {
            rmsg += "\n\n" + errors.length + " errors:\n" + errors.slice(0, 15).join("\n");
        }
        alert(rmsg);
        return;
    }

    app.doScript(run, ScriptLanguage.JAVASCRIPT, undefined,
        UndoModes.ENTIRE_SCRIPT, "Move title to next page");

    var msg = "Done.\nParagraphs with style \"" + settings.style.name + "\": " + counts.checked +
        "\nMoved to next page: " + counts.moved +
        "\nSkipped (overset / not on a page): " + counts.skipped;
    if (nextPageStyle) {
        msg += "\n\nMoved paragraphs have the style \"" + nextPageStyle.name + "\"";
    }
    if (movedPages.length) {
        msg += "\n\nMoved from pages: " + movedPages.slice(0, 40).join(", ") +
            (movedPages.length > 40 ? " ..." : "");
    }
    if (errors.length) {
        msg += "\n\n" + errors.length + " errors:\n" + errors.slice(0, 15).join("\n");
    }
    alert(msg);

    // ================================================================ dialog

    function showDialog() {
        var styles = doc.allParagraphStyles;
        var names = [];
        var defaultIndex = 0;
        for (var i = 0; i < styles.length; i++) {
            names.push(stylePath(styles[i]));
            if (!defaultIndex && /titl/i.test(styles[i].name)) defaultIndex = i;
        }

        var selStory = selectionStory();

        var dlg = new Window("dialog", "Move title to next page");
        dlg.orientation = "column";
        dlg.alignChildren = "fill";

        var pAction = dlg.add("panel", undefined, "Action");
        pAction.orientation = "row";
        pAction.alignChildren = "left";
        var rbMove = pAction.add("radiobutton", undefined, "Move to next page");
        var rbRestore = pAction.add("radiobutton", undefined, "Restore original style (undo \"" + SUFFIX + "\")");
        rbMove.value = true;

        var pStyle = dlg.add("panel", undefined, "Paragraph style");
        pStyle.alignChildren = "fill";
        var ddStyle = pStyle.add("dropdownlist", undefined, names);
        ddStyle.preferredSize.width = 360;
        ddStyle.selection = defaultIndex;

        var pPos = dlg.add("panel", undefined, "Position");
        pPos.alignChildren = "left";
        var gLimit = pPos.add("group");
        var stLimit = gLimit.add("statictext", undefined, "Move when Y is greater than (mm)");
        stLimit.preferredSize.width = 230;
        var etLimit = gLimit.add("edittext", undefined, String(DEFAULT_LIMIT));
        etLimit.preferredSize.width = 70;
        var gLine = pPos.add("group");
        gLine.add("statictext", undefined, "Measure at the baseline of:");
        var rbFirst = gLine.add("radiobutton", undefined, "First line");
        var rbLast = gLine.add("radiobutton", undefined, "Last line");
        rbFirst.value = true;

        var pScope = dlg.add("panel", undefined, "Scope");
        pScope.orientation = "row";
        pScope.alignChildren = "left";
        var rbStory = pScope.add("radiobutton", undefined, "Story of the selection / cursor");
        var rbDoc = pScope.add("radiobutton", undefined, "Whole document");
        rbStory.enabled = !!selStory;
        rbStory.value = !!selStory;
        rbDoc.value = !selStory;

        var pRestore = dlg.add("panel", undefined, "Restore");
        pRestore.alignChildren = "left";
        var cbDelete = pRestore.add("checkbox", undefined,
            "Delete the \"" + SUFFIX + "\" style when no longer used");
        cbDelete.value = false;

        var bar = dlg.add("group");
        bar.alignment = "right";
        var btnOk = bar.add("button", undefined, "Move", { name: "ok" });
        bar.add("button", undefined, "Cancel", { name: "cancel" });

        function updateMode() {
            var restore = rbRestore.value;
            pPos.enabled = !restore;
            pRestore.enabled = restore;
            btnOk.text = restore ? "Restore" : "Move";
        }
        rbMove.onClick = updateMode;
        rbRestore.onClick = updateMode;
        updateMode();

        var result = null;
        btnOk.onClick = function () {
            if (!ddStyle.selection) {
                alert("Please choose a paragraph style.");
                return;
            }
            if (rbRestore.value) {
                var pair = resolveStylePair(styles[ddStyle.selection.index]);
                if (!pair) return;
                result = {
                    restore: true,
                    style: pair.base,
                    nextStyle: pair.next,
                    nextStyleName: pair.next.name,
                    deleteStyle: cbDelete.value,
                    story: rbStory.value ? selStory : null
                };
                dlg.close(1);
                return;
            }
            var limit = parseFloat(String(etLimit.text).replace(",", "."));
            if (isNaN(limit) || limit <= 0) {
                alert("Please enter a valid Y value (mm).");
                return;
            }
            if (!ddStyle.selection) {
                alert("Please choose a paragraph style.");
                return;
            }
            result = {
                style: styles[ddStyle.selection.index],
                limit: limit,
                lastLine: rbLast.value,
                story: rbStory.value ? selStory : null
            };
            dlg.close(1);
        };

        if (dlg.show() !== 1) return null;
        return result;
    }

    // From either "<style>" or "<style>_nextpage" find both styles
    // (same style group). Returns { base, next } or null (with an alert).
    function resolveStylePair(chosen) {
        var container = chosen.parent;
        var base, next;
        var n = chosen.name;
        if (n.length > SUFFIX.length && n.substr(n.length - SUFFIX.length) === SUFFIX) {
            next = chosen;
            base = container.paragraphStyles.itemByName(n.substr(0, n.length - SUFFIX.length));
            if (!base.isValid) {
                // fall back to the style it is based on
                try {
                    var b = chosen.basedOn;
                    if (b && b.constructor.name === "ParagraphStyle") base = b;
                } catch (e) { }
            }
            if (!base || !base.isValid) {
                alert("Cannot find the original style for \"" + n + "\".");
                return null;
            }
        } else {
            base = chosen;
            next = container.paragraphStyles.itemByName(n + SUFFIX);
            if (!next.isValid) {
                alert("There is no style \"" + n + SUFFIX + "\" in this document.\nNothing to restore.");
                return null;
            }
        }
        return { base: base, next: next };
    }

    // "Group/Subgroup/Style name"
    function stylePath(style) {
        var path = style.name;
        try {
            var p = style.parent;
            while (p && p.constructor.name === "ParagraphStyleGroup") {
                path = p.name + "/" + path;
                p = p.parent;
            }
        } catch (e) { }
        return path;
    }

    function selectionStory() {
        if (app.selection.length === 0) return null;
        var sel = app.selection[0];
        try {
            if (sel.parentStory) return sel.parentStory;
        } catch (e) { }
        try {
            if (sel.texts && sel.texts.length) return sel.texts[0].parentStory;
        } catch (e) { }
        return null;
    }

    // ================================================================ run

    function run() {
        // measure in mm from the top-left corner of each page
        var vp = doc.viewPreferences;
        var saved = {
            v: vp.verticalMeasurementUnits,
            h: vp.horizontalMeasurementUnits,
            origin: vp.rulerOrigin,
            zero: doc.zeroPoint
        };
        try {
            vp.verticalMeasurementUnits = MeasurementUnits.MILLIMETERS;
            vp.horizontalMeasurementUnits = MeasurementUnits.MILLIMETERS;
            vp.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
            doc.zeroPoint = [0, 0];

            var paragraphs = findParagraphs();
            var progress = createProgress("Move title to next page");
            progress.setMax(paragraphs.length);
            try {
                for (var i = 0; i < paragraphs.length; i++) {
                    progress.step(i + 1, "Paragraph " + (i + 1) + " of " + paragraphs.length);
                    checkParagraph(paragraphs[i]);
                }
            } finally {
                progress.close();
            }
        } finally {
            vp.verticalMeasurementUnits = saved.v;
            vp.horizontalMeasurementUnits = saved.h;
            vp.rulerOrigin = saved.origin;
            doc.zeroPoint = saved.zero;
        }
    }

    // ================================================================ restore

    function runRestore() {
        var paragraphs = findParagraphs(settings.nextStyle);
        var progress = createProgress("Restore original title style");
        progress.setMax(paragraphs.length);
        try {
            for (var i = 0; i < paragraphs.length; i++) {
                progress.step(i + 1, "Paragraph " + (i + 1) + " of " + paragraphs.length);
                counts.checked++;
                try {
                    // false = keep the paragraph's local overrides
                    paragraphs[i].applyParagraphStyle(settings.style, false);
                    counts.restored++;
                } catch (e) {
                    errors.push("Paragraph \"" + shortText(paragraphs[i]) + "\": " + e.message);
                }
            }
        } finally {
            progress.close();
        }

        if (settings.deleteStyle) {
            // only when no paragraph in the whole document still uses it
            if (findParagraphs(settings.nextStyle, doc).length === 0) {
                try {
                    settings.nextStyle.remove(settings.style);
                    styleDeleted = true;
                } catch (e) {
                    errors.push("Delete style: " + e.message);
                }
            }
        }
    }

    // All paragraphs with the given style (default: chosen style), in text order.
    // where: story or document (default: the chosen scope)
    function findParagraphs(style, where) {
        app.findTextPreferences = NothingEnum.NOTHING;
        app.changeTextPreferences = NothingEnum.NOTHING;
        app.findTextPreferences.appliedParagraphStyle = style || settings.style;
        var found;
        try {
            var target = where || settings.story || doc;
            found = target.findText();
        } finally {
            app.findTextPreferences = NothingEnum.NOTHING;
        }

        // one found range can hold several consecutive paragraphs
        var result = [], seen = {};
        for (var i = 0; i < found.length; i++) {
            var paras = found[i].paragraphs.everyItem().getElements();
            for (var p = 0; p < paras.length; p++) {
                var para = paras[p];
                var key = para.parentStory.id + ":" + para.index;
                if (seen[key]) continue;
                seen[key] = true;
                result.push(para);
            }
        }
        return result;
    }

    function checkParagraph(para) {
        try {
            counts.checked++;
            if (para.lines.length === 0) { counts.skipped++; return; } // overset

            var line = settings.lastLine ? para.lines[-1] : para.lines[0];
            var frames = line.parentTextFrames;
            if (!frames.length || !frames[0].parentPage) { counts.skipped++; return; }

            if (line.baseline > settings.limit) {
                var pageName = frames[0].parentPage.name;
                // false = keep the paragraph's local overrides
                para.applyParagraphStyle(getNextPageStyle(), false);
                para.parentStory.recompose(); // next paragraphs are measured after the reflow
                counts.moved++;
                movedPages.push(pageName);
            }
        } catch (e) {
            errors.push("Paragraph \"" + shortText(para) + "\": " + e.message);
        }
    }

    // "<chosen style>_nextpage" in the same group, based on the chosen style,
    // starting on the next page. Reused if it already exists.
    function getNextPageStyle() {
        if (nextPageStyle && nextPageStyle.isValid) return nextPageStyle;
        var base = settings.style;
        var name = base.name + SUFFIX;
        var container = base.parent; // document or style group
        var style = container.paragraphStyles.itemByName(name);
        if (!style.isValid) {
            style = container.paragraphStyles.add({ name: name, basedOn: base });
            try { style.nextStyle = base.nextStyle; } catch (e) { }
        }
        style.startParagraph = StartParagraph.NEXT_PAGE;
        nextPageStyle = style;
        return style;
    }

    function shortText(para) {
        try {
            var t = String(para.contents).replace(/[\r\n]+/g, " ");
            return t.length > 40 ? t.substr(0, 40) + "..." : t;
        } catch (e) {
            return "?";
        }
    }

    // ================================================================ progress

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
            setMax: function (max) {
                bar.maxvalue = Math.max(1, max);
                bar.value = 0;
                startTime = new Date().getTime();
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

})();
