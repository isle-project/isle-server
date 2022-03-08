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

/* eslint-disable guard-for-in */

'use strict';

// MODULES //

const Program = require('./../models/program');
const Namespace = require( './../models/namespace' );
const Lesson = require( './../models/lesson' );


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

const completionRules = {
	'average': function average( arr ) {
		console.log( arr );
		if ( arr.length === 0 ) {
			return 0;
		}
		return arr.reduce( ( acc, x ) => acc + x[ 0 ], 0 ) / arr.length;
	},
	'averageDropLowest': function averageDropLowest( arr ) {
		if ( arr.length === 0 ) {
			return 0;
		}
		if ( arr.length === 1 ) {
			return arr[ 0 ][ 0 ];
		}
		const [ sum, min ] = arr.reduce( ( acc, x ) => {
			acc[ 0 ] = acc[ 0 ] + x[ 0 ];
			acc[ 1 ] = ( x[ 0 ] < acc[ 1 ] ) ? x[ 0 ] : acc[ 1 ];
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

const DEFAULT_TAG = 'default_tag' || Symbol( 'default_tag' );

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

function groupAndFilterCompletions( nodeCompletions, metric ) {
	const byUsers = {};
	const tagSet = new Set( metric.tagWeights ? Object.keys( metric.tagWeights ) : [] );
	for ( let i = 0; i < nodeCompletions.length; i++ ) {
		const userCompletions = nodeCompletions[ i ];
		const keys = Object.keys( userCompletions );
		for ( let j = 0; j < keys.length; j++ ) {
			const userId = keys[ j ];
			const userCompletion = userCompletions[ userId ];
			const tag = userCompletion.tag || DEFAULT_TAG;
			tagSet.add( tag );
			if ( !byUsers[ userId ] ) {
				byUsers[ userId ] = {};
			}
			// Check if the time filter is passed:
			if ( userCompletion.time < metric.timeFilter[ 0 ] || userCompletion.time > metric.timeFilter[ 1 ] ) {
				continue;
			}
			// Check if the tag exists in the byUsers object:
			if ( !byUsers[ userId ][ tag ] ) {
				byUsers[ userId ][ tag ] = [
					[ userCompletion.value, userCompletion.time ]
				];
			} else {
				byUsers[ userId ][ tag ].push( [ userCompletion.value, userCompletion.time ] );
			}
		}
	}
	for ( let user in byUsers ) {
		// Iterate over all tags in the set and add the missing ones:
		for ( let tag of tagSet ) {
			if ( byUsers[ user ][ tag ] === void 0 ) {
				byUsers[ user ][ tag ] = [];
			}
		}
	}
	return byUsers;
}

function reduceCompletions( byUsers, metric ) {
	const ruleFn = completionRules[ metric.rule[ 0 ] ];
	const completions = {};
	const hasTagWeights = !!metric.tagWeights;
	if ( hasTagWeights) {
		for ( const userId in byUsers ) {
			let total = 0;
			let weightTotal = 0;
			for ( let tag in byUsers[ userId ] ) {
				const value = ruleFn( byUsers[ userId ][ tag ], ...metric.rule.slice( 1 ) );
				total += value * ( metric?.tagWeights?.[ tag ] ?? 0 );
				weightTotal += ( metric?.tagWeights?.[ tag ] ?? 0 );
			}
			completions[ userId ] = ( weightTotal > 0 ) ? total / weightTotal : 0;
		}
	}
	else {
		for ( const userId in byUsers ) {
			let total = 0;
			let weightTotal = 0;
			for ( let tag in byUsers[ userId ] ) {
				const value = ruleFn( byUsers[ userId ][ tag ], ...metric.rule.slice( 1 ) );
				total += value;
				weightTotal += 1;
			}
			completions[ userId ] = ( weightTotal > 0 ) ? total / weightTotal : 0;
		}
	}
	return completions;
}

// gatherCompletions( programId, metric { level: 'program' }, users, getBranchData );

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
	const byUsers = groupAndFilterCompletions( nodeCompletions, metric );
	return reduceCompletions( byUsers, metric );
}


module.exports = {
	gatherCompletions,
	levelMapping,
	reduceCompletions,
	groupAndFilterCompletions,
	DEFAULT_TAG
};
