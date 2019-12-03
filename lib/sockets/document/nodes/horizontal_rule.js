'use strict';

// MAIN //

const horizontalRuleSpec = {
	group: 'block',
	parseDOM: [
		{ tag: 'hr' }
	],
	toDOM() {
		return [ 'hr' ];
	}
};


// EXPORTS //

module.exports = horizontalRuleSpec;
