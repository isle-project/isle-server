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
 *   name: Statistics
 *   description: ISLE instance statistics.
 */


// MODULES //

const router = require( 'express' ).Router();
const responseTime = require( 'response-time' );
const objectKeys = require( '@stdlib/utils/keys' );
const incrcount = require( '@stdlib/stats/incr/count' );
const incrmean = require( '@stdlib/stats/incr/mean' );
const passport = require( './passport.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const Event = require( './models/event.js' );
const User = require( './models/user.js' );
const Cohort = require( './models/cohort.js' );
const File = require( './models/file.js' );
const Lesson = require( './models/lesson.js' );
const Ticket = require( './models/ticket.js' );
const Namespace = require( './models/namespace.js' );
const SessionData = require( './models/session_data.js' );
const OverviewStatistics = require( './models/overview_statistics.js' );
const mongooseConnection = require( './connect_mongoose.js' );


// VARIABLES //

const RE_SKIPPED_REQUESTS = /(?:\.|thumbnail|avatar)/;


// MAIN //

const REQUEST_STATISTICS = {};
router.use( responseTime(function onRequest( req, res, time ) {
	const stat = req.path;
	if ( !RE_SKIPPED_REQUESTS.test( stat ) ) {
		if ( !REQUEST_STATISTICS[ stat ] ) {
			REQUEST_STATISTICS[ stat ] = {
				count: incrcount(),
				mean: incrmean()
			};
		}
		REQUEST_STATISTICS[ stat ].count( time );
		REQUEST_STATISTICS[ stat ].mean( time );
	}
}) );

/**
 * @openapi
 *
 * /admin_overview_statistics:
 *   get:
 *     summary: Get the overview statistics.
 *     description: Get the overview statistics for the ISLE instance.
 *     tags: [Statistics]
 *     security:
 *       - JWT: []
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
 *                 statistics:
 *                   description: Overview Statistics
 *                   type: object
 *                   properties:
 *                     nUsers:
 *                       type: integer
 *                       description: Number of users
 *                       example: 197
 *                     nInstructors:
 *                       type: integer
 *                       description: Number of instructors
 *                       example: 1
 *                     nLessons:
 *                       type: integer
 *                       description: Number of lessons
 *                       example: 23
 *                     nCohorts:
 *                       type: integer
 *                       description: Number of cohorts
 *                       example: 7
 *                     nNamespaces:
 *                       type: integer
 *                       description: Number of namespaces
 *                       example: 3
 *                     nSessionData:
 *                       type: integer
 *                       description: Number of session data
 *                       example: 1291
 *                     nEvents:
 *                       type: integer
 *                       description: Number of events
 *                       example: 20
 *                     nFiles:
 *                       type: integer
 *                       description: Number of files
 *                       example: 93
 *                     nTickets:
 *                       type: integer
 *                       description: Number of tickets
 *                       example: 9
 *                     database:
 *                       type: object
 *                       description: Database statistics
 *                     dailyActiveUsers:
 *                       type: integer
 *                       description: Daily active users
 *                       example: 12
 *                     weeklyActiveUsers:
 *                       type: integer
 *                       description: Weekly active users
 *                       example: 40
 *                     monthlyActiveUsers:
 *                       type: integer
 *                       description: Monthly active users
 *                       example: 80
 *                     lastHourActiveUsers:
 *                       type: integer
 *                       description: Last hour active users
 *                       example: 10
 *                     actionTypes:
 *                       type: object
 *                       description: Number of actions by type.
 *                       default: {}
 *       403:
 *         description: Access denied for non-administrators
 */
router.get( '/admin_overview_statistics',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onOverviewStatistics( req, res ) {
		const isAdmin = req.user.administrator;
		if ( !isAdmin ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		const nUsers = await User.estimatedDocumentCount();
		const nInstructors = await User.countDocuments({
			writeAccess: true
		});
		const nLessons = await Lesson.estimatedDocumentCount();
		const nCohorts = await Cohort.estimatedDocumentCount();
		const nNamespaces = await Namespace.estimatedDocumentCount();
		const nEvents = await Event.estimatedDocumentCount();
		const nFiles = await File.estimatedDocumentCount();
		const nSessionData = await SessionData.estimatedDocumentCount();
		const nTickets = await Ticket.estimatedDocumentCount();
		const database = await mongooseConnection.db.stats();

		const currentDate = new Date();

		const lastWeek = new Date( currentDate.getTime() );
		lastWeek.setDate( currentDate.getDate() - 7 );

		const lastMonth = new Date( currentDate.getTime() );
		lastMonth.setDate( currentDate.getDate() - 30 );

		const yesterday = new Date( currentDate.getTime() );
		yesterday.setDate( currentDate.getDate() - 1 );

		const lastHour = new Date( currentDate.getTime() );
		lastHour.setHours( currentDate.getHours() - 1 );

		const monthlyActiveUsers = await User.countDocuments({
			updatedAt: { $gte: lastMonth }
		});
		const weeklyActiveUsers = await User.countDocuments({
			updatedAt: { $gte: lastWeek }
		});
		const dailyActiveUsers = await User.countDocuments({
			updatedAt: { $gte: yesterday }
		});
		const lastHourActiveUsers = await User.countDocuments({
			updatedAt: { $gte: lastHour }
		});
		const actionTypes = await SessionData.aggregate([
			{
				$group: {
					_id: {
						type: '$data.type'
					},
					count: { $sum: 1 }
				}
			},
			{
				$project: {
					subDoc: '$type.type',
					count: '$count'
				}
			},
			{
				$sort: {
					count: -1
				}
			}
		]);
		res.json({
			message: 'ok',
			statistics: {
				nUsers,
				nInstructors,
				nLessons,
				nCohorts,
				nNamespaces,
				nSessionData,
				nEvents,
				nFiles,
				nTickets,
				database,
				dailyActiveUsers,
				weeklyActiveUsers,
				monthlyActiveUsers,
				lastHourActiveUsers,
				actionTypes
			}
		});
	})
);

/**
 * @openapi
 *
 * /admin_historical_overview_statistics:
 *   get:
 *     summary: Historical overview statistics
 *     description: Get historical overview statistics.
 *     tags: [Statistics]
 *     security:
 *       - JWT: []
 *     responses:
 *       200:
 *         description: Historical overview statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Status message
 *                   example: ok
 *                 statistics:
 *                   type: array
 *                   description: Historical overview statistics
 *                   items:
 *                     $ref: '#/components/schemas/OverviewStatistics'
 *       403:
 *         description: Access denied for non-administrators
 */
router.get( '/admin_historical_overview_statistics',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onOverviewStatistics( req, res ) {
		const isAdmin = req.user.administrator;
		if ( !isAdmin ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		const statistics = await OverviewStatistics.find();
		res.json({
			message: 'ok',
			statistics
		});
	})
);

/**
 * @openapi
 *
 * /admin_request_statistics:
 *   get:
 *     summary: Get request statistics
 *     description: Get request statistics.
 *     tags: [Statistics]
 *     security:
 *       - JWT: []
 *     responses:
 *       200:
 *         description: Request statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Status message
 *                   example: ok
 *                 statistics:
 *                   type: array
 *                   description: Request statistics
 *                   items:
 *                     type: object
 *                     properties:
 *                       request:
 *                         type: string
 *                         description: Request path
 *                       count:
 *                         type: integer
 *                         description: Number of requests
 *                       mean:
 *                         type: number
 *                         description: Mean response time (in milliseconds)
 *       403:
 *         description: Access denied for non-administrators
 */
router.get( '/admin_request_statistics',
	passport.authenticate( 'jwt', { session: false }),
	function onRequestStatistics( req, res ) {
		const isAdmin = req.user.administrator;
		if ( !isAdmin ) {
			return res.status( 403 ).send( req.t( 'access-denied' ) );
		}
		const statistics = [];
		const keys = objectKeys( REQUEST_STATISTICS );
		for ( let i = 0; i < keys.length; i++ ) {
			const key = keys[ i ];
			statistics.push({
				request: key,
				count: REQUEST_STATISTICS[ key ].count(),
				mean: REQUEST_STATISTICS[ key ].mean()
			});
		}
		res.json({
			message: 'ok',
			statistics
		});
	}
);


// EXPORTS //

module.exports = router;
