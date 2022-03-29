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
const isStringArray = require( '@stdlib/assert/is-string-array' );
const isEmptyArray = require( '@stdlib/assert/is-empty-array' );
const { relevantNodes } = require( './../../lib/helpers/completions.js' );
const Lesson = require( './../../lib/models/lesson.js' );
const mongoose = require( 'mongoose' );
const Namespace = require( './../../lib/models/namespace.js' );
const utils = require( './../utils.js' );


// VARIABLES //

const isValidObjectId = mongoose.Types.ObjectId.isValid;


// TESTS //

tape( 'main export is a function', ( t ) => {
	t.ok( true, __filename );
	t.ok( typeof relevantNodes === 'function', 'main export is a function' );
	t.end();
});

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'populate the database', utils.populateDatabase );

tape( 'the function should return an array of node IDs that match the completion criteria and the level (lesson level)', ( t ) => {
	Lesson.findOne({
		title: 'Unearth the monster'
	})
		.then( ( lesson ) => {
			relevantNodes( lesson._id, 'lesson', [ 'all' ], null )
				.then( ( arr ) => {
					t.ok( isStringArray( arr ), 'returns an array of strings' );
					t.strictEqual( arr.length, 2, 'returns an array of length 2' );
					t.ok( arr.includes( 'free-text-question-1' ), 'contains the expected node ID' );
					t.ok( arr.includes( 'free-text-question-2' ), 'contains the expected node ID' );
					t.end();
				});
		});
});

tape( 'the function should return an array of node IDs that match the completion criteria and the level (namespace level)', ( t ) => {
	Namespace.findOne({
		title: 'DraculaVsFrankenstein'
	})
		.then( ( namespace ) => {
			relevantNodes( namespace._id, 'namespace', [ 'all' ], null )
				.then( ( arr ) => {
					t.ok( isStringArray( arr ), 'returns an array of strings' );
					t.strictEqual( arr.length, 3, 'returns an array of length 3' );
					t.ok( isValidObjectId( arr[ 0 ] ), 'returns an array of valid ObjectIds' );
					t.end();
				});
		});
});

tape( 'the function should return an empty array if there are no node IDs matching the completion criteria and the level (namespace level)', ( t ) => {
	Namespace.findOne({
		title: 'DraculaVsTheWolfMan'
	})
		.then( ( namespace ) => {
			relevantNodes( namespace._id, 'namespace', [ 'all' ], null )
				.then( ( arr ) => {
					t.ok( isEmptyArray( arr ), 'returns an empty array' );
					t.strictEqual( arr.length, 0, 'returns an array of length 0' );
					t.end();
				});
		});
});
