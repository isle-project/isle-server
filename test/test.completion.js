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
const Assessment = require( './../lib/models/assessment.js' );
const User = require( './../lib/models/user.js' );
const Lesson = require( './../lib/models/lesson.js' );


// TESTS //

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'populate the database', utils.populateDatabase );

tape( 'the model can create a new assessment', function test( t ) {
	User.findOne().then( user => {
		Lesson.findOne().then( lesson => {
				const assessment = {
					lesson: lesson._id,
					user: user._id,
					component: 'free-text-question-1',
					assessment: 'completed',
					time: new Date( '2017-01-01T00:00:00.000Z' ).getTime(),
					value: 80,
					tag: 'practice'
				};
				Assessment.create( assessment, onCreate );

				function onCreate( err, createdAssessment ) {
					t.strictEqual( err instanceof Error, false, 'does not return an error' );
					t.strictEqual( createdAssessment.component, 'free-text-question-1', 'has correct component' );
					t.strictEqual( createdAssessment.assessment, 'completed', 'has correct assessment' );
					t.strictEqual( createdAssessment.time, new Date( '2017-01-01T00:00:00.000Z' ).getTime(), 'has correct time' );
					t.strictEqual( createdAssessment.value, 80, 'has correct value' );
					t.strictEqual( createdAssessment.tag, 'practice', 'has correct tag' );
					t.end();
				}
			});
		});
});
