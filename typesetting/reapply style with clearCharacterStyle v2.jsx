// DESCRIPTION: Reapply a chosen paragraph style to all paragraphs of that style
// in the current story, with an option to also clear any character styles
// applied within them (reset to "[None]"). Local character formatting
// (overrides) is left untouched.

var myDocument = app.activeDocument;

if (app.selection.length === 0 || !app.selection[0].hasOwnProperty('parentStory')) {
	alert('Please click inside the text you want to process, then run the script.');
	exit();
}

var mystory = app.selection[0].parentStory;

// Defensive reset in case a previously run script left find/change preferences
// set — this script doesn't search with them itself, but clearing them here
// keeps behavior consistent with the other scripts in this set.
app.findTextPreferences = NothingEnum.nothing;
app.changeTextPreferences = NothingEnum.nothing;
app.findGrepPreferences = NothingEnum.nothing;
app.changeGrepPreferences = NothingEnum.nothing;

var choice = showOptionsDialog(myDocument);
if (!choice) {
	exit();
}

app.doScript(function () {
	reapplyStyle(choice.paragraphStyle, choice.clearCharacterStyle);
}, ScriptLanguage.javascript, undefined, UndoModes.ENTIRE_SCRIPT, "Reapply Style: " + choice.paragraphStyle.name);

// Reset again afterward so no leftover preferences affect scripts run next.
app.findGrepPreferences = NothingEnum.nothing;
app.changeGrepPreferences = NothingEnum.nothing;

alert('done');


function showOptionsDialog(doc) {
	var styles = doc.allParagraphStyles;
	var styleNames = [];
	for (var i = 0; i < styles.length; i++) {
		styleNames.push(styles[i].name);
	}

	var dlg = new Window('dialog', 'Reapply Paragraph Style');
	dlg.orientation = 'column';
	dlg.alignChildren = 'fill';

	var styleGroup = dlg.add('panel', undefined, 'Paragraph style');
	styleGroup.orientation = 'column';
	styleGroup.alignChildren = 'fill';
	styleGroup.margins = 15;
	var styleDropdown = styleGroup.add('dropdownlist', undefined, styleNames);
	styleDropdown.selection = 0;

	var optionsGroup = dlg.add('panel', undefined, 'Options');
	optionsGroup.orientation = 'column';
	optionsGroup.alignChildren = 'left';
	optionsGroup.margins = 15;
	var clearCharStyleCheckbox = optionsGroup.add('checkbox', undefined, 'Clear character styles');
	clearCharStyleCheckbox.value = false;

	var btnGroup = dlg.add('group');
	btnGroup.alignment = 'right';
	var cancelBtn = btnGroup.add('button', undefined, 'Cancel', { name: 'cancel' });
	var okBtn = btnGroup.add('button', undefined, 'OK', { name: 'ok' });

	if (dlg.show() !== 1) {
		return null;
	}

	return {
		paragraphStyle: styles[styleDropdown.selection.index],
		clearCharacterStyle: clearCharStyleCheckbox.value
	};
}

