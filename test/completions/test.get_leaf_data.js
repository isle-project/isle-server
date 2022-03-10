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
const objectValues = require( '@stdlib/utils/object-values' );
const hasOwnProp = require( '@stdlib/assert/has-own-property' );
const { getLeafData } = require( './../lib/helpers/completions.js' );
const Lesson = require( './../models/lesson' );
const User = require( './../models/user' );


// TESTS //

tape( 'main export is a function', ( t ) => {
	t.ok( typeof getLeafData === 'function', 'main export is a function' );
	t.end();
});

const nodes = [
	'free-text-question-1',
	'free-text-question-2'
];
User.find( {} ).then( ( users ) => {
	Lesson.findOne()
		.then( ( lesson ) => {
			Object.defineProperty( nodes, '_lessonId', {
				value: lesson._id,
				writable: false,
				enumerable: false
			});

			tape( 'should return an array of objects', ( t ) => {
				const arr = getLeafData( 'completed', nodes, null, users );
				t.ok( isObjectArray( arr ), 'returns an array of objects' );
				t.end();
			});

			tape( 'should return an object array with each object having a userId key', ( t ) => {
				const arr = getLeafData( 'completed', nodes, null, users );
				const userIds = new Set( users.map( v => v._id ) );
				t.ok( arr.every( a => {
					const keys = Object.keys( a );
					return keys.every( k => userIds.has( k ) );
				}), 'has user ID keys' );
				t.end();
			});

			tape( 'should return an object array with each object having values with keys `value`, `time`, and `tag`', ( t ) => {
				const arr = getLeafData( 'completed', nodes, null, users );
				t.ok( arr.every( a => {
					const values = objectValues( a );
					return values.every( v =>
						hasOwnProp( v, 'value' ) &&
						hasOwnProp( v, 'time' ) &&
						hasOwnProp( v, 'tag' )
					);
				}), 'has keys `value`, `time`, and `tag`' );
				t.end();
			});
		});
});
