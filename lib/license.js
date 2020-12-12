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
const multer = require( 'multer' );
const { readFile, unlink } = require( 'fs/promises' );
const { join } = require( 'path' );
const storage = require( './storage' );
const passport = require( './passport' );
const wrapAsync = require( './utils/wrap_async.js' );
const ErrorStatus = require( './helpers/error.js' );
const isAdmin = require( './helpers/is_admin.js' );
const ev = require( './ev.js' );
const { MEDIA_DIRECTORY } = require( './constants.js' );


// VARIABLES //

const licenseUpload = multer({ storage: storage }).single( 'license' );


// MAIN //

router.get( '/get_license',
	isAdmin,
	passport.authenticate( 'jwt', { session: false }),
	function onGetLicense( req, res ) {
		res.json({ message: 'ok', license: ev.license });
	}
);

router.post( '/remove_license',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onRemoveLicense( req, res ) {
		if ( !req.user.administrator ) {
			throw new ErrorStatus( 403, req.t( 'license-delete-only-admin') );
		}
		await unlink( join( MEDIA_DIRECTORY, '.isle-license' ) );
		res.json({ message: 'ok' });
	})
);

router.post( '/upload_license',
	isAdmin,
	licenseUpload,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onLicenseUpload( req, res ) {
		let license = await readFile( req.file.path, 'utf8' );
		license = ev.decode( license );
		res.json({ message: req.t( 'license-uploaded' ), license });
	})
);


// EXPORTS //

module.exports = router;
