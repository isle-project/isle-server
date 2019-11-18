'use strict';

// MODULES //

const { nodes } = require( 'prosemirror-schema-basic' );
const { listItem, bulletList, orderedList } = require( 'prosemirror-schema-list' );
const { tableNodes } = require( 'prosemirror-tables' );
const paragraphSpec = require( './paragraph.js' );
const headingSpec = require( './heading.js' );
const plotSpec = require( './plot.js' );


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

const footnoteSpec = {
	group: 'inline',
	content: 'inline*',
	inline: true,
	atom: true,
	toDOM: () => ['footnote', 0],
	parseDOM: [{
		tag: 'footnote'
	}]
};


// EXPORTS //

module.exports = {
	plot: plotSpec,
	footnote: footnoteSpec,
	...nodes,
	...listNodes,
	paragraph: paragraphSpec,
	heading: headingSpec,
	...tableNodes({
		tableGroup: 'block',
		cellContent: 'block+'
	})
};
