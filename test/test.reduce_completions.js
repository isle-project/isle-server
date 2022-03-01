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
const { reduceCompletions } = require( './../lib/helpers/completions.js' );


// FIXTURES //

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
const metric = {
	rule: [ 'average' ],
	tagWeights: {
		'homework': 1,
		'exams': 3
	}
};


// TESTS //

tape( 'main export is a function', t => {
	t.ok( typeof reduceCompletions === 'function', 'main export is a function' );
	t.end();
});

tape( 'the function returns an object with user id keys and a completion value for each of them', t => {
	const expected = {
		'u1': 82.5,
		'u2': 50
	};
	const actual = reduceCompletions( byUsers, metric );
	t.deepEqual( actual, expected, 'returns expected value' );
	t.end();
});
