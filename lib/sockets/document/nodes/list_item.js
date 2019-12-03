'use strict';

// MODULES //

const { listItem } = require( 'prosemirror-schema-list' );


// MAIN //

const listItemSpec = {
	...listItem,
	content: 'paragraph block*',
	group: 'block'
};


// EXPORTS //

module.exports = listItemSpec;
