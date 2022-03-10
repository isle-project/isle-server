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

'use strict';

// MODULES //

const tape = require( 'tape' );
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

			tape( 'should run without errors', ( t ) => {
				getLeafData( 'completed', nodes, null, users );
				t.end();
			});
		});
});
