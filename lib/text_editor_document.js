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
const isOwner = require( './helpers/is_owner.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const validateOwner = require( './helpers/validate_owner.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const TextEditorDocument = require( './models/text_editor_document.js' );
const { uncompressStepJSON } = require( './sockets/document/compress' );


// MAIN //

router.get( '/text_editor_document_list',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetDocumentList( req, res ) {
		const { lessonID, namespaceID } = req.query;

		validateObjectId( lessonID, 'lessonID', req.t );
		validateObjectId( namespaceID, 'namespaceID', req.t );
		validateOwner( req, namespaceID );

		const documents = await TextEditorDocument.find({
			namespace: namespaceID,
			lesson: lessonID
		}, { id: 1 });
		res.json({ message: 'ok', documents });
	})
);

router.get( '/text_editor_document',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetDocument( req, res ) {
		const { lessonID, namespaceID, id } = req.query;

		validateObjectId( lessonID, 'lessonID', req.t );
		validateObjectId( namespaceID, 'namespaceID', req.t );

		const namespaceOwner = await isOwner( req, namespaceID );
		const query = {
			id: id,
			namespace: namespaceID,
			lesson: lessonID
		};
		const document = await TextEditorDocument.findOne( query );
		if ( !namespaceOwner ) {
			query.users = {
				$in: [ req.user ]
			};
		}
		document.steps = document.steps.map( json => uncompressStepJSON( json ) );
		res.json({ message: 'ok', document });
	})
);

// EXPORTS //

module.exports = router;
