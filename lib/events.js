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
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const Event = require( './models/event.js' );
const { triggerEvent } = require( './scheduler.js' );


// MAIN //

router.get( '/get_events',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetEvents( req, res ) {
		validateAdmin( req );

		const events = await Event
			.find({})
			.populate( 'user', [ 'name', 'email', 'picture' ] )
			.exec();
		res.json({ message: 'ok', events });
	})
);

router.post( '/delete_event',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteEvent( req, res ) {
		validateAdmin( req );
		validateObjectId( req.body.id, 'id', req.t );

		const status = await Event.deleteOne({ _id: req.body.id });
		res.json({ message: req.t( 'event-deleted' ), status });
	})
);

router.post( '/trigger_event',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onTriggerEvent( req, res ) {
		validateAdmin( req );
		validateObjectId( req.body.id, 'id', req.t );

		const event = await Event.findOne({ _id: req.body.id });
		triggerEvent( event );
		res.json({ message: req.t( 'event-successfully-triggered' ) });
	})
);


// EXPORTS //

module.exports = router;
