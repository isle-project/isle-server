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
