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

const mongoose = require( 'mongoose' );
const groupBy = require( '@stdlib/utils/group-by' );
const Program = require('./program');
const Namespace = require( './namespace' );
const Lesson = require( './lesson' );


// FUNCTIONS //

/**
 * Returns the previous level in the hierarchy.
 *
 * @private
 * @param {string} level - input level
 * @returns {string} predecessor level
 */
 function predecessor( level ) {
	switch ( level ) {
		case 'lesson':
			return 'component';
		case 'namespace':
			return 'lesson';
		case 'program':
			return 'namespace';
		case 'global':
			return 'program';
		case 'component':
		default:
			return null;
	}
}


// VARIABLES //

const completionRules = {
	'average': function average( arr ) {
		if ( arr.length === 0 ) {
			return 0;
		}
		return arr.reduce( ( acc, x ) => acc + x.value, 0 ) / arr.length;
	},
	'averageDropLowest': function averageDropLowest( arr ) {
		if ( arr.length === 0 ) {
			return 0;
		}
		if ( arr.length === 1 ) {
			return arr[ 0 ].value;
		}
		const [ sum, min ] = arr.reduce( ( acc, x ) => {
			acc[ 0 ] = acc[ 0 ] + x.value;
			acc[ 1 ] = ( x.value < acc[ 1 ] ) ? x.value : acc[ 1 ];
			return acc;
		}, [ 0, Infinity ] );
		return ( sum - min ) / ( arr.length - 1 );
	}
};

const levelMapping = {
	program: {
		schema: Program,
		field: 'namespaces'
	},
	namespace: {
		schema: Namespace,
		field: 'lessons'
	},
	lesson: {
		schema: Lesson,
		target: 'components' // TODO: use components schema?
	}
};

async function relevantNodes( id, level, coverage ) {
	const mapping = levelMapping[ level ];
	if ( mapping.field ) {
		// Query for the relevant nodes
		const parent = await mapping.schema.findOneById( id );
		const children = parent[ mapping.field ];
		if ( coverage[ 0 ] === 'all' ) {
			return children;
		}
		const out = [];
		if ( coverage[ 0 ] === 'include' ) {
			const childrenSet = new Set( children );
			for ( let i = 1; i < coverage.length; i++ ) {
				if ( childrenSet.has( coverage[ i ] ) ) {
					out.push( coverage[ i ] );
				}
			}
		}
		if ( coverage[ 0 ] === 'exclude' ) {
			const coverageSet = new Set( coverage.slice( 1 ) );
			for ( let i = 0; i < children.length; i++ ) {
				if ( !coverageSet.has( children[ i ] ) ) {
					out.push( children[ i ] );
				}
			}
		}
		return out;
	}
	// TODO: handle component level
}


// MAIN //

const Schema = mongoose.Schema;

const CompletionMetricSchema = new Schema({
	/**
	* Metric name.
	*/
	name: {
		'type': String,
		'required': true
	},

	/**
	* Level of the metric.
	*/
	level: {
		'type': String,
		'enum': [ 'program', 'namespace', 'lesson', 'component' ],
		'required': true
	},

	/**
	* An array of the form `[ 'all' ]`, `[ 'include`, ... ]`, or `[ 'exclude', ... ]` where `...` is a list of IDs (components, lessons, courses)
	*/
	coverage: {
		type: Array,
		default: [ 'all' ]
	},

	/**
	* A two-element array with a start and end date. Default being the time in milliseconds since the epoch until the year 10000.
	*/
	timeFilter: {
		type: Array,
		default: [ 0, 10000 * 3.1536e+10 ]
	},

	/**
	* An array of a rule name and zero ore more rule parameters.
	*/
	rule: {
		type: Array
	},

	/**
	* A mapping from tags to non-negative numbers.
	*/
	tagWeights: {
		type: Object,
		default: null
	},

	/**
	* Which metric on the lower level to use.
	*/
	ref: {
		type: String,
		default: null
	}
}, { timestamps: true });

const CompletionMetric = mongoose.model( 'CompletionMetric', CompletionMetricSchema );

CompletionMetric.virtual( 'value' )
	.get( function getValue() {
		/**
		 * Calculation steps:
		 *
		 * -   Get the value of the appropriate `ref` of all the ones in the coverage list.
		 * -   Filter out the ones that are not in the time filter.
		 * -   Group the values by the tags
		 * -   Calculate the rule for each group
		 * -   Create a weighted average across the groups using the tag weights
		 */

	});

async function getBranchData( ref, nodes, lowerLevel, users ) {
	const { schema, field } = levelMapping[ lowerLevel ]; // TODO: handle component level
	if ( lowerLevel === 'component' ) {
		return getLeafData( ref, nodes, null, users );
	}
	// Case: lower level is a namespace or lesson
	let completions = await schema.find( { _id: { $in: nodes } }, { completion: 1 } );

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

function getLeafData( ref, nodes, lowerLevel, users ) {

}

gatherCompletions( programId, metric { level: 'program' }, users, getBranchData );

function gatherCompletions( id, metric, users, getData ) {
	// Case: course level
	const nodes = relevantNodes( id, metric.level, metric.coverage );
	let nodeCompletions = getData( metric.ref, nodes, predecessor( metric.level ), users );
	/*
		[
			{
				[userId]: {
					value: '...'
					time: '...',
					tag: '...'
				}
				...
			},
			...
		]
	*/
	nodeCompletions = nodeCompletions.filter( lessonCompletion => {
		return lessonCompletion.time >= metric.timeFilter[ 0 ] && lessonCompletion.time <= metric.timeFilter[ 1 ];
	});

	// const byUsers = groupBy( nodeCompletions, x => x.userId );
	const completions = {};

	/* eslint-disable guard-for-in */
	const ruleFn = completionRules[ metric.rule[ 0 ] ];

	// TODO: iterate over nodeCompletions instead of user ids
	for ( const userId in byUsers ) {
		const groups = groupBy( byUsers[ userId ], x => x.tag );
		let total = 0;
		let weightTotal = 0;
		for ( let tag in groups ) {
			const value = ruleFn.apply( null, [ groups[ tag ], ...metric.rule.slice( 1 ) ] );
			total += value * ( metric.tagWeights[ tag ] ?? 1 );
			weightTotal += ( metric.tagWeights[ tag ] ?? 1 );
		}
		completions[ userId ] = ( weightTotal > 0 ) ? total / weightTotal : 0;
	}
	return completions;
}


// EXPORTS //

module.exports = CompletionMetric;
