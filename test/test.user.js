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
const contains = require( '@stdlib/assert/contains' );
const isString = require( '@stdlib/assert/is-string' );
const utils = require( './utils.js' );
const User = require( './../lib/models/user.js' );


// TESTS //

tape( 'connect to a clean mongoDB database', utils.before );

tape( 'the model can create a new user', function test( t ) {
	const o = {
		'name': 'Oliver Cromwell',
		'organization': 'England',
		'email': 'cromwell.oliver@isledocs.com',
		'password': 'charles'
	};
	User.create( o, async function onCreate( err, createdUser ) {
		t.strictEqual( err instanceof Error, false, 'does not return an error' );
		t.strictEqual( createdUser.email, 'cromwell.oliver@isledocs.com', 'has correct email' );
		t.strictEqual( createdUser.name, 'Oliver Cromwell', 'has correct name' );
		t.strictEqual( createdUser.organization, 'England', 'has correct organization' );
		t.notEqual( createdUser.password, 'charles', 'does not save password in clear-text' );
		const isMatch = await createdUser.comparePassword( 'charles' );
		t.ok( isMatch, 'saved password represents the unhashed one' );
		t.end();
	});
});

tape( 'the model saves a randomly generated email and name for each user', function test( t ) {
	const o = {
		'name': 'Winston Churchill',
		'organization': 'England',
		'email': 'winston.churchill@isledocs.com',
		'password': 'winston'
	};
	User.create( o, function onCreate( err, createdUser ) {
		t.strictEqual( err instanceof Error, false, 'does not return an error' );
		t.strictEqual( isString( createdUser.email ), true, 'has anonymous email' );
		t.strictEqual( isString( createdUser.name ), true, 'has anonymous name' );
		t.end();
	});
});

tape( 'creating a user fails when email is already taken', function test( t ) {
	const o = {
		'email': 'cromwell.oliver@isledocs.com',
		'password': 'charles'
	};
	User.create( o, function onCreate( err ) {
		if ( err ) {
			t.strictEqual( err.message, 'A user with this email address already exists.', 'returns expected message' );
			t.pass( 'encountered an error' );
		} else {
			t.pass( 'expected an error' );
		}
		t.end();
	});
});

tape( 'updating a user does not change the hashed password', async function test( t ) {
	const o = {
		'email': 'cromwell.oliver@isledocs.com'
	};
	const createdUser = await User.findOneAndUpdate( o, { '$set': { 'organization': 'United Kingdom' }}, { 'new': true });
	t.strictEqual( createdUser.organization, 'United Kingdom', 'has updated the organization' );
	t.notEqual( createdUser.password, 'charles', 'does not save password in clear-text' );
	const isMatch = await createdUser.comparePassword( 'charles' );
	t.ok( isMatch, 'saved password represents the unhashed one' );
	t.end();
});

tape( 'perform clean-up', utils.after );
