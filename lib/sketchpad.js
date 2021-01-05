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
const debug = require( './debug' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const isOwner = require( './helpers/is_owner.js' );
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

router.get( '/get_sketchpad_shared_data',
	wrapAsync( async function onGetSketchpadSharedData( req, res ) {
		debug( 'Return owner annotations to visitor...' );
		validateObjectId( req.query.lessonID, 'lessonID', req.t );
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

router.get( '/get_sketchpad_user_data',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetSketchpadUserData( req, res ) {
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

router.post( '/save_sketchpad_data',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetSketchpadUserData( req, res ) {
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
