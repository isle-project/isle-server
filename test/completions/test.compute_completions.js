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

/* eslint-disable max-nested-callbacks */

'use strict';

// MODULES //

const isNumber   = require( '@stdlib/assert/is-number' ).isPrimitive;
const isObject   = require( '@stdlib/assert/is-plain-object' );
const objectKeys = require( '@stdlib/utils/keys' );
const tape       = require( 'tape' );

const Namespace = require( './../../lib/models/namespace.js' );
const Lesson    = require( './../../lib/models/lesson.js' );
const User      = require( './../../lib/models/user.js' );
const utils     = require( './../utils.js' );

const { DEFAULT_TAG,
        computeCompletions,
        makeCompletionPolicy } = require( './../../lib/helpers/completions.js' );

// HELPERS //

const almostEquals = (a, b) => {  // ATTN:CHECK THIS - basically ok but epsilon might be tweaked
    if ( a === b ) {
        return true;
    } else if ( a === 0 || b === 0 || (Math.abs(a/2) + Math.abs(b/2)) < Number.EPSILON ) {
        return Math.abs(a - b) < Number.EPSILON;
    } else {
        return Math.abs(a - b) < Number.EPSILON * (Math.abs(a/2) + Math.abs(b/2));
    }
};

// FIXTURES //

const basicPolicy = makeCompletionPolicy();
const filteringPolicy = makeCompletionPolicy({
    timeFilter: [1483228800000, 1483315200000]
});
const weightedPolicy = makeCompletionPolicy({
    tagWeights: {
        'homework': 1,
        'exams': 3
    }
});


// TESTS //

tape( 'main export is a function', ( t ) => {
	t.ok( true, __filename );
	t.ok( typeof computeCompletions === 'function', 'main export is a function' );
	t.end();
});

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'populate the database', utils.populateDatabase );


// Basic Shape Tests

tape( 'computeCompletions should return an object mapping user IDs to numbers between 0 and 100 (lesson level)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne({
			title: 'Unearth the monster'
		})
			.then( ( lesson ) => {
				users = users.map( user => user._id );
				computeCompletions( lesson._id, lesson.completion[ 0 ], users, basicPolicy )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an array of objects' );
						const userKeys = objectKeys( obj );
						t.equal( userKeys.length, users.length, 'each user is represented in the returned object' );
						for ( let i = 0; i < users.length; i++ ) {
							const user = String( users[ i ] );
							t.ok( isNumber( obj[ user ] ) && obj[ user ] >= 0 && obj[ user ] <= 100, 'each user score is between 0 and 100' );
						}
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});

tape( 'computeCompletions should return an object mapping user IDs to numbers between 0 and 100 (namespace level)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Namespace.findOne({
			title: 'DraculaVsFrankenstein'
		})
			.then( ( namespace ) => {
				users = users.map( user => user._id );
				computeCompletions( namespace._id, namespace.completion[ 0 ], users, basicPolicy )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an array of objects' );
						const userKeys = objectKeys( obj );
						t.equal( userKeys.length, users.length, 'each user is represented in the returned object' );
						for ( let i = 0; i < users.length; i++ ) {
							const user = String( users[ i ] );
							t.ok( isNumber( obj[ user ] ) && obj[ user ] >= 0 && obj[ user ] <= 100, 'each user score is between 0 and 100' );
						}
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});


// Edge-Case Tests

tape( 'computeCompletions should return an object mapping user IDs to zero if no completion data is available (namespace level)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Namespace.findOne({
			title: 'DraculaVsTheWolfMan'
		})
			.then( ( namespace ) => {
				users = users.map( user => user._id );
				computeCompletions( namespace._id, namespace.completion[ 0 ], users, basicPolicy )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an array of objects' );
						const userKeys = objectKeys( obj );
						t.equal( userKeys.length, users.length, 'each user is represented in the returned object' );
						for ( let i = 0; i < users.length; ++i ) {
							const user = String( users[ i ] );
							t.equal( obj[ user ], 0, 'returns zero' );
						}
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});


// Value Tests, no tag weights or time filter

tape( 'computeCompletions should return an object mapping user IDs to the correct completion scores (lesson level, no weighting, no filtering)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne({
			title: 'Unearth the monster'
		})
			.then( ( lesson ) => {
				users = users.map( user => user._id );

				console.log( 'Lesson info:', lesson._id, JSON.stringify(lesson.completion[ 0 ], null, 2) ); // ATTN:DEBUG
				computeCompletions( lesson._id, lesson.completion[ 0 ], users, basicPolicy )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an array of objects' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f10' ], 90, 'user with ID `623ce01a33522d1d834b8f10` has a completion score of 90' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f11' ], 35, 'user with ID `623ce01a33522d1d834b8f11` has a completion score of 35' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f12' ], 0,  'user with ID `623ce01a33522d1d834b8f12` has a completion score of  0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f13' ], 0,  'user with ID `623ce01a33522d1d834b8f13` has a completion score of  0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f14' ], 0,  'user with ID `623ce01a33522d1d834b8f14` has a completion score of  0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f15' ], 0,  'user with ID `623ce01a33522d1d834b8f15` has a completion score of  0' );
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});

