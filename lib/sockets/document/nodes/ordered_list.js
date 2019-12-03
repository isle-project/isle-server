'use strict';

// MODULES //

const { orderedList } = require( 'prosemirror-schema-list' );


// MAIN //

const orderedListSpec = {
	...orderedList,
	content: 'list_item+',
	group: 'block'
};


// EXPORTS //

module.exports = orderedListSpec;
