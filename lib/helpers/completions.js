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

const isNull = require( '@stdlib/assert/is-null' );
const mongoose = require( 'mongoose' );
const Program = require('./../models/program');
const Namespace = require( './../models/namespace' );
const Lesson = require( './../models/lesson' );
const Completion = require( './../models/completion' );


// VARIABLES //

const ObjectId = mongoose.Types.ObjectId;


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

function average( arr ) {
	if ( arr.length === 0 ) {
		return 0;
	}
	return arr.reduce( ( acc, x ) => acc + x[ 0 ], 0 ) / arr.length;
}

function averageDropLowest( arr ) {
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

/**
 * Object different completion rule functions which all take an array of pairs (value and time) and return a single number.
 *
 * ## Notes
 *
 * -   If the array is empty, the functions have to return `0`.
 * -   The functions can have additional parameters aside from the array of pairs which are passed down from the metric
 */
const completionRules = {
	'average': average,
	'avg': average,
	'averageDropLowest': averageDropLowest,
	'avgDropLowest': averageDropLowest
};

/**
* Mapping from a given node level to the corresponding schema and the field in the schema that contains the children.
*/
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
		schema: Lesson
	},
	component: {
		schema: Completion
	}
};

const DEFAULT_TAG = 'default_tag' || Symbol( 'default_tag' );

/**
 * Returns an array of node id's for those that match the coverage criteria and the level.
 *
 * @private
 * @param {string} id - id of the node
 * @param {string} level - the level of the node given by id
 * @param {Array<string>} coverage - an array with the first element is the type (`all`,`include`, or `exclude`) and any remaining elements are id strings
 * @param {Array<string>} users - an array of user ids (if not provided, all users are considered)
 * @returns {Array<string>} array of relevant node IDs
 */
async function relevantNodes( id, level, coverage, users ) {
	const mapping = levelMapping[ level ];
	let children;
	if ( mapping.field ) {
		// Query for the relevant nodes
		const parent = await mapping.schema.findById( id );
		children = parent[ mapping.field ];
		children = children.map( x => x.toString() );
	} else {
		// At the lesson level, we find all distinct components in the lesson:
		const query = { lesson: id };
		if ( users ) {
			query.user = { $in: users };
		}
		children = await Completion
			.find( query, { component: 1 } )
			.distinct( 'component' );
	}
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
	if ( !mapping.field ) {
		Object.defineProperty( out, '_lessonId', {
			value: id,
			writable: false,
			enumerable: false
		});
	}
	return out;
}


/**
 * Returns an array of objects, with each each object mapping user ids to completion data.
 *
 * @private
 * @param {string} ref - name of completion metric
 * @param {Array<string>} nodes - array of node ids
 * @param {string} level - the level of the nodes
 * @param {Array<string>} users - an array of user ids
 * @returns {Promise} resolves to an array of objects mapping user ids to completion data
 */
async function getBranchData( ref, nodes, level, users ) {
	const { schema } = levelMapping[ level ]; // TODO: handle component level
	if ( level === 'component' ) {
		// Return promise with the completion data for all the components in the lesson:
		return getLeafData( ref, nodes, null, users );
	}
	// Case: lower level is a namespace or lesson
	nodes = nodes.map( x => new ObjectId( x ) );
	let completions = await schema.find( {
		_id: {
			$in: nodes
		}
	}, { completion: 1 } );

	if ( completions.length === 0 ) {
		return [];
	}
	console.log( 'nodes', nodes );
	console.log( 'ref', ref );
	console.log( 'level', level );
	console.log( 'completions', completions );
	if ( ref ) {
		completions = completions.reduce( ( acc, x ) => {
			if ( isNull( acc ) ) {
				return acc;
			}
			const chosenMetric = x.completion.filter( x => x.name === ref );
			if ( chosenMetric.length === 0 ) {
				return null;
			}
			acc[ x._id ] = chosenMetric[ 0 ];
			return acc;
		}, {} );
		if ( isNull( completions ) ) {
			throw new Error( `No completion data found for the metric with name ${ ref } at level ${ level }.` );
		}
	} else {
		completions.reduce( ( acc, x ) => {
			if ( isNull( acc ) ) {
				return acc;
			}
			if ( x.completion.length === 0 ) {
				return null;
			}
			acc[ x._id ] = x.completion[ 0 ];
			return acc;
		}, {} );
		if ( isNull( completions ) ) {
			throw new Error( `No completion data found at level ${ level }.` );
		}
	}
	console.log( 'completions 2', completions );
	return Promise.all( nodes.map( node => gatherCompletions( node, completions[ node ], users ) ) );
}

