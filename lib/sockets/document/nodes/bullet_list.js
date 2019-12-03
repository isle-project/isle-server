'use strict';

// MODULES //

const { bulletList } = require( 'prosemirror-schema-list' );


// MAIN //

const bulletListSpec = {
	...bulletList,
	content: 'list_item+',
	group: 'block'
};


// EXPORTS //

module.exports = bulletListSpec;
