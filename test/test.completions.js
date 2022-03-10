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
const { gatherCompletions, getLeafData } = require( './../lib/helpers/completions.js' );


const leafData = {
	'interacted': [
		{
			'u1': { value: 0, time: 1646160630592, tag: 'homework' },
			'u2': { value: 100, time: 1646160630592, tag: 'homework' },
			'u3': { value: 100, time: 1646160630592, tag: 'homework' }
		}
	],
	'completed': [
		{
			'u1': { value: 80, time: 1646160630592, tag: 'homework' },
			'u2': { value: 50, time: 1646160630592, tag: 'homework' },
			'u3': { value: 100, time: 1646160630592, tag: 'homework' }
		}
	],
	'correct': [
		{
			'u1': { value: 60, time: 1646160630592, tag: 'homework' },
			'u2': { value: 50, time: 1646160630592, tag: 'homework' },
			'u3': { value: 80, time: 1646160630592, tag: 'homework' }
		}
	]
};

const completionData = {
	'program': [
		{
			name: 'exam-average',
			level: 'program',
			coverage: [ 'all' ],
			ref: 'exams',
			rule: [ 'average' ]
		}
	],
	'namespace': [
		{
			name: 'exams',
			level: 'namespace',
			coverage: [ 'include', 'lesson1', 'lesson2' ],
			ref: 'lesson-score',
			rule: [ 'average' ]
		}
	],
	'lesson': [
			{
				name: 'lesson-score',
				level: 'lesson',
				coverage: [ 'all' ],
				ref: 'score',
				rule: [ 'average' ]
			}
		],
	'component': [
			{
				name: 'score',
				level: 'component',
				coverage: [ 'all' ],
				timeFilter: [ 0, 10000 * 3.1536e+10 ],
				rule: [ 'average' ]
			}
	]
};

function schemaFind( nodes, level ) {
	nodes.map( x => {
		return { _id: x, completion: completionData[ level ] };
	});
}


// FUNCTIONS //

function getBranchData( ref, nodes, lowerLevel, users ) {
	// const { schema, field } = levelMapping[ lowerLevel ]; // TODO: handle component level
	if ( lowerLevel === 'component' ) {
		return leafData[ ref ];
	}
	// Case: lower level is a namespace or lesson
	// let completions = await schema.find( { _id: { $in: nodes } }, { completion: 1 } );
	let completions = schemaFind( nodes, lowerLevel );

	if ( ref ) {
		completions = completions.map( x => {
			return {
				id: x._id,
				completion: x.completion.filter( x => x.name === ref )[ 0 ] // TODO: no ref defined
			};
		});
	} else {
		completions = completions.map( x => {
			return {
				id: x._id,
				completion: x.completion[ 0 ]
			};
		});
	}
	return nodes.map( node => gatherCompletions( node, completions[ node ], users, getBranchData ) );
}


// TESTS //

tape( 'main export is a function', ( t ) => {
	t.ok( typeof gatherCompletions === 'function', 'main export is a function' );
	t.end();
});
