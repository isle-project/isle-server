'use strict';

// MAIN //

const subscript = {
	excludes: 'superscript',
	parseDOM: [
		{ tag: 'sub' },
		{ style: 'vertical-align=sub' }
	],
	toDOM: () => ['sub']
};


// EXPORTS //

module.exports = subscript;
