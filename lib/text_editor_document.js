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
const passport = require( './passport' );
const wrapAsync = require( './utils/wrap_async.js' );
const isValidObjectId = require( 'mongoose' ).Types.ObjectId.isValid;
const TextEditorDocument = require( './models/text_editor_document.js' );


// MAIN //

router.get( '/text_document_list',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetEvents( req, res ) {
		const lessonID = req.query.lessonID;
		const namespaceID = req.query.namespaceID;
		if ( !isValidObjectId( lessonID ) ) {
			return res.status( 400 ).send( req.t( 'invalid-id' ) );
		}
		if ( !isValidObjectId( namespaceID ) ) {
			return res.status( 400 ).send( req.t( 'invalid-id' ) );
		}
		const owner = await isOwner( req.user, namespaceID );
		if ( !owner ) {
			return res.status( 401 ).send( req.t( 'access-denied-no-owner' ) );
		}
		const documents = await TextEditorDocument
			.find({
				namespace: namespaceID,
				lesson: lessonID
			}, { id: 1 });
		res.json({ message: 'ok', documents });
	})
);


// EXPORTS //

module.exports = router;