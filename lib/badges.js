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
const contains = require( '@stdlib/assert/contains' );
const debug = require( './debug' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const badges = require( './badge_check/badges.json' );
const User = require( './models/user.js' );
const badgeCheck = require( './badge_check' );


// MAIN //

router.get( '/get_available_badges', function onBadges( req, res ) {
	res.json( badges );
});

router.get( '/get_user_badges',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onBadges( req, res ) {
		const user = req.user.toObject();
		const addedBadges = badgeCheck( user );
		const newUserBadges = user.badges.concat( addedBadges );
		const stats = await User.updateOne({ '_id': user._id }, {
			badges: newUserBadges
		});
		debug( 'Result: ' + JSON.stringify( stats ) );
		const acquiredBadges = badges.map( badge => {
			if ( contains( newUserBadges, badge.name ) ) {
				badge.acquired = true;
			} else {
				badge.acquired = false;
			}
			return badge;
		});
		res.json({
			badges: acquiredBadges,
			addedBadges
		});
	}
));


// EXPORTS //

module.exports = router;
