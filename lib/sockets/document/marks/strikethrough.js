'use strict';

// MAIN //

const strikethrough = {
	parseDOM: [
		{ tag: 'strike' },
		{ style: 'text-decoration:line-through' },
		{ style: 'text-decoration-line:line-through' }
	],
	toDOM: () => ['strike']
};


// EXPORTS //

module.exports = strikethrough;
