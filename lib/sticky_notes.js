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
const isString = require( '@stdlib/assert/is-string' ).isPrimitive;
const isNumber = require( '@stdlib/assert/is-number' ).isPrimitive;
const passport = require( './passport' );
const debug = require( './debug' );
const isOwner = require( './helpers/is_owner.js' );
const ErrorStatus = require( './helpers/error.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const StickyNote = require( './models/sticky_note.js' );


// MAIN //

router.get( '/get_sticky_notes',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetStickyNotes( req, res ) {
		const owner = await isOwner( req.user, req.query.namespaceID );
		const query = [
			{
				lesson: req.query.lessonID,
				user: req.user._id
			},
			{
				lesson: req.query.lessonID,
				visibility: 'public'
			}
		];
		if ( owner ) {
			query.push({
				lesson: req.query.lessonID,
				visibility: 'instructor'
			});
		}
		const notes = await StickyNote.find({
			$or: query
		});
		res.json({
			message: 'ok',
			notes
		});
	})
);

router.post( '/save_sticky_note',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onSaveStickyNote( req, res ) {
		debug( 'Should save sticky note...' );
		const note = new StickyNote({
			title: req.body.title,
			body: req.body.body,
			visibility: req.body.visibility,
			left: req.body.left,
			top: req.body.top,
			lesson: req.body.lessonID,
			user: req.user._id
		});
		await note.save();
		res.json({
			message: 'ok',
			note
		});
	})
);

router.post( '/update_sticky_note',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateStickyNote( req, res ) {
		debug( 'Should update sticky note...' );
		const note = await StickyNote.findById( req.body.noteID );
		const owner = await isOwner( req.user, req.body.namespaceID );
		if ( note.user !== req.user._id && !owner ) {
			throw new ErrorStatus( 403, req.t( 'access-denied' ) );
		}
		if ( isString( req.body.title ) ) {
			note.title = req.body.title;
		}
		if ( isString( req.body.body ) ) {
			note.body = req.body.body;
		}
		if ( isNumber( req.body.left ) ) {
			note.left = req.body.left;
		}
		if ( isNumber( req.body.top ) ) {
			note.top = req.body.top;
		}
		await note.save();
		res.json({
			message: 'ok',
			note
		});
	})
);

router.post( '/delete_sticky_note',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteStickyNote( req, res ) {
		const owner = await isOwner( req.user, req.body.namespaceID );
		const note = await StickyNote.findById( req.body.noteID );
		if ( note.user !== req.user._id && !owner ) {
			throw new ErrorStatus( 403, req.t( 'access-denied' ) );
		}
		await note.remove();
		res.json({
			message: 'ok'
		});
	})
);


// EXPORTS //

module.exports = router;
