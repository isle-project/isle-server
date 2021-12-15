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

/**
 * @openapi
 *
 * tags:
 *   name: StickyNotes
 *   description: Sticky Notes management.
 */

// MODULES //

const router = require( 'express' ).Router();
const isString = require( '@stdlib/assert/is-string' ).isPrimitive;
const isNumber = require( '@stdlib/assert/is-number' ).isPrimitive;
const isObject = require( '@stdlib/assert/is-object' );
const passport = require( './passport.js' );
const debug = require( './debug' );
const isOwner = require( './helpers/is_owner.js' );
const ErrorStatus = require( './helpers/error.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const StickyNote = require( './models/sticky_note.js' );


// MAIN //

/**
 * @openapi
 *
 * /get_sticky_notes:
 *   get:
 *     summary: Get sticky notes
 *     description: Get all sticky notes for a lesson.
 *     tags: [StickyNotes]
 *     security:
 *       - JWT: []
 *     parameters:
 *       - in: query
 *         name: lessonID
 *         description: ID of the lesson
 *         required: true
 *         schema:
 *           type: ObjectId
 *       - in: query
 *         name: namespaceID
 *         description: ID of the namespace
 *         required: true
 *         schema:
 *           type: ObjectId
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: ok
 *                 notes:
 *                   type: array
 *                   description: Array of sticky notes
 *                   items:
 *                     $ref: '#/components/schemas/StickyNote'
 */
router.get( '/get_sticky_notes',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetStickyNotes( req, res ) {
		const owner = await isOwner( req, req.query.namespaceID );
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

/**
 * @openapi
 *
 * /save_sticky_note:
 *   post:
 *     summary: Save sticky note
 *     description: Save a sticky note for a lesson.
 *     tags: [StickyNotes]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the sticky note
 *                 example: "Sticky Note Title"
 *               body:
 *                 type: string
 *                 description: Body of the sticky note
 *                 example: "Sticky Note Body"
 *               visibility:
 *                 type: string
 *                 description: Visibility of the sticky note
 *                 enum: [ "public", "private", "instructor" ]
 *                 example: "public"
 *               left:
 *                 type: number
 *                 description: "The x-coordinate of the top-left corner of the sticky note."
 *                 example: 45
 *               top:
 *                 type: number
 *                 description: "The y-coordinate of the top-left corner of the sticky note."
 *                 example: 90
 *               lessonID:
 *                 type: ObjectId
 *                 description: ID of the lesson
 *                 example: "5b8f8f8f8f8f8f8f8f8f8f"
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: ok
 *                 note:
 *                   description: Saved sticky note
 *                   $ref: '#/components/schemas/StickyNote'
 */
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

/**
 * @openapi
 *
 * /update_sticky_note:
 *   post:
 *     summary: Update sticky note
 *     description: Update a sticky note for a lesson.
 *     tags: [StickyNotes]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - noteID
 *               - namespaceID
 *             properties:
 *               noteID:
 *                 type: ObjectId
 *                 description: ID of the sticky note
 *                 example: "61ba158c908dc8b2a65e5d09"
 *               namespaceID:
 *                 type: ObjectId
 *                 description: ID of the namespace
 *                 example: "61ba1593354c9527064ba22c"
 *               title:
 *                 type: string
 *                 description: Title of the sticky note
 *                 example: "Sticky Note Title"
 *               body:
 *                 type: string
 *                 description: Body of the sticky note
 *                 example: "Sticky Note Body"
 *               left:
 *                 type: number
 *                 description: "The x-coordinate of the top-left corner of the sticky note."
 *                 example: 45
 *               top:
 *                 type: number
 *                 description: "The y-coordinate of the top-left corner of the sticky note."
 *                 example: 90
 *               size:
 *                 description: "The width and height of the sticky note."
 *                 $ref: '#/components/schemas/StickyNoteSize'
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: ok
 *                 note:
 *                   description: Updated sticky note
 *                   $ref: '#/components/schemas/StickyNote'
 *       403:
 *         description: Access denied due to not being the creator of the sticky note or owner of the namespace
 *         content:
 *           text/plain:
 *             Access denied
 */
router.post( '/update_sticky_note',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onUpdateStickyNote( req, res ) {
		debug( 'Should update sticky note...' );
		const note = await StickyNote.findById( req.body.noteID );
		const owner = await isOwner( req, req.body.namespaceID );
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
		if ( isObject( req.body.size ) ) {
			note.size = req.body.size;
		}
		await note.save();
		res.json({
			message: 'ok',
			note
		});
	})
);

/**
 * @openapi
 *
 * /delete_sticky_note:
 *   post:
 *     summary: Delete sticky note
 *     description: Delete a sticky note for a lesson.
 *     tags: [StickyNotes]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - noteID
 *               - namespaceID
 *             properties:
 *               noteID:
 *                 type: ObjectId
 *                 description: ID of the sticky note
 *                 example: "61ba1467142bba7b1b879871"
 *               namespaceID:
 *                 type: ObjectId
 *                 description: ID of the namespace
 *                 example: "61ba146d37bab9461759dc8c"
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: ok
 *       403:
 *         description: Access denied due to not being the creator of the sticky note or owner of the namespace
 *         content:
 *           text/plain:
 *             Access denied
 */
router.post( '/delete_sticky_note',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteStickyNote( req, res ) {
		const owner = await isOwner( req, req.body.namespaceID );
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
