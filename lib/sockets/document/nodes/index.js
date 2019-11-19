'use strict';

// MODULES //

const { nodes } = require( 'prosemirror-schema-basic' );
const { listItem, bulletList, orderedList } = require( 'prosemirror-schema-list' );
const { tableNodes } = require( 'prosemirror-tables' );
const paragraphSpec = require( './paragraph.js' );
const headingSpec = require( './heading.js' );
const plotSpec = require( './plot.js' );
const footnoteSpec = require( './footnote.js' );


// MAIN //

const listNodes = {
	ordered_list: {
		...orderedList,
		content: 'list_item+',
		group: 'block'
	},
	bullet_list: {
		...bulletList,
		content: 'list_item+',
		group: 'block'
	},
	list_item: {
		...listItem,
		content: 'paragraph block*',
		group: 'block'
	}
};


// EXPORTS //

module.exports = {
	plot: plotSpec,
	footnote: footnoteSpec,
	paragraph: paragraphSpec,
	...nodes,
	...listNodes,
	heading: headingSpec,
	...tableNodes({
		tableGroup: 'block',
		cellContent: 'block+'
	})
};
