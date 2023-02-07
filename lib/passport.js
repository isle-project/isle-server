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

const passport = require( 'passport' );
const passportJWT = require( 'passport-jwt' );
const debug = require( './debug' )( 'server:passport' );
const User = require( './models/user.js' );
const { tokens } = require( './credentials.js' );


// VARIABLES //

const ExtractJwt = passportJWT.ExtractJwt;
const JwtStrategy = passportJWT.Strategy;

// JSON Web Token options for user authentication:
const jwtOptions = {
	jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme( 'jwt' ),
	secretOrKey: tokens.jwtKey
};

const strategy = new JwtStrategy( jwtOptions, function onPayloadReceived( jwtPayload, next ) {
	debug( 'Payload received: ', jwtPayload );
	User.findOne({ '_id': jwtPayload.id }, function onFindOne( err, user ) {
		if ( !err ) {
			next( null, user );
		} else {
			next( err, false );
		}
	});
});


// MAIN //

passport.use( strategy );


// EXPORTS //

module.exports = passport;
