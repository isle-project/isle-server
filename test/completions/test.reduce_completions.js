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
const { DEFAULT_TAG,
        makeCompletionPolicy,
        reduceCompletions } = require( './../../lib/helpers/completions.js' );


// FIXTURES //

const metric = {
    // We only need the rule for these tests.
    rule: [ 'average' ],
};

const byUsers = {
	'u1': {
		'homework': [
			[ 80, 1646160630592 ],
			[ 100, 1646160630592 ]
		],
		'exams': [
			[ 60, 1646160630592 ],
			[ 100, 1646160630592 ]
		]
	},
	'u2': {
		'homework': [
			[ 50, 1646160630592 ],
			[ 100, 1646160630592 ],
			[ 60, 1646160630592 ]
		],
		'exams': [
			[ 50, 1646160630592 ],
			[ 100, 1646160630592 ]
		]
	}
};

const byUsersWithoutTags = {
	'u1': {
		[DEFAULT_TAG]: [
			[ 80, 1646160630592 ],
			[ 100, 1646160630592 ],
			[ 60, 1646160630592 ],
			[ 100, 1646160630592 ]
		]
	},
	'u2': {
		[DEFAULT_TAG]: [
			[ 50, 1646160630592 ],
			[ 100, 1646160630592 ],
			[ 60, 1646160630592 ],
			[ 100, 1646160630592 ],
			[ 50, 1646160630592 ]
		]
	}
};

const byUsersWithSomeTags = {
	'u1': {
		'homework': [
			[ 100, 1646160630592 ],
			[ 100, 1646160630592 ]
		],
		'exams': [],
		[DEFAULT_TAG]: [
			[ 60, 1646160630592 ],
			[ 100, 1646160630592 ]
		]
	},
	'u2': {
		'homework': [
			[ 100, 1646160630592 ],
			[ 100, 1646160630592 ],
			[ 100, 1646160630592 ]
		],
		'exams': [],
		[DEFAULT_TAG]: [
			[ 50, 1646160630592 ],
			[ 100, 1646160630592 ]
		]
	}
};


// TESTS //

tape( 'main export is a function', t => {
	t.ok( true, __filename );
	t.ok( typeof reduceCompletions === 'function', 'main export is a function' );
	t.end();
});

tape( 'the function returns an object with user id keys and a completion value for each of them', t => {
	const expected = {
		'u1': { homework: 90, exams: 80 },
		'u2': { homework: 70, exams: 75 },
	};
	const actual = reduceCompletions( byUsers, metric );
	t.deepEqual( actual, expected, 'returns expected value' );
	t.end();
});

tape( 'the function returns an object with user id keys and a completion value for each of them (only with default tag)', t => {
	const expected = {
		'u1': { [DEFAULT_TAG]: 85 },
		'u2': { [DEFAULT_TAG]: 72 }
	};
	const actual = reduceCompletions( byUsersWithoutTags, metric );
	t.deepEqual( actual, expected, 'returns expected value' );
	t.end();
});

tape( 'the function returns an object with user id keys and a completion value if tags weights are supplied but some completions have the default tag', t => {
	const expected = {
		'u1': { homework: 100, exams: 0, [DEFAULT_TAG]: 80 },
		'u2': { homework: 100, exams: 0, [DEFAULT_TAG]: 75 },
	};
	const actual = reduceCompletions( byUsersWithSomeTags, metric );
	t.deepEqual( actual, expected, 'returns expected value' );
	t.end();
});
