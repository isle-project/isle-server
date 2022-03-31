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
const isObject = require( '@stdlib/assert/is-plain-object' );
const isNumber = require( '@stdlib/assert/is-number' ).isPrimitive;
const objectKeys = require( '@stdlib/utils/keys' );
const { gatherCompletions } = require( './../../lib/helpers/completions.js' );
const Namespace = require( './../../lib/models/namespace.js' );
const Lesson = require( './../../lib/models/lesson.js' );
const User = require( './../../lib/models/user.js' );
const utils = require( './../utils.js' );


// TESTS //

tape( 'main export is a function', ( t ) => {
	t.ok( true, __filename );
	t.ok( typeof gatherCompletions === 'function', 'main export is a function' );
	t.end();
});

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'populate the database', utils.populateDatabase );

tape( 'should return an object mapping user IDs to numbers between 0 and 100 (lesson level)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.find({})
			.then( ( lessons ) => {
				users = users.map( user => user._id );
				gatherCompletions( 'lesson-score', lessons.map( x => x._id ), 'lesson', users )
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

tape( 'should return an object mapping user IDs to numbers between 0 and 100 (namespace level)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Namespace.findOne({
			title: 'DraculaVsFrankenstein'
		})
			.then( ( namespace ) => {
				users = users.map( user => user._id );
				gatherCompletions( namespace._id, namespace.completion[ 0 ], users )
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

tape( 'should return an object mapping user IDs to zero if no completion data is available (namespace level)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Namespace.findOne({
			title: 'DraculaVsTheWolfMan'
		})
			.then( ( namespace ) => {
				users = users.map( user => user._id );
				gatherCompletions( namespace._id, namespace.completion[ 0 ], users )
					.then( ( obj ) => {
						t.ok( isObject( obj ), 'returns an array of objects' );
						const userKeys = objectKeys( obj );
						t.equal( userKeys.length, users.length, 'each user is represented in the returned object' );
						for ( let j = 0; j < users.length; j++ ) {
							t.equal( obj[ users[ j ] ], 0, 'returns zero' );
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
