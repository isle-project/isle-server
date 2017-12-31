'use strict';

// MODULES //

var tape = require( 'tape' );
var isArray = require( '@stdlib/assert/is-array' );
var isDateObject = require( '@stdlib/assert/is-date-object' );
var isEmptyArray = require( '@stdlib/assert/is-empty-array' );
var abs = require( '@stdlib/math/base/special/abs' );
var waterfall = require( '@stdlib/utils/series-waterfall' );
var utils = require( './utils.js' );
var User = require( './../lib/user.js' );
var Cohort = require( './../lib/cohort.js' );


// TESTS //

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'the model can create a new cohort', function test( t ) {
	var o = {
		'title': 'beep'
	};
	Cohort.create( o, function onCreate( err, createdCohort ) {
		var tdiff;
		t.strictEqual( err instanceof Error, false, 'does not return an error' );
		t.strictEqual( createdCohort.title, 'beep', 'has correct title' );
		t.ok( isEmptyArray( createdCohort.members ), 'has no members' );
		t.ok( isDateObject( createdCohort.startDate ), 'has a start date' );
		tdiff = abs( createdCohort.startDate.getTime() - new Date().getTime() );
		t.ok( tdiff < 60000, 'start date is smaller than latency' );
		t.end();
	});
});

tape( 'inserting a cohort fails if no title is supplied', function test( t ) {
	var o = {};
	Cohort.create( o, function onCreate( err, createdCohort ) {
		var expected = 'Cohort validation failed: title: Path `title` is required.';
		t.strictEqual( err instanceof Error, true, 'returns an error' );
		t.strictEqual( err.message, expected, 'has expected message' );
		t.end();
	});
});

tape( 'inserting a cohort fails if the title is already used', function test( t ) {
	var o = {
		'title': 'beep'
	};
	Cohort.create( o, function onCreate( err, createdCohort ) {
		var expected = 'Cohort with the given title already exists: beep';
		t.strictEqual( err instanceof Error, true, 'returns an error' );
		t.strictEqual( err.message, expected, 'has expected message' );
		t.end();
	});
});

tape( 'one can create a cohort with a given start and end date', function test( t ) {
	var startDate = new Date();
	var endDate = new Date( startDate.getFullYear() + 1 );
	var o = {
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
	function createUsers( next ) {
		var u = [
			{
				'email': 'lotti.anton.super@gmail.com',
				'password': 'hans'
			},
			{
				'email': 'hans.anton.super@gmail.com',
				'password': 'lotti'
			}
		];
		User.create( u, function onCreate( err, users ) {
			if ( err ) {
				next( err );
			} else {
				next( null, users );
			}
		});
	}

	function createCohort( members, next ) {
		var o = {
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
	waterfall( [ createUsers, createCohort ], done );
});

tape( 'inserting a cohort fails if members is not an array of User objects', function test( t ) {
	var o = {
		'title': 'beepboop',
		'members': [ 1, 2, 3 ]
	};
	Cohort.create( o, function onCreate( err, createdCohort ) {
		var expected = 'Cohort validation failed: members: Cast to Array failed for value "[ 1, 2, 3 ]" at path "members"';
		t.strictEqual( err instanceof Error, true, 'returns an error' );
		t.strictEqual( err.message, expected, 'has expected message' );
		t.end();
	});
});

tape( 'perform clean-up', utils.after );
