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
const fs = require( 'fs/promises' );
const path = require( 'path' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const validateString = require( './helpers/validate_string.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const settings = require( './../etc/settings.json' );


// MAIN //

router.get( '/get_settings',
	passport.authenticate( 'jwt', { session: false }),
	function onGetSettings( req, res ) {
		res.json( settings );
	}
);

router.post( '/update_settings',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( function onUpdateSettings( req, res ) {
		validateAdmin( req );
		validateString( req.body.name, 'name', req.t );
		validateString( req.body.value, 'value', req.t );

		console.log( 'Setting '+req.body.name+' to '+req.body.value );
		settings[ req.body.name ] = req.body.value;
		console.log( settings );
		fs.writeFile( path.join( __dirname, './../etc/settings.json' ), JSON.stringify( settings ) );

		res.json({ message: 'ok', settings });
	})
);


// EXPORTS //

module.exports = router;