tape( 'computeCompletions should again return an object mapping user IDs to the correct completion scores (lesson level, no filtering, no weighting)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne({
			title: 'Drink his blood'
		})
			.then( ( lesson ) => {
				users = users.map( user => user._id );

				console.log( 'Lesson info:', lesson._id, JSON.stringify(lesson.completion[ 0 ], null, 2) ); // ATTN:DEBUG
				computeCompletions( lesson._id, lesson.completion[ 0 ], users, basicPolicy )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an array of objects' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f10' ], 0, 'user with ID `623ce01a33522d1d834b8f10` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f11' ], 0, 'user with ID `623ce01a33522d1d834b8f11` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f12' ], 50, 'user with ID `623ce01a33522d1d834b8f12` has a completion score of 50' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f13' ], 0, 'user with ID `623ce01a33522d1d834b8f13` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f14' ], 30, 'user with ID `623ce01a33522d1d834b8f14` has a completion score of 30' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f15' ], 0, 'user with ID `623ce01a33522d1d834b8f15` has a completion score of 0' );
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});

tape( 'computeCompletions should yet again return an object mapping user IDs to the correct completion scores (lesson level, no weighting, no filtering)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne({
			title: 'Talbot, you are a murderer'
		})
			.then( ( lesson ) => {
				users = users.map( user => user._id );

				console.log( 'Lesson info:', lesson._id, JSON.stringify(lesson.completion[ 0 ], null, 2) ); // ATTN:DEBUG
				computeCompletions( lesson._id, lesson.completion[ 0 ], users, basicPolicy )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an array of objects' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f10' ], 0, 'user with ID `623ce01a33522d1d834b8f10` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f11' ], 0, 'user with ID `623ce01a33522d1d834b8f11` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f12' ], 0, 'user with ID `623ce01a33522d1d834b8f12` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f13' ], 0, 'user with ID `623ce01a33522d1d834b8f13` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f14' ], 40, 'user with ID `623ce01a33522d1d834b8f14` has a completion score of 40' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f15' ], 95, 'user with ID `623ce01a33522d1d834b8f15` has a completion score of 95' );
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});

tape( 'computeCompletions should return an object mapping user IDs to the correct completion scores (namespace level, no weighting, no filtering)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Namespace.findOne({
			title: 'DraculaVsFrankenstein'
		})
			.then( ( namespace ) => {
				users = users.map( user => user._id );
				console.log( 'Namespace info:', namespace._id, JSON.stringify(namespace.completion[ 0 ], null, 2) ); // ATTN:DEBUG
				computeCompletions( namespace._id, namespace.completion[ 0 ], users, basicPolicy )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an object' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f10' ], (90 +	 0 +  0)/3, 'user with ID `623ce01a33522d1d834b8f10` has a completion score of 90' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f11' ], (35 + 75 +  0)/3, 'user with ID `623ce01a33522d1d834b8f11` has a completion score of 35' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f12' ], ( 0 + 40 + 50)/3, 'user with ID `623ce01a33522d1d834b8f12` has a completion score of 65' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f13' ], ( 0 +	 0 +  0)/3, 'user with ID `623ce01a33522d1d834b8f13` has a completion score of	0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f14' ], ( 0 +	 0 + 30)/3, 'user with ID `623ce01a33522d1d834b8f14` has a completion score of 80' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f15' ], ( 0 +	 0 +  0)/3, 'user with ID `623ce01a33522d1d834b8f15` has a completion score of 95' );
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});


// Value Tests with tag weights, no time filter

/*
tape( 'should again return an object mapping user IDs to the correct completion scores (lesson level, tag weights, no filtering)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne({
			title: 'Drink his blood'
		})
			.then( ( lesson ) => {
				users = users.map( user => user._id );

				console.log( 'Lesson info:', lesson._id, lesson.completion[ 0 ] );
				computeCompletions( lesson._id, lesson.completion[ 0 ], users, weightedPolicy )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an array of objects' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f10' ], 0, 'user with ID `623ce01a33522d1d834b8f10` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f11' ], 0, 'user with ID `623ce01a33522d1d834b8f11` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f12' ], 50, 'user with ID `623ce01a33522d1d834b8f12` has a completion score of 50' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f13' ], 0, 'user with ID `623ce01a33522d1d834b8f13` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f14' ], 30, 'user with ID `623ce01a33522d1d834b8f14` has a completion score of 30' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f15' ], 0, 'user with ID `623ce01a33522d1d834b8f15` has a completion score of 0' );
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});
*/


// Value Tests with time filter, no tag weights

/*
tape( 'should yet again return an object mapping user IDs to the correct completion scores (lesson level, time filtering, no weighting)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne({
			title: 'Talbot, you are a murderer'
		})
			.then( ( lesson ) => {
				users = users.map( user => user._id );

				console.log( 'Lesson info:', lesson._id, lesson.completion[ 0 ] );
				computeCompletions( lesson._id, lesson.completion[ 0 ], users, filteringPolicy )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an array of objects' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f10' ], 0, 'user with ID `623ce01a33522d1d834b8f10` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f11' ], 0, 'user with ID `623ce01a33522d1d834b8f11` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f12' ], 0, 'user with ID `623ce01a33522d1d834b8f12` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f13' ], 0, 'user with ID `623ce01a33522d1d834b8f13` has a completion score of 0' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f14' ], 40, 'user with ID `623ce01a33522d1d834b8f14` has a completion score of 40' );
						t.strictEqual( obj[ '623ce01a33522d1d834b8f15' ], 95, 'user with ID `623ce01a33522d1d834b8f15` has a completion score of 95' );
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});
*/
