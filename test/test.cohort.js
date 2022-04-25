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
const isArray = require( '@stdlib/assert/is-array' );
const isDateObject = require( '@stdlib/assert/is-date-object' );
const isEmptyArray = require( '@stdlib/assert/is-empty-array' );
const abs = require( '@stdlib/math/base/special/abs' );
const waterfall = require( '@stdlib/utils/async/series-waterfall' );
const papply = require( '@stdlib/utils/papply' );
const utils = require( './utils.js' );
const Namespace = require( './../lib/models/namespace.js' );
const Cohort = require( './../lib/models/cohort.js' );


// TESTS //

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'populate the database', utils.populateDatabase );

tape( 'the model can create a new cohort', function test( t ) {
	const o = {
		'title': 'beep'
	};
	Cohort.create( o, function onCreate( err, createdCohort ) {
		t.strictEqual( err instanceof Error, false, 'does not return an error' );
		t.strictEqual( createdCohort.title, 'beep', 'has correct title' );
		t.ok( isEmptyArray( createdCohort.members ), 'has no members' );
		t.ok( isDateObject( createdCohort.startDate ), 'has a start date' );
		const tdiff = abs( createdCohort.startDate.getTime() - new Date().getTime() );
		t.ok( tdiff < 60000, 'start date is smaller than latency' );
		t.end();
	});
});

tape( 'inserting a cohort fails if no title is supplied', function test( t ) {
	const o = {};
	Cohort.create( o, function onCreate( err, createdCohort ) {
		const expected = 'Cohort validation failed: title: Path `title` is required.';
		t.strictEqual( err instanceof Error, true, 'returns an error' );
		t.strictEqual( err.message, expected, 'has expected message' );
		t.end();
	});
});

tape( 'one can create a cohort with a given start and end date', function test( t ) {
	const startDate = new Date();
	const endDate = new Date( startDate.getFullYear() + 1 );
	const o = {
		'title': 'boop',
		'startDate': startDate,
		'endDate': endDate
	};
	Cohort.create( o, function onCreate( err, createdCohort ) {
		t.strictEqual( err instanceof Error, false, 'does not return an error' );
		t.strictEqual( createdCohort.title, 'boop', 'has correct title' );
		t.ok( isEmptyArray( createdCohort.members ), 'has no members' );
		t.strictEqual( createdCohort.startDate, startDate, 'has correct start date' );
		t.strictEqual( createdCohort.endDate, endDate, 'has correct end date' );
		t.end();
	});
});

tape( 'one can create a cohort with an array of members', function test( t ) {
	function createCohort( members, next ) {
		const o = {
			'title': 'members_only',
			'members': members
		};
		Cohort.create( o, function onCreate( err, createdCohort ) {
			if ( err ) {
				return next( err );
			}
			t.strictEqual( createdCohort.title, 'members_only', 'has correct title' );
			t.ok( isArray( createdCohort.members ), 'has members' );
			next();
		});
	}

	function done( error ) {
		if ( error ) {
			t.fail( 'should not return an error' );
		} else {
			t.pass( 'executed without errors' );
		}
		t.end();
	}
	waterfall( [ papply( utils.createUser, [
		{
			'email': 'lotti.anton.super@gmail.com',
			'password': 'hans'
		},
		{
			'email': 'hans.anton.super@gmail.com',
			'password': 'lotti'
		}
	] ), createCohort ], done );
});

tape( 'inserting a cohort fails if members is not an array of User objects', function test( t ) {
	const o = {
		'title': 'beepboop',
		'members': [ 1, 2, 3 ]
	};
	Cohort.create( o, function onCreate( err, createdCohort ) {
		const expected = 'Cohort validation failed: members.0: Cast to [ObjectId] failed for value "[ 1, 2, 3 ]" (type string) at path "members.0" because of "CastError"';
		t.strictEqual( err instanceof Error, true, 'returns an error' );
		t.strictEqual( err.message, expected, 'has expected message' );
		t.end();
	});
});

tape( 'one can specify the namespace of the cohort', function test( t ) {
	Namespace.findOne( function onNamespace( err, ns ) {
		const o = {
			'title': 'beepboop',
			'namespace': ns
		};
		Cohort.create( o, onCreate );
	});
	function onCreate( err, cohort ) {
		t.strictEqual( err instanceof Error, false, 'does not return an error' );
		t.strictEqual( cohort.title, 'beepboop', 'has correct title' );
		t.end();
	}
});

tape( 'inserting a cohort fails if the title is already used for a certain namespace', function test( t ) {
	Namespace.findOne( function onNamespace( err, ns ) {
		const o = {
			'title': 'beepboop',
			'namespace': ns
		};
		Cohort.create( o, onCreate );
	});
	function onCreate( err, cohort ) {
		t.strictEqual( err instanceof Error, true, 'returns an error' );
		t.strictEqual( err.message, 'Cohort validation failed: title: Cohort title is invalid.', 'has expected message' );
		t.end();
	}
});

tape( 'perform clean-up', utils.after );
