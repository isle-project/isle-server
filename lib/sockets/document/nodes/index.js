/**
* Copyright (C) 2016-present The ISLE Authors
*
* The isle-server program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

'use strict';

// MODULES //

const { tableNodes } = require( 'prosemirror-tables' );
const paragraphSpec = require( './paragraph.js' );
const headingSpec = require( './heading.js' );
const footnoteSpec = require( './footnote.js' );
const figureCaptionSpec = require( './figure_caption.js' );
const tableCaptionSpec = require( './table_caption.js' );
const plotContainerSpec = require( './plot_container.js' );
const plotSpec = require( './plot.js' );
const docSpec = require( './doc.js' );
const blockquoteSpec = require( './blockquote.js' );
const horizontalRuleSpec = require( './horizontal_rule.js' );
const codeBlockSpec = require( './code_block.js' );
const textSpec = require( './text.js' );
const imageSpec = require( './image.js' );
const hardBreakSpec = require( './hard_break.js' );
const orderedListSpec = require( './ordered_list.js' );
const bulletListSpec = require( './bullet_list.js' );
const listItemSpec = require( './list_item.js' );


// EXPORTS //

module.exports = {
	doc: docSpec,
	plot: plotSpec,
	plotContainer: plotContainerSpec,
	footnote: footnoteSpec,
	paragraph: paragraphSpec,
	ordered_list: orderedListSpec,
	bullet_list: bulletListSpec,
	list_item: listItemSpec,
	blockquote: blockquoteSpec,
	horizontal_rule: horizontalRuleSpec,
	heading: headingSpec,
	code_block: codeBlockSpec,
	text: textSpec,
	image: imageSpec,
	hard_break: hardBreakSpec,
	figureCaption: figureCaptionSpec,
	tableCaption: tableCaptionSpec,
	...tableNodes({
		tableGroup: 'block',
		cellContent: 'block+'
	})
};
