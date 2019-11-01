'use strict';

// MAIN //

const underline = {
	parseDOM: [
		{ tag: 'u' },
		{ style: 'text-decoration:underline' }
	],
	toDOM: () => [
		'span',
		{
			style: 'text-decoration:underline'
		}
	]
};


// EXPORTS //

module.exports = underline;
