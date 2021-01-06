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
const validateObjectId = require( './helpers/validate_object_id.js' );
const SessionData = require( './models/session_data.js' );
const Namespace = require( './models/namespace.js' );
const Lesson = require( './models/lesson.js' );


// VARIABLES //

const MAX_NUM_ACTIONS = 50000; // Maximum number of actions retrieved by instructors when opening a lesson


// MAIN //

router.post( '/store_session_element', function onStoreSessionElement( req, res ) {
	debug( 'Should store session element...' );
	if ( req.body ) {
		const formData = req.body;
		if ( formData.type === 'action' ) {
			let sessionData;
			if ( !formData.userID ) {
				// Anonymous user:
				sessionData = new SessionData({
					data: formData.data,
					lesson: formData.lessonID,
					type: formData.type
				});
			} else {
				sessionData = new SessionData({
					data: formData.data,
					user: formData.userID,
					lesson: formData.lessonID,
					type: formData.type
				});
			}
			sessionData.save( function onSaveSessionData( err, product ) {
				if ( err ) {
					return res.status( 404 ).send( req.t( 'session-data-save-failed' ) );
				}
				res.json({
					message: req.t( 'user-action-saved' ),
					id: product._id
				});
			});
		}
	}
});

// TODO: Convert to POST request in next major update
router.get( '/delete_session_element', passport.authenticate( 'jwt', { session: false }), function onDeleteSessionElement( req, res ) {
	debug( 'Should delete session element...' );
	SessionData.findById( req.query._id, onFindSessionData );

	function onFindSessionData( err, sessionData ) {
		if ( err || !sessionData ) {
			return res.status( 404 ).send( req.t( 'session-data-nonexistent' ) );
		}

		Lesson.findById( sessionData.lesson, function onFindLesson( err, lesson ) {
			Namespace.findOne({ _id: lesson.namespace, owners: { $in: [ req.user ]}}, onNamespace );
		});

		function onNamespace( err, namespace ) {
			if ( err ) {
				return res.status( 403 ).send( req.t( 'access-denied-no-owner' ) );
			}
			if ( namespace ) {
				sessionData.remove( onRemove );
			}
		}
	}

	function onRemove( err ) {
		if ( err ) {
			return res.status( 400 ).send( req.t( 'session-data-removal-failed' ) );
		}
		res.json({ message: req.t( 'session-data-removed' ) });
	}
});

router.post( '/get_user_actions',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUserActions( req, res ) {
		validateObjectId( req.body.lessonID, 'lessonID', req.t );
		const actions = await SessionData
			.find({ type: 'action', lesson: req.body.lessonID }, null )
			.sort( '-data.absoluteTime' )
			.limit( MAX_NUM_ACTIONS )
			.exec();
		debug( `Return ${actions.length} actions to the caller` );
		res.json({
			actions: actions.map( d => {
				const out = d.data;
				out.sessiondataID = d._id;
				return out;
			})
		});
	})
);

router.get( '/get_namespace_actions',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetUserActions( req, res ) {
		validateObjectId( req.body.namespaceID, 'namespaceID', req.t );
		const lessons = await Lesson.find({ namespace: req.query.namespaceID });
		let results = [];
		for ( let i = 0; i < lessons.length; i++ ) {
			const lesson = lessons[ i ];
			let actions = await SessionData
				.find({ type: 'action', lesson: lesson }, null )
				.sort( '-data.absoluteTime' )
				.exec();
			actions = actions.map( d => {
				const data = d.data;
				data.sessiondataID = d._id;
				data.lesson = lesson.title;
				return data;
			});
			results = results.concat( actions );
		}
		res.json( results );
	})
);

router.post( '/retrieve_data',
	wrapAsync( async function onRetrieveData( req, res ) {
		debug( 'Should retrieve data...' );
		if ( req.body ) {
			let query = req.body.query;
			const data = await SessionData.find({ 'data.id': query.componentID });
			debug( 'Return found data...' );
			res.json( data );
		}
	})
);


// EXPORTS //

module.exports = router;
