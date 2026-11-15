// Change number in TOC - Adobe InDesign
// Runs a GREP Find/Change on the selected story (after asking if it is the TOC story):
//   Find:   ^(.+?)(\d+)
//   Change: $2 $1
// i.e. moves the number before the title, in every paragraph.

#target indesign

(function () {

    var FIND = "^(.+?)(\\d+)";
    var CHANGE = "$2 $1";

    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    if (app.selection.length === 0) {
        alert("Please select the TOC text (or put the cursor in it) first.");
        return;
    }

    var story = storyOf(app.selection[0]);
    if (!story) {
        alert("The selection is not in a text story.");
        return;
    }

    var preview = story.contents.substr(0, 120).replace(/[\r\n]+/g, " / ");
    if (!confirm("Is this the TOC story?\n\n\"" + preview + "...\"\n\nFind: " + FIND + "\nChange: " + CHANGE)) {
        return;
    }

    var found = 0;

    app.doScript(run, ScriptLanguage.JAVASCRIPT, undefined,
        UndoModes.ENTIRE_SCRIPT, "Change number in TOC");

    alert(found + " paragraphs changed.");

    // ================================================================ functions

    function run() {
        app.findGrepPreferences = NothingEnum.NOTHING;
        app.changeGrepPreferences = NothingEnum.NOTHING;
        try {
            app.findGrepPreferences.findWhat = FIND;
            app.changeGrepPreferences.changeTo = CHANGE;
            found = story.changeGrep().length;
        } finally {
            app.findGrepPreferences = NothingEnum.NOTHING;
            app.changeGrepPreferences = NothingEnum.NOTHING;
        }
    }

    function storyOf(sel) {
        try {
            if (sel.parentStory) return sel.parentStory;
        } catch (e) { }
        try {
            if (sel.texts && sel.texts.length) return sel.texts[0].parentStory;
        } catch (e) { }
        return null;
    }

})();
