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
 *   name: Sketchpad
 *   description: Sketchpad operations.
 */


// MODULES //

const router = require( 'express' ).Router();
const debug = require( './debug' )( 'server:sketchpad' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const isOwner = require( './helpers/is_owner.js' );
const validateString = require('./helpers/validate_string');
const validateObject = require( './helpers/validate_object.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const SketchpadUserData = require( './models/sketchpad_user_data.js' );
const SketchpadOwnerData = require( './models/sketchpad_owner_data.js' );


// FUNCTIONS //

function harmonizeSketchpadElements( userElements, nUndos, userPages = [], ownerPages = [] ) {
	userPages = userPages.map( x => x.page );
	ownerPages = ownerPages.map( x => x.page );

	for ( let i = 0; i < userPages.length; i++ ) {
		const page = userPages[ i ];
		if ( !ownerPages.includes( page ) ) {
			debug( 'Removing elements from page '+page );
			userElements.splice( page, 1 );
			nUndos.splice( page, 1 );
		}
	}
	for ( let i = 0; i < ownerPages.length; i++ ) {
		const page = ownerPages[ i ];
		if ( !userPages.includes( page ) ) {
			debug( 'Adding an empty page at position '+page );
			userElements.splice( page, 0, [] );
			nUndos.splice( page, 0, 0 );
		}
	}
}


// MAIN //

/**
 * @openapi
 *
 * /get_sketchpad_shared_data:
 *   get:
 *     summary: Get shared sketchpad data
 *     description: Get shared sketchpad data.
 *     tags: [Sketchpad]
 *     parameters:
 *       - in: query
 *         name: lessonID
 *         description: ID of the lesson the sketchpad belongs to
 *         schema:
 *           type: ObjectId
 *         required: true
 *       - in: query
 *         name: sketchpadID
 *         description: ID of the sketchpad in the lesson
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               description: Shared sketchpad data
 *               type: object
 */
router.get( '/get_sketchpad_shared_data',
	wrapAsync( async function onGetSketchpadSharedData( req, res ) {
		debug( 'Return owner annotations to visitor...' );
		validateObjectId( req.query.lessonID, 'lessonID', req.t );
		validateString( req.query.sketchpadID, 'sketchpadID', req.t );

		const ownerTable = await SketchpadOwnerData.findOne({
			lesson: req.query.lessonID,
			id: req.query.sketchpadID
		});
		let sharedElements;
		let ownerState;
		let noPages;
		if ( !ownerTable ) {
			return res.json( null );
		}
		ownerState = ownerTable.data.state;
		noPages = ownerState.noPages;
		sharedElements = new Array( noPages );
		for ( let i = 0; i < noPages; i++ ) {
			sharedElements[ i ] = [];
			const { data } = ownerTable;
			const ownerElements = data.elements[ i ];
			const len = ownerElements.length - ownerTable.data.nUndos[ i ];
			for ( let j = 0; j < len; j++ ) {
				sharedElements[ i ].push( ownerElements[ j ] );
			}
		}
		const out = {
			state: ownerState,
			sharedElements: sharedElements
		};
		res.json( out );
	})
);

/**
 * @openapi
 *
 * /get_sketchpad_user_data:
 *   get:
 *     summary: Get user sketchpad data
 *     description: Get specified sketchpad data.
 *     tags: [Sketchpad]
 *     security:
 *       - JWT: []
 *     parameters:
 *       - in: query
 *         name: lessonID
 *         description: ID of the lesson the sketchpad belongs to
 *         schema:
 *           type: ObjectId
 *         required: true
 *       - in: query
 *         name: namespaceID
 *         description: ID of the namespace containing the lesson the sketchpad belongs to
 *         schema:
 *           type: ObjectId
 *         required: true
 *       - in: query
 *         name: sketchpadID
 *         description: ID of the sketchpad in the lesson
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: User sketchpad data
 */
router.get( '/get_sketchpad_user_data',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetSketchpadUserData( req, res ) {
		validateObjectId( req.query.namespaceID, 'namespaceID', req.t );
		validateObjectId( req.query.lessonID, 'lessonID', req.t );
		validateString( req.query.sketchpadID, 'sketchpadID', req.t );

		const owner = await isOwner( req, req.query.namespaceID );
		debug( owner ? 'User is an owner' : 'User is not an owner' );
		if ( owner ) {
			// Case: User is an owner...
			const val = await SketchpadOwnerData.findOne({
				lesson: req.query.lessonID,
				id: req.query.sketchpadID
			});
			if ( !val ) {
				return res.json( null );
			}
			return res.json( val.data );
		}
		// Case: User is not an owner:
		const userTable = await SketchpadUserData.findOne({
			lesson: req.query.lessonID,
			id: req.query.sketchpadID,
			user: req.user
		});
		const ownerTable = await SketchpadOwnerData.findOne({
			lesson: req.query.lessonID,
			id: req.query.sketchpadID
		});
		let sharedElements;
		let ownerState;
		let noPages;
		if ( ownerTable ) {
			ownerState = ownerTable.data.state;
			noPages = ownerState.noPages;
			sharedElements = new Array( noPages );
			for ( let i = 0; i < noPages; i++ ) {
				sharedElements[ i ] = [];
				const { data } = ownerTable;
				const ownerElements = data.elements[ i ];
				const len = ownerElements.length - ownerTable.data.nUndos[ i ];
				for ( let j = 0; j < len; j++ ) {
					sharedElements[ i ].push( ownerElements[ j ] );
				}
			}
		}
		if ( !sharedElements && !userTable ) {
			return res.json( null );
		}
		const out = {};
		if ( userTable ) {
			out.elements = userTable.data.elements;
			out.state = ownerState || userTable.data.state;
			out.nUndos = userTable.data.nUndos;
			out.sharedElements = sharedElements || null;
			if ( out.sharedElements && out.elements ) {
				out.state.noPages = noPages;
				out.state.insertedPages = ownerTable.data.state.insertedPages;
				harmonizeSketchpadElements(
					out.elements,
					out.nUndos,
					userTable.data.state.insertedPages,
					ownerTable.data.state.insertedPages
				);
			}
		} else {
			out.state = ownerState;
			out.sharedElements = sharedElements;
		}
		res.json( out );
	})
);

/**
 * @openapi
 *
 * /save_sketchpad_data:
 *   post:
 *     summary: Save sketchpad data
 *     description: Save specified sketchpad data.
 *     tags: [Sketchpad]
 *     security:
 *       - JWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lessonID:
 *                 type: ObjectId
 *                 description: ID of the lesson the sketchpad belongs to
 *               namespaceID:
 *                 type: ObjectId
 *                 description: ID of the namespace containing the lesson the sketchpad belongs to
 *               sketchpadID:
 *                 type: string
 *                 description: ID of the sketchpad in the lesson
 *     responses:
 *       200:
 *         description: Successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: "User data saved"
 */
router.post( '/save_sketchpad_data',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetSketchpadUserData( req, res ) {
		validateObjectId( req.body.namespaceID, 'namespaceID', req.t );
		validateObjectId( req.body.lessonID, 'lessonID', req.t );
		validateString( req.body.sketchpadID, 'sketchpadID', req.t );
		validateObject( req.body.data, 'data', req.t );

		const owner = await isOwner( req, req.body.namespaceID );
		if ( owner ) {
			debug( 'Save sketchpad data for owner...' );
			await SketchpadOwnerData.findOneAndUpdate(
				{
					lesson: req.body.lessonID,
					id: req.body.sketchpadID
				},
				{ data: req.body.data },
				{ new: true, upsert: true }
			);
			res.json({ message: req.t( 'owner-data-saved' ) });
		} else {
			debug( 'Save sketchpad data for user...' );
			await SketchpadUserData.findOneAndUpdate(
				{
					lesson: req.body.lessonID,
					id: req.body.sketchpadID,
					user: req.user
				},
				{ data: req.body.data },
				{ new: true, upsert: true }
			);
			res.json({ message: req.t( 'user-data-saved' ) });
		}
	})
);


// EXPORTS //

module.exports = router;
