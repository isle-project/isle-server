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
 *   name: Badges
 *   description: Badges are used to track the progress of a user.
 */


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

/**
 * @openapi
 *
 * /get_available_badges:
 *   get:
 *     description: Returns a list of all available badges.
 *     responses:
 *       200:
 *         description: A list of badges.
 *         content:
 *           application/json:
 *             schema:
 *             type: array
 */
router.get( '/get_available_badges', function onBadges( req, res ) {
	res.json( badges );
});

/**
 * @openapi
 *
 * /get_user_badges:
 *   get:
 *     description: Returns a list of all badges a user has earned.
 *     responses:
 *       200:
 *         description: A list of badges.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 badges:
 *                   type: array
 *                   description: A list of badges.
 *                 addedBadges:
 *                   type: array
 *                   description: A list of badges that have been added to the user's list.
 */
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
