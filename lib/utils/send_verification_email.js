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

const mailer = require( './../mailer' );
const debug = require( './../debug' );
const ErrorStatus = require( './../helpers/error.js' );
const { NOTIFICATIONS_EMAIL, SERVER_HOST_NAME } = require( './../constants.js' );


// MAIN //

function sendVerificationEmail( user, t ) {
	const mail = {
		'from': NOTIFICATIONS_EMAIL,
		'subject': 'Verify your email address',
		'to': user.email,
		'text': `
			Dear ${user.name}, welcome to ISLE! Please click on the link below to confirm your email address.
		`,
		'link': `${SERVER_HOST_NAME}/dashboard/#/confirm-email/?token=${user._id}`
	};
	debug( 'Mail: ' + JSON.stringify( mail ) );
	mailer.send( mail, function onDone( error ) {
		if ( error ) {
			throw new ErrorStatus( 503, t( 'email-service-not-available' ) );
		}
	});
}


// EXPORTS //

module.exports = sendVerificationEmail;
