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

const isEmptyArray = require( '@stdlib/assert/is-empty-array' );
const isObjectArray = require( '@stdlib/assert/is-object-array' );
const objectValues = require( '@stdlib/utils/values' );
const tape = require( 'tape' );

const Namespace = require( './../../lib/models/namespace.js' );
const Lesson = require( './../../lib/models/lesson.js' );
const User = require( './../../lib/models/user.js' );
const utils = require( './../utils.js' );

const { DEFAULT_TAG,
        getBranchData,
        makeCompletionPolicy } = require( './../../lib/helpers/completions.js' );

// FIXTURES //

const basicPolicy = makeCompletionPolicy();


// TESTS //

tape( 'main export is a function', ( t ) => {
	t.ok( true, __filename );
	t.ok( typeof getBranchData === 'function', 'main export is a function' );
	t.end();
});

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'populate the database', utils.populateDatabase );

tape( 'should return an array of objects (lesson level)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Lesson.find({})
			.then( ( lessons ) => {
				users = users.map( user => user._id );
				const metric = { ref: 'lesson-score' };
				getBranchData( metric, lessons.map( x => x._id ), 'lesson', users, basicPolicy )
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

tape( 'should return an array of objects (namespace level)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Namespace.findOne({
			title: 'DraculaVsFrankenstein'
		})
			.then( ( namespace ) => {
				users = users.map( user => user._id );
				const metric = { ref: 'average-score' };
				getBranchData( metric, [ namespace._id ], 'namespace', users, basicPolicy )
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

tape( 'should return an array of objects mapping user IDs to empty array for each tag when there are no completions for the users (namespace level)', ( t ) => {
	User.find( {} ).then( ( users ) => {
		Namespace.findOne({
			title: 'DraculaVsTheWolfMan'
		})
			.then( ( namespace ) => {
				users = users.map( user => user._id );
				const metric = { ref: 'average-score' };
				getBranchData( metric, [ namespace._id ], 'namespace', users, basicPolicy )
					.then( ( arr ) => {
						t.ok( isObjectArray( arr ), 'returns an array of objects' );
						for ( let i = 0; i < arr.length; i++ ) {
							const byUsers = arr[ i ];
							for ( let j = 0; j < users.length; j++ ) {
								t.ok( objectValues(byUsers[ users[ j ] ]).every(isEmptyArray), 'gives empty array for each user-tag pair' );
							}
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
