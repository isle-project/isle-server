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
