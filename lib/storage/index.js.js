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

const multer = require( 'multer' );
const { basename, extname, join } = require( 'path' );
const { MEDIA_DIRECTORY } = require( './../constants.js' );


// VARIABLES //

const MEDIA_BASE_DIR = basename( MEDIA_DIRECTORY );
const MEDIA_AVATAR_DIR = join( MEDIA_BASE_DIR, 'avatar' );
const MEDIA_THUMBNAIL_DIR = join( MEDIA_BASE_DIR, 'thumbnail' );
const MEDIA_ATTACHMENTS_DIR = join( MEDIA_BASE_DIR, 'attachments' );


// MAIN //

// Settings for storing user and owner files in the `media` directory:
const storage = multer.diskStorage({
	destination: function onDestination( req, file, cb ) {
		if ( file.fieldname === 'avatar' ) {
			return cb( null, MEDIA_AVATAR_DIR );
		}
		if ( file.fieldname === 'thumbnail' ) {
			return cb( null, MEDIA_THUMBNAIL_DIR );
		}
		if ( file.fieldname === 'attachment' ) {
			return cb( null, MEDIA_ATTACHMENTS_DIR );
		}
		return cb( null, MEDIA_DIRECTORY );
	},
	filename: function onFilename( req, file, cb ) {
		const query = req.query;
		if ( query.owner === 'true' && query.namespaceName ) {
			return cb( null, query.namespaceName + '_' + file.originalname );
		}
		if (
			file.fieldname === 'avatar' ||
			file.fieldname === 'thumbnail'
		) {
			return cb( null, file.originalname );
		}
		const ext = extname( file.originalname );
		if ( file.fieldname === 'license' ) {
			return cb( null, '.isle-license' );
		}
		const base = basename( file.originalname, ext );
		cb( null, base + '_' + Date.now() + ext );
	}
});


// EXPORTS //

module.exports = storage;
