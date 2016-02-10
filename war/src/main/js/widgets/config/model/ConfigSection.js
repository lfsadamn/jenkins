var jQD = require('../../../util/jquery-ext.js');
var util = require('./util.js');
var ConfigRowGrouping = require('./ConfigRowGrouping.js');

module.exports = ConfigSection;

/*
 * =======================================================================================
 * Configuration table section.
 * =======================================================================================
 */
function ConfigSection(headerRow, parentCMD) {
    this.headerRow = headerRow;
    this.parentCMD = parentCMD;
    this.title = headerRow.attr('title');
    this.id = util.toId(this.title);
    this.rowGroups = undefined;
    this.activator = undefined;
    this.subSections = [];
}

ConfigSection.prototype.isTopLevelSection = function() {
    return (this.parentCMD.getSection(this.id) !== undefined);
};

/**
 * Move another top-level section into this section i.e. adopt it.
 * <p>
 * This allows us to take a top level section (by id) and push it down
 * into another section e.g. pushing the "Advanced" section into the
 * "General" section.
 * @param sectionId The id of the top-level section to be adopted.
 */
ConfigSection.prototype.adoptSection = function(sectionId) {
    if (!this.isTopLevelSection()) {
        // Only top-level sections can adopt.
        return;
    }
    
    var child = this.parentCMD.getSection(sectionId);
    if (child && this.parentCMD.removeSection(child.id)) {
        this.subSections.push(child);
    }
};

/*
 * Get the section rows.
 */
ConfigSection.prototype.getRows = function() {
    var curTr = this.headerRow.next();
    var rows = [];
    var numNewRows = 0;

    rows.push(curTr);
    while(curTr.size() === 1 && !curTr.hasClass('section-header-row')) {
        rows.push(curTr);
        if (!curTr.hasClass(this.id)) {
            numNewRows++;
            curTr.addClass(this.id);
        }
        curTr = curTr.next();
    }
    
    if (numNewRows > 0) {
        // We have new rows in the section ... reset cached info.
        if (this.rowGroups !== undefined) {
            this.gatherRowGroups(rows);
        }
    }
    
    return rows;
};

/*
 * Set the element (jquery) that activates the section (on click).
 */
ConfigSection.prototype.setActivator = function(activator) {
    this.activator = activator;

    var section = this;
    section.activator.click(function() {
        section.parentCMD.showSection(section);
    });
};

ConfigSection.prototype.activate = function() {
    if (this.activator) {
        this.activator.click();
    } else {
        console.warn('No activator attached to config section object.');
    }
};

ConfigSection.prototype.markRowsAsActive = function() {
    var rows = this.getRows();
    for (var i = 0; i < rows.length; i++) {
        rows[i].addClass('active').show();
    }
    for (var ii = 0; ii < this.subSections.length; ii++) {
        this.subSections[ii].markRowsAsActive();
    }
    this.updateRowGroupVisibility();
};

ConfigSection.prototype.activeRowCount = function() {
    var activeRowCount = 0;
    var rows = this.getRows();
    for (var i = 0; i < rows.length; i++) {
        if (rows[i].hasClass('active')) {
            activeRowCount++;
        }
    }
    return activeRowCount;
};

ConfigSection.prototype.updateRowGroupVisibility = function() {
    if (this.rowGroups === undefined) {
        // Lazily gather row grouping information.
        this.gatherRowGroups();
    }
    for (var i = 0; i < this.rowGroups.length; i++) {
        var rowGroup = this.rowGroups[i];
        rowGroup.updateVisibility();
    }
    for (var ii = 0; ii < this.subSections.length; ii++) {
        this.subSections[ii].updateRowGroupVisibility();
    }
};

ConfigSection.prototype.gatherRowGroups = function(rows) {
    this.rowGroups = [];

    // Only tracking row-sets that are bounded by 'row-set-start' and 'row-set-end' (for now).
    // Also, only capturing the rows after the 'block-control' input (checkbox, radio etc)
    // and before the 'row-set-end'.
    // TODO: Find out how these actually work. It seems like they can be nested into a hierarchy :(
    // Also seems like you can have these "optional-block" thingies which are not wrapped
    // in 'row-set-start' etc. Grrrrrr :(

    if (rows === undefined) {
        rows = this.getRows();
    }
    if (rows.length > 0) {
        // Create a top level "fake" ConfigRowGrouping just to capture
        // the top level groupings. We copy the rowGroups info out
        // of this and use it in the top "this" ConfigSection instance. 
        var rowGroupContainer = new ConfigRowGrouping(rows[0], undefined);

        this.rowGroups = rowGroupContainer.rowGroups;

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];

            if (row.hasClass('row-group-start')) {
                var newRowGroup = new ConfigRowGrouping(row, rowGroupContainer);
                rowGroupContainer.rowGroups.push(newRowGroup);
                rowGroupContainer = newRowGroup;
                newRowGroup.findToggleWidget(row);
            } else {
                if (row.hasClass('row-group-end')) {
                    rowGroupContainer.endRow = row;
                    rowGroupContainer = rowGroupContainer.parentRowGroupContainer; // pop back off the "stack"
                } else if (rowGroupContainer.toggleWidget === undefined) {
                    rowGroupContainer.findToggleWidget(row);
                } else {
                    // we have the toggleWidget, which means that this row is
                    // one of the rows after that row and is one of the rows that's
                    // subject to being made visible/hidden when the input is
                    // checked or unchecked.
                    rowGroupContainer.rows.push(row);
                }
            }
        }
    }
};

ConfigSection.prototype.getRowGroupLabels = function() {
    var labels = [];
    for (var i = 0; i < this.rowGroups.length; i++) {
        var rowGroup = this.rowGroups[i];
        labels.push(rowGroup.getLabels());
    }
    return labels;
};

ConfigSection.prototype.highlightText = function(text) {
    var $ = jQD.getJQuery();
    var selector = ":containsci('" + text + "')";
    var rows = this.getRows();
    
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];

        /*jshint loopfunc: true */
        $('span.highlight-split', row).each(function() { // jshint ignore:line
            var highlightSplit = $(this);
            highlightSplit.before(highlightSplit.text());
            highlightSplit.remove();
        });

        if (text !== '') {
            var regex = new RegExp('(' + text + ')',"gi");

            /*jshint loopfunc: true */
            $(selector, row).find(':not(:input)').each(function() {
                var $this = $(this);
                $this.contents().each(function () {
                    // We specifically only mess with text nodes
                    if (this.nodeType === 3) {
                        var highlightedMarkup = this.wholeText.replace(regex, '<span class="highlight">$1</span>');
                        $(this).replaceWith('<span class="highlight-split">' + highlightedMarkup + '</span>');
                    }
                });
            });
        }
    }
};
