/**
* Copyright (C) 2016-present The ISLE Authors
*
* The isle-server program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

'use strict';

// MODULES //

const tape = require( 'tape' );
const { groupAndFilterCompletions, DEFAULT_TAG } = require( './../../lib/helpers/completions.js' );


// FIXTURES //

const nodeCompletions = [
	{
		'u1': {
			'value': 80,
			'time': 1646160630592,
			'tag': 'homework'
		},
		'u2': {
			'value': 100,
			'time': 1646160630592,
			'tag': 'homework'
		},
		'u3': {
			'value': 60,
			'time': 1646160630592,
			'tag': 'exams'
		},
		'u4': {
			'value': 100,
			'time': 1646160630592,
			'tag': 'exams'
		}
	},
	{
		'u1': {
			'value': 60,
			'time': 1646160630592,
			'tag': 'exams'
		},
		'u2': {
			'value': 100,
			'time': 1646160630592 + 300000,
			'tag': 'exams'
		},
		'u5': {
			'value': 50,
			'time': 1646160630592,
			'tag': 'homework'
		}
	},
	{
		'u1': {
			'value': 50,
			'time': 1646160630592,
			'tag': 'lab'
		},
		'u4': {
			'value': 100,
			'time': 1646160630592,
			'tag': 'lab'
		}
	}
];

const nodeCompletionsWithoutTags = [
	{
		'u1': {
			'value': 80,
			'time': 1646160630592
		},
		'u2': {
			'value': 100,
			'time': 1646160630592
		},
		'u3': {
			'value': 60,
			'time': 1646160630592
		},
		'u4': {
			'value': 100,
			'time': 1646160630592
		}
	},
	{
		'u1': {
			'value': 60,
			'time': 1646160630592
		},
		'u2': {
			'value': 100,
			'time': 1646160630592 + 300000
		},
		'u5': {
			'value': 50,
			'time': 1646160630592
		}
	},
	{
		'u1': {
			'value': 50,
			'time': 1646160630592
		},
		'u4': {
			'value': 100,
			'time': 1646160630592
		}
	}
];

const nodeCompletionsWithSomeTagsMissing = [
	{
		'u1': {
			'value': 80,
			'time': 1646160630592
		},
		'u2': {
			'value': 100,
			'time': 1646160630592
		},
		'u3': {
			'value': 60,
			'time': 1646160630592,
			'tag': 'exams'
		},
		'u4': {
			'value': 100,
			'time': 1646160630592,
			'tag': 'exams'
		}
	},
	{
		'u1': {
			'value': 60,
			'time': 1646160630592,
			'tag': 'exams'
		},
		'u2': {
			'value': 100,
			'time': 1646160630592 + 300000,
			'tag': 'exams'
		},
		'u5': {
			'value': 50,
			'time': 1646160630592
		}
	},
	{
		'u1': {
			'value': 50,
			'time': 1646160630592,
			'tag': 'lab'
		},
		'u4': {
			'value': 100,
			'time': 1646160630592,
			'tag': 'lab'
		}
	}
];

const metric = {
	rule: [ 'average' ],
	timeFilter: [ 1646160630592, 1646160630592 + 100000 ]
};

const metricWithoutTimeFilter = {
	rule: [ 'average' ],
	timeFilter: [ 0, 10000 * 3.1536e+10 ]
};

const metricWithTagWeights = {
	rule: [ 'average' ],
	tagWeights: {
		'homework': 1,
		'exams': 3
	},
	timeFilter: [ 0, 10000 * 3.1536e+10 ]
};


// TESTS //

tape( 'main export is a function', t => {
	t.ok( typeof groupAndFilterCompletions === 'function', 'main export is a function' );
	t.end();
});

tape( 'the function returns an object with user id keys mapping to an object of tag names to two-element arrays of completion values and times (with time filter)', t => {
	const expected = {
		u1: {
			homework: [ [ 80, 1646160630592 ] ],
			exams: [ [ 60, 1646160630592 ] ],
			lab: [ [ 50, 1646160630592 ] ]
		},
		u2: {
			homework: [ [ 100, 1646160630592 ] ],
			exams: [],
			lab: []
		},
		u3: {
			homework: [],
			exams: [ [ 60, 1646160630592 ] ],
			lab: []
		},
		u4: {
			homework: [],
			exams: [ [ 100, 1646160630592 ] ],
			lab: [ [ 100, 1646160630592 ] ]
		},
		u5: {
			homework: [ [ 50, 1646160630592 ] ],
			exams: [],
			lab: []
		}
	};
	const actual = groupAndFilterCompletions( nodeCompletions, metric );
	t.deepEqual( actual, expected, 'returns expected value' );
	t.end();
});

tape( 'the function returns an object with user id keys mapping to an object of tag names to two-element arrays of completion values and times (without time filter)', t => {
	const expected = {
		u1: {
			homework: [ [ 80, 1646160630592 ] ],
			exams: [ [ 60, 1646160630592 ] ],
			lab: [ [ 50, 1646160630592 ] ]
		},
		u2: {
			homework: [ [ 100, 1646160630592 ] ],
			exams: [ [ 100, 1646160630592 + 300000 ] ],
			lab: []
		},
		u3: {
			homework: [],
			exams: [ [ 60, 1646160630592 ] ],
			lab: []
		},
		u4: {
			homework: [],
			exams: [ [ 100, 1646160630592 ] ],
			lab: [ [ 100, 1646160630592 ] ]
		},
		u5: {
			homework: [ [ 50, 1646160630592 ] ],
			exams: [],
			lab: []
		}
	};
	const actual = groupAndFilterCompletions( nodeCompletions, metricWithoutTimeFilter );
	t.deepEqual( actual, expected, 'returns expected value' );
	t.end();
});

tape( 'the function returns an object with user id keys mapping to an object with the default tag mapping to two-element arrays of completion values and times (with time filter)', t => {
	const expected = {
		u1: {
			[DEFAULT_TAG]: [ [ 80, 1646160630592 ], [ 60, 1646160630592 ], [ 50, 1646160630592 ] ]
		},
		u2: {
			[DEFAULT_TAG]: [ [ 100, 1646160630592 ] ]
		},
		u3: {
			[DEFAULT_TAG]: [ [ 60, 1646160630592 ] ]
		},
		u4: {
			[DEFAULT_TAG]: [ [ 100, 1646160630592 ], [ 100, 1646160630592 ] ]
		},
		u5: {
			[DEFAULT_TAG]: [ [ 50, 1646160630592 ] ]
		}
	};
	const actual = groupAndFilterCompletions( nodeCompletionsWithoutTags, metric );
	t.deepEqual( actual, expected, 'returns expected value' );
	t.end();
});

tape( 'the function returns an object with user id keys mapping to an object with the default tag mapping to two-element arrays of completion values and times (without time filter)', t => {
	const expected = {
		u1: {
			[DEFAULT_TAG]: [ [ 80, 1646160630592 ], [ 60, 1646160630592 ], [ 50, 1646160630592 ] ]
		},
		u2: {
			[DEFAULT_TAG]: [ [ 100, 1646160630592 ], [ 100, 1646160630592 + 300000 ] ]
		},
		u3: {
			[DEFAULT_TAG]: [ [ 60, 1646160630592 ] ]
		},
		u4: {
			[DEFAULT_TAG]: [ [ 100, 1646160630592 ], [ 100, 1646160630592 ] ]
		},
		u5: {
			[DEFAULT_TAG]: [ [ 50, 1646160630592 ] ]
		}
	};
	const actual = groupAndFilterCompletions( nodeCompletionsWithoutTags, metricWithoutTimeFilter );
	t.deepEqual( actual, expected, 'returns expected value' );
	t.end();
});

tape( 'the function returns an object with user id keys mapping to an object with tag names mapping to two-element arrays of completion values and times (with time filter and some tags missing)', t => {
	const expected = {
		u1: {
			[DEFAULT_TAG]: [ [ 80, 1646160630592 ] ],
			exams: [ [ 60, 1646160630592 ] ],
			lab: [ [ 50, 1646160630592 ] ]
		},
		u2: {
			[DEFAULT_TAG]: [ [ 100, 1646160630592 ] ],
			exams: [],
			lab: []
		},
		u3: {
			[DEFAULT_TAG]: [],
			exams: [ [ 60, 1646160630592 ] ],
			lab: []
		},
		u4: {
			[DEFAULT_TAG]: [],
			exams: [ [ 100, 1646160630592 ] ],
			lab: [ [ 100, 1646160630592 ] ]
		},
		u5: {
			[DEFAULT_TAG]: [ [ 50, 1646160630592 ] ],
			exams: [],
			lab: []
		}
	};
	const actual = groupAndFilterCompletions( nodeCompletionsWithSomeTagsMissing, metric );
	t.deepEqual( actual, expected, 'returns expected value' );
	t.end();
});

tape( 'the function returns an object with user id keys mapping to an object with tag names mapping to two-element arrays of completion values and times (with tag weights but some tags missing)', t => {
	const expected = {
		u1: {
			[DEFAULT_TAG]: [ [ 80, 1646160630592 ] ],
			exams: [ [ 60, 1646160630592 ] ],
			lab: [ [ 50, 1646160630592 ] ],
			homework: []
		},
		u2: {
			[DEFAULT_TAG]: [ [ 100, 1646160630592 ] ],
			exams: [ [ 100, 1646160630592 + 300000 ] ],
			lab: [],
			homework: []
		},
		u3: {
			[DEFAULT_TAG]: [],
			exams: [ [ 60, 1646160630592 ] ],
			lab: [],
			homework: []
		},
		u4: {
			[DEFAULT_TAG]: [],
			exams: [ [ 100, 1646160630592 ] ],
			lab: [ [ 100, 1646160630592 ] ],
			homework: []
		},
		u5: {
			[DEFAULT_TAG]: [ [ 50, 1646160630592 ] ],
			exams: [],
			lab: [],
			homework: []
		}
	};
	const actual = groupAndFilterCompletions( nodeCompletionsWithSomeTagsMissing, metricWithTagWeights );
	t.deepEqual( actual, expected, 'returns expected value' );
	t.end();
});