/**
* Returns an array of objects, with each each object mapping user ids to completion data.
*
* @private
* @param {string} ref - name of completion metric at the component level
* @param {Array<string>} nodes - array of component ids (with non-enumerable `_lessonId` property showing lesson the components belongs to)
* @param {null} level - level of the nodes (not used for component level)
* @param {Array<string>} users - array of user ids
* @returns {Promise} resolves to an array of objects mapping user ids to completion data
*/
async function getLeafData( ref, nodes, level, users ) {
	const lessonID = nodes._lessonId;
	const query = {
		lesson: lessonID,
		component: { $in: nodes },
		user: { $in: users }
	};
	if ( ref ) {
		query.completion = ref;
	}
	const completions = await Completion.find( query );
	const seen = {};
	const index = {};
	const data = users.map( ( user, idx ) => {
		index[ user ] = idx;
		return {
			[user]: {
				value: 0,
				time: void 0,
				tag: void 0
			}
		};
	});
	for ( let i = 0; i < completions.length; i++ ) {
		const completion = completions[ i ];
		if ( seen[ completion.user ] ) continue;
		data[ index[ completion.user] ] = {
			[completion.user]: {
				value: completion.value,
				time: completion.time,
				tag: completion.tag
			}
		};
		seen[ completion.user ] = true;
	}
	return data;
}

/**
* Takes an array of objects, each object mapping user ids to completion data, with users potentially repeating, and returns a single object mapping user ids to tags to an array of two-element arrays of completion values and time.
*
* @private
* @param {Array} nodeCompletions - array of objects mapping user ids to completion data
* @param {Object} metric - completion metric object
* @returns {Object} object mapping user ids to tags to an array of two-element arrays of completion values and time
*/
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
			if (
				userCompletion.time && (
					userCompletion.time < metric.timeFilter[ 0 ] ||
					userCompletion.time > metric.timeFilter[ 1 ]
			) ) {
				continue;
			}
			// Check if the tag exists in the byUsers object:
			if ( !byUsers[ userId ][ tag ] ) {
				byUsers[ userId ][ tag ] = [
					[ userCompletion.value || 0, userCompletion.time ]
				];
			} else {
				byUsers[ userId ][ tag ].push( [ userCompletion.value || 0, userCompletion.time ] );
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

/**
 * Returns an object mapping users ids to aggregate completion value for the given metric.
 *
 * @private
 * @param {Object} byUsers - object mapping user ids to tags to an array of two-element arrays of completion values and time
 * @param {Object} metric - completion metric object
 * @returns {Object} object mapping user ids to aggregate completion value (between 0 and 100) for the given metric
 */
function reduceCompletions( byUsers, metric ) {
	const ruleFn = completionRules[ metric.rule[ 0 ] ]; // TODO: handle the case where the rule is not found or ensure it exists
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

/**
 * Gathers completion data for a given metric and a set of users.
 *
 * @private
 * @param {string} id - id of the node for which to gather and compute completion data
 * @param {Object} metric - completion metric
 * @param {Array<string>} users - array of user ids
 * @returns {Promise} object mapping user ids to aggregated completion values (between 0 and 100) for the chosen metric
 */
async function gatherCompletions( id, metric, users ) {
	let nodes;
	if ( metric.level === 'component' ) {
		nodes = [ id ];
	} else {
		nodes = await relevantNodes( id, metric.level, metric.coverage, users );
	}
	let nodeCompletions = await getBranchData( metric.ref, nodes, predecessor( metric.level ), users );
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
	getBranchData,
	getLeafData,
	relevantNodes,
	DEFAULT_TAG
};