function reapplyStyle(theParagraphStyle, clearCharacterStyle) {
	// Iterate the story's paragraphs directly rather than via findGrep('.+'):
	// GREP's "." doesn't match the paragraph return, so a found range would
	// exclude each paragraph's final "enter" and leave it unprocessed. A
	// Paragraph object's range includes its own trailing return character.
	// app.findGrepPreferences = NothingEnum.nothing;
	// app.findGrepPreferences.appliedParagraphStyle = theParagraphStyle;
	// app.findGrepPreferences.findWhat = '.+';
	// var found = mystory.findGrep();
	// app.findGrepPreferences = NothingEnum.nothing;


	// Speed: read all paragraphs and their styles in ONE call each.
	// (mystory.paragraphs[i] in a loop makes InDesign search the story again for
	// every access - very slow on long stories.)
	if (mystory.paragraphs.length === 0) return;
	var paras = mystory.paragraphs.everyItem().getElements();
	var styles = mystory.paragraphs.everyItem().appliedParagraphStyle;
	if (!(styles instanceof Array)) styles = [styles];
	var noCharacterStyle = myDocument.characterStyles.item(0);
	var targetId = theParagraphStyle.id;

	// Group consecutive paragraphs with the chosen style into blocks, so the
	// style is applied once per block instead of once per paragraph.
	var runs = [];
	var start = -1;
	for (var i = 0; i < paras.length; i++) {
		var match = styles[i].id === targetId;
		if (match && start < 0) start = i;
		if (!match && start >= 0) { runs.push([start, i - 1]); start = -1; }
	}
	if (start >= 0) runs.push([start, paras.length - 1]);

	var progress = createProgress('Reapply Style: ' + theParagraphStyle.name);
	progress.setMax(runs.length);
	try {
		for (var r = 0; r < runs.length; r++) {
			progress.step(r + 1, 'Block ' + (r + 1) + ' of ' + runs.length);
			var first = paras[runs[r][0]];
			var last = paras[runs[r][1]];
			// one Text object from the first character of the block to the last
			// (includes the last paragraph return)
			var text = (first === last) ? first :
				mystory.characters.itemByRange(first.characters[0], last.characters[-1]).texts[0];
			applyTo(text, theParagraphStyle, clearCharacterStyle, noCharacterStyle);
		}
	} finally {
		progress.close();
	}
}

function applyTo(text, theParagraphStyle, clearCharacterStyle, noCharacterStyle) {
		if (clearCharacterStyle) {
			// Clear the character style first, then reapply the paragraph style
			// with clearingOverrides = true so the leftover local formatting the
			// character style left behind is flushed and the text visually
			// matches the paragraph style's definition. applyParagraphStyle()
			// keeps the paragraph linked to the style the whole time — this is
			// not the same as "Break Link to Style", which would detach the
			// paragraph from the style and freeze the current look as manual
			// overrides instead.
			text.appliedCharacterStyle = noCharacterStyle;
			text.applyParagraphStyle(theParagraphStyle, true);
		} else {
			// clearingOverrides = false: reapply the style without touching
			// local character formatting, per this script's scope.
			text.applyParagraphStyle(theParagraphStyle, false);
		}
}

// Progress bar window (palette, stays open while the script works).
// The window is redrawn at most every 100 ms, so long stories don't slow down.
function createProgress(title) {
	var w = new Window('palette', title);
	w.orientation = 'column';
	w.alignChildren = 'fill';
	var label = w.add('statictext', undefined, '');
	label.preferredSize.width = 360;
	var bar = w.add('progressbar', undefined, 0, 1);
	bar.preferredSize = [360, 14];
	var timeLabel = w.add('statictext', undefined, '');
	timeLabel.preferredSize.width = 360;
	w.show();
	w.update();
	var startTime = new Date().getTime();
	var lastDraw = 0;
	return {
		setMax: function (max) {
			bar.maxvalue = Math.max(1, max);
			bar.value = 0;
			startTime = new Date().getTime();
			timeLabel.text = 'Estimating time...';
			w.update();
		},
		// value = number of the item about to be processed (value - 1 are done)
		step: function (value, text) {
			var now = new Date().getTime();
			if (now - lastDraw < 100 && value < bar.maxvalue) return;
			lastDraw = now;
			bar.value = value;
			label.text = text;
			var done = value - 1;
			var elapsed = now - startTime;
			if (done > 0 && elapsed > 0) {
				var remaining = elapsed / done * (bar.maxvalue - done);
				timeLabel.text = 'Elapsed ' + formatDuration(elapsed) +
					'  |  Remaining ~' + formatDuration(remaining) +
					'  |  Finish at ~' + formatClock(new Date(now + remaining));
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
	if (h > 0) return h + 'h ' + m + 'm';
	if (m > 0) return m + 'm ' + s + 's';
	return s + 's';
}

// Date -> "14:05:09"
function formatClock(d) {
	function pad(n) { return (n < 10 ? '0' : '') + n; }
	return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}
