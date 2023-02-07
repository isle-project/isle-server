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

const router = require( 'express' ).Router();
const debug = require( './debug' )( 'server:mail' );
const mailer = require( './mailer' );


// MAIN //

/**
 * @openapi
 *
 * /send_mail:
 *   post:
 *     summary: Send email
 *     description: Send an email.
 */
router.post( '/send_mail', function onSendMail( req, res ) {
	if ( !mailer.active ) {
		return res.status( 500 ).send( req.t( 'email-service-not-configured' ) );
	}
	mailer.send( req.body, function onDone( error, response ) {
		if ( !error ) {
			res.json( response );
		} else {
			debug( 'Mail could not be sent...' );
			res.json( error );
		}
	});
});


// EXPORTS //

module.exports = router;
