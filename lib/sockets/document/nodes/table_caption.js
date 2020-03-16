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

const ParagraphNodeSpec = require( './paragraph.js' );
const { getParagraphNodeAttrs, toParagraphDOM } = require( './paragraph.js' );


// FUNCTIONS //

function toDOM( node ) {
	const dom = toParagraphDOM( node );
	dom[ 0 ] = 'legend';
	dom[ 1 ].class = 'table-caption';
	return dom;
}

function getAttrs( dom ) {
	const attrs = getParagraphNodeAttrs( dom );
	return attrs;
}


// MAIN //

const tableCaption = {
	...ParagraphNodeSpec,
	attrs: {
		...ParagraphNodeSpec.attrs
	},
	content: 'inline*',
	group: 'block',
	defining: true,
	toDOM,
	parseDOM: [
		{ tag: 'legend', getAttrs }
	]
};


// EXPORTS //

module.exports = tableCaption;
