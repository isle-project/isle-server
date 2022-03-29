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

const tape = require( 'tape' );
const isObjectArray = require( '@stdlib/assert/is-object-array' );
const objectValues = require( '@stdlib/utils/values' );
const hasOwnProp = require( '@stdlib/assert/has-own-property' );
const { getLeafData } = require( './../../lib/helpers/completions.js' );
const Lesson = require( './../../lib/models/lesson.js' );
const User = require( './../../lib/models/user.js' );
const utils = require( './../utils.js' );


// FIXTURES //

const nodes = [
	'free-text-question-1',
	'free-text-question-2'
];


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
				getLeafData( 'completed', nodes, null, users )
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

tape( 'should return an object array with each object having a userId key', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne()
			.then( ( lesson ) => {
				Object.defineProperty( nodes, '_lessonId', {
					value: lesson._id,
					writable: true,
					enumerable: false
				});
				users = users.map( user => user._id );
				console.log( 'USER IDS' );
				console.log( users );
				getLeafData( 'completed', nodes, null, users )
					.then( ( arr ) => {
						const userIds = new Set( users.map( String ) );
						console.log( 'LEAF DATA ARRAY:' );
						console.log( arr );
						t.ok( arr.every( a => {
							const keys = Object.keys( a );
							return keys.every( k => userIds.has( k ) );
						}), 'has user ID keys' );
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});

tape( 'should return an object array with each object having values with keys `value`, `time`, and `tag`', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne()
			.then( ( lesson ) => {
				Object.defineProperty( nodes, '_lessonId', {
					value: lesson._id,
					writable: true,
					enumerable: false
				});
				users = users.map( user => user._id );
				getLeafData( 'completed', nodes, null, users )
					.then( ( arr ) => {
						t.ok( arr.every( a => {
							const values = objectValues( a );
							return values.every( v =>
								hasOwnProp( v, 'value' ) &&
								hasOwnProp( v, 'time' ) &&
								hasOwnProp( v, 'tag' )
							);
						}), 'has keys `value`, `time`, and `tag`' );
						t.end();
					})
					.catch( err => {
						t.error( err );
						t.end();
					});
			});
	});
});
