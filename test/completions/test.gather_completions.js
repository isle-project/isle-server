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

const isArray      = require( '@stdlib/assert/is-array' );
const isEmptyArray = require( '@stdlib/assert/is-empty-array' );
const isNumber     = require( '@stdlib/assert/is-number' ).isPrimitive;
const isObject     = require( '@stdlib/assert/is-plain-object' );
const objectKeys   = require( '@stdlib/utils/keys' );
const tape         = require( 'tape' );

const Namespace = require( './../../lib/models/namespace.js' );
const Lesson    = require( './../../lib/models/lesson.js' );
const User      = require( './../../lib/models/user.js' );
const utils     = require( './../utils.js' );

const { DEFAULT_TAG,
        gatherCompletions,
        makeCompletionPolicy } = require( './../../lib/helpers/completions.js' );

// FIXTURES //

const basicPolicy = makeCompletionPolicy();


// TESTS //

tape( 'main export is a function', ( t ) => {
	t.ok( true, __filename );
	t.ok( typeof gatherCompletions === 'function', 'main export is a function' );
	t.end();
});

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'populate the database', utils.populateDatabase );


// Basic Shape Tests

tape( 'should return an object mapping with all user IDs as keys map to an object (lesson level)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.findOne({
			title: 'Unearth the monster'
		})
			.then( ( lesson ) => {
				users = users.map( user => user._id );
				gatherCompletions( lesson._id, lesson.completion[ 0 ], users, basicPolicy )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an object' );
						const userKeys = objectKeys( obj );
						t.equal( userKeys.length, users.length, 'each user is represented in the returned object' );
						for ( let i = 0; i < users.length; i++ ) {
							const user = String( users[ i ] );
							t.ok( isObject( obj[ user ] ), 'each user is associated with an object' );
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

tape( 'should return an object mapping with all user IDs as keys map to an object (namespace level)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Namespace.findOne({
			title: 'DraculaVsFrankenstein'
		})
			.then( ( namespace ) => {
				users = users.map( user => user._id );
				gatherCompletions( namespace._id, namespace.completion[ 0 ], users )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an object' );
						const userKeys = objectKeys( obj );
						t.equal( userKeys.length, users.length, 'each user is represented in the returned object' );
						for ( let i = 0; i < users.length; i++ ) {
							const user = String( users[ i ] );
							t.ok( isObject( obj[ user ] ), 'each user is associated with an object' );
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

tape( 'should return an object mapping user IDs to DEFAULT_TAG to empty array if no completion data is available (namespace level)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Namespace.findOne({
			title: 'DraculaVsTheWolfMan'
		})
			.then( ( namespace ) => {
				users = users.map( user => user._id );
				gatherCompletions( namespace._id, namespace.completion[ 0 ], users )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an object' );
						const userKeys = objectKeys( obj );
						for ( let i = 0; i < users.length; ++i ) {
							const user = String( users[ i ] );
							t.ok( obj[ user ][ DEFAULT_TAG ], 'each user and DEFAULT_TAG exists' );
							t.ok( isArray( obj[ user ][ DEFAULT_TAG ] ), 'each user and DEFAULT_TAG has an array' );
							t.ok( isEmptyArray( obj[ user ][ DEFAULT_TAG ] ), 'each user and DEFAULT_TAG is an empty array' );
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
