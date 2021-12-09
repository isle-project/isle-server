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
 *   name: Announcements
 *   description: Course announcements.
 */

// MODULES //

const router = require( 'express' ).Router();
const passport = require( './passport.js' );
const debug = require( './debug' );
const validateString = require( './helpers/validate_string.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const Namespace = require( './models/namespace.js' );


// MAIN //

/**
 * @openapi
 *
 * /new_announcement:
 *   post:
 *     summary: Create announcement.
 *     description: Create a new announcement.
 *     tags: [Announcements]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               namespaceName:
 *                 type: string
 *                 description: Name of the namespace to which the announcement belongs.
 *                 example: "my-namespace"
 *               announcement:
 *                 $ref: '#/components/schemas/Announcement'
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message.
 */
router.post( '/new_announcement',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function newAnnouncement( req, res ) {
		const { namespaceName, announcement } = req.body;
		validateString( namespaceName, 'namespaceName', req.t );
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		namespace.announcements.unshift( announcement );
		await namespace.save();
		res.json({ message: req.t( 'announcement-added' ) });
	})
);

/**
 * @openapi
 *
 * /edit_announcement:
 *   post:
 *     summary: Edit announcement.
 *     description: Edit an announcement.
 *     tags: [Announcements]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               namespaceName:
 *                 type: string
 *                 description: Name of the namespace to which the announcement belongs.
 *                 example: "my-namespace"
 *               announcement:
 *                 $ref: '#/components/schemas/Announcement'
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message.
 */
router.post( '/edit_announcement',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function editAnnouncement( req, res ) {
		const { namespaceName, announcement } = req.body;
		validateString( namespaceName, 'namespaceName', req.t );
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		debug( 'Search through announcements for matches...' );
		for ( let i = 0; i < namespace.announcements.length; i++ ) {
			const val = namespace.announcements[ i ];
			if ( val.createdAt === Number( announcement.createdAt ) ) {
				debug( 'Found announcement to be edited...' );
				namespace.announcements[ i ] = announcement;
			}
		}
		await namespace.save();
		res.json({ message: req.t( 'announcement-updated' ) });
	})
);

/**
 * @openapi
 *
 * /delete_announcement:
 *   post:
 *     summary: Delete announcement.
 *     description: Delete an announcement.
 *     tags: [Announcements]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               namespaceName:
 *                 type: string
 *                 description: Name of the namespace to which the announcement belongs.
 *                 example: "my-namespace"
 *               createdAt:
 *                 type: string
 *                 description: Date of the announcement.
 *                 example: "2017-01-01T00:00:00.000Z"
 *     responses:
 *       200:
 *         description: Success.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message.
 */
router.post( '/delete_announcement',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function deleteAnnouncement( req, res ) {
		const { namespaceName, createdAt } = req.body;
		validateString( namespaceName, 'namespaceName', req.t );
		const namespace = await Namespace.findOne({
			title: namespaceName,
			owners: {
				$in: [ req.user ]
			}
		});
		namespace.announcements = namespace.announcements.filter( x => {
			return x.createdAt !== Number( createdAt );
		});
		await namespace.save();
		res.json({ message: req.t( 'announcement-deleted' ) });
	})
);


// EXPORTS //

module.exports = router;
