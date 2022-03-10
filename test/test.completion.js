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
const utils = require( './utils.js' );
const Completion = require( './../lib/models/user.js' );


// TESTS //

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'populate the database', utils.populateDatabase );

tape( 'the model can create a new completion', function test( t ) {
	const completion = {
		lesson: '5a7e9f8f8f8f8f8f8f8f8f8',
		user: '9a7e9f8f8f8f8f8f8f8f8f8',
		component: 'free-text-question-1',
		completion: 'completed',
		time: new Date( '2017-01-01T00:00:00.000Z' ).getTime(),
		value: 80,
		tag: 'practice'
	};
	Completion.create( completion, function onCreate( err, createdCompletion ) {
		t.strictEqual( err instanceof Error, false, 'does not return an error' );
		t.strictEqual( createdCompletion.component, 'free-text-question-1', 'has correct component' );
		t.strictEqual( createdCompletion.completion, 'completed', 'has correct completion' );
		t.strictEqual( createdCompletion.time, new Date( '2017-01-01T00:00:00.000Z' ).getTime(), 'has correct time' );
		t.strictEqual( createdCompletion.value, 80, 'has correct value' );
		t.strictEqual( createdCompletion.tag, 'practice', 'has correct tag' );
		t.end();
	});
});
