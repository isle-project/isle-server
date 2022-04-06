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

/* eslint-disable max-nested-callbacks, no-multi-spaces */

'use strict';

// MODULES //

const isArray = require( '@stdlib/assert/is-array' );
const isObject = require( '@stdlib/assert/is-object' );
const isObjectArray = require( '@stdlib/assert/is-object-array' );
const objectKeys = require( '@stdlib/utils/keys' );
const objectValues = require( '@stdlib/utils/values' );
const tape = require( 'tape' );

const Lesson = require( './../../lib/models/lesson.js' );
const User = require( './../../lib/models/user.js' );
const utils = require( './../utils.js' );

const { DEFAULT_TAG,
        getLeafData,
        makeCompletionPolicy } = require( './../../lib/helpers/completions.js' );


// FIXTURES //

const nodes = [
	'free-text-question-1',
	'free-text-question-2'
];

const basicPolicy = makeCompletionPolicy( {} );
const filteringPolicy = makeCompletionPolicy({
    timeFilter: [1483228800000, 1483315200000]
});


// TESTS //

tape( 'main export is a function', ( t ) => {
	t.ok( true, __filename );
	t.ok( typeof getLeafData === 'function', 'main export is a function' );
	t.end();
});

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'populate the database', utils.populateDatabase );

tape( 'should return an array of objects', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne()
			.then( ( lesson ) => {
				Object.defineProperty( nodes, '_lessonId', {
					value: lesson._id,
					writable: true,
					enumerable: false
				});
				users = users.map( user => user._id );
				getLeafData( 'completed', nodes, null, users, basicPolicy )
					.then( ( arr ) => {
						t.ok( isObjectArray( arr ), 'returns an array of objects' );
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});

tape( 'getLeafData should return an object array with each object having a userId key that in turn maps to an object whose values are arrays of pairs', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne({ title: 'Unearth the monster' })
			.then( ( lesson ) => {
				Object.defineProperty( nodes, '_lessonId', {
					value: lesson._id,
					writable: true,
					enumerable: false
				});
				users = users.map( user => user._id );
				getLeafData( 'completed', nodes, null, users, basicPolicy )
					.then( ( arr ) => {
                                                console.log( '>> getLeafData on Unearth the monster: ', JSON.stringify(arr, null, 2) );  // ATTN: DEBUG
						const userIds = new Set( users.map( String ) );
						t.ok( arr.every( a => {
							const keys = objectKeys( a );
							return keys.every( k => userIds.has( k ) );
						}), 'has user ID keys' );
						t.ok( arr.every( a => {
							const keys = objectKeys( a );
							return keys.every( k => isObject(a[k]) );
						}), 'gives an object for each user ID' );
						t.ok( arr.every( a => {
							const keys = objectKeys( a );
							return keys.every( k => objectValues(a[k]).every(isArray) );
						}), 'gives an object with array values for each user ID' );
						t.ok( arr.every( a => {
							const keys = objectKeys( a );
							return keys.every( k => objectValues(a[k]).every(data => data.every(elt => isArray(elt) && elt.length === 2 )) );
						}), 'gives an object whose values are arrays of pairs for each user ID' );
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});

tape( 'getLeafData should return appropriate values for a given lesson', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne({ title: 'Unearth the monster' })
			.then( ( lesson ) => {
				Object.defineProperty( nodes, '_lessonId', {
					value: lesson._id,
					writable: true,
					enumerable: false
				});
				users = users.map( user => user._id );
				getLeafData( 'completed', nodes, null, users, basicPolicy )
					.then( ( arr ) => {
                                                const user0vals = arr.filter(x => x['623ce01a33522d1d834b8f10'] && x['623ce01a33522d1d834b8f10'][DEFAULT_TAG].length > 0)
                                                      .map( x => x['623ce01a33522d1d834b8f10'][DEFAULT_TAG][0][0] )
                                                      .sort((a, b) => a - b);
                                                const user1vals = arr.filter(x => x['623ce01a33522d1d834b8f11'] && x['623ce01a33522d1d834b8f11'][DEFAULT_TAG].length > 0)
                                                      .map( x => x['623ce01a33522d1d834b8f11'][DEFAULT_TAG][0][0] )
                                                      .sort((a, b) => a - b);
                                                const user2vals = arr.filter(x => x['623ce01a33522d1d834b8f12'] && x['623ce01a33522d1d834b8f12'][DEFAULT_TAG].length > 0)
                                                      .map( x => x['623ce01a33522d1d834b8f11'][DEFAULT_TAG][0][0] )
                                                      .sort((a, b) => a - b);
                                                // ATTN:MORE ...

						t.strictEqual( user0vals[0], 80,  'gives user 0 correct smallest value' );
						t.strictEqual( user0vals[1], 100, 'gives user 0 correct largest value' );
						t.strictEqual( user1vals[0], 20,  'gives user 1 correct smallest value' );
						t.strictEqual( user1vals[1], 50,  'gives user 1 correct largest value' );
                                                t.strictEqual( user2vals[0], 0, 'has a correct imputed 0 for user 2' );
                                                t.strictEqual( user2vals[1], 0, 'has another correct imputed 0 for user 2' );
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});

tape( 'getLeafData should return appropriate values for a given lesson with a time filter', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne({ title: 'Unearth the monster' })
			.then( ( lesson ) => {
				Object.defineProperty( nodes, '_lessonId', {
					value: lesson._id,
					writable: true,
					enumerable: false
				});
				users = users.map( user => user._id );
				getLeafData( 'completed', nodes, null, users, filteringPolicy )
					.then( ( arr ) => {
                                                console.log( '>> getLeafData on FILTERED Unearth the monster: ', JSON.stringify(arr, null, 2) );  // ATTN: DEBUG
                                                const user0vals = arr.filter(x => x['623ce01a33522d1d834b8f10'] && x['623ce01a33522d1d834b8f10'][DEFAULT_TAG].length > 0)
                                                      .map( x => x['623ce01a33522d1d834b8f10'][DEFAULT_TAG][0][0] )
                                                      .sort((a, b) => a - b);
                                                const user1vals = arr.filter(x => x['623ce01a33522d1d834b8f11'] && x['623ce01a33522d1d834b8f11'][DEFAULT_TAG].length > 0)
                                                      .map( x => x['623ce01a33522d1d834b8f11'][DEFAULT_TAG][0][0] )
                                                      .sort((a, b) => a - b);

						t.strictEqual( user0vals[0], 0, 'gives user 0 correct imputed smallest value' );
						t.strictEqual( user0vals[1], 100, 'gives user 0 correct largest value' );
						t.strictEqual( user1vals[0], 20,  'gives user 1 correct smallest value' );
						t.strictEqual( user1vals[1], 50,  'gives user 1 correct largest value' );
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});
