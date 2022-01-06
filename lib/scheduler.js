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

const debug = require( 'debug' )( 'scheduler' );
const setReadOnly = require( '@stdlib/utils/define-nonenumerable-read-only-property' );
const Event = require( './models/event.js' );
const User = require( './models/user.js' );
const File = require( './models/file.js' );
const Cohort = require( './models/cohort.js' );
const SessionData = require( './models/session_data.js' );
const Lesson = require( './models/lesson.js' );
const Ticket = require( './models/ticket.js' );
const Namespace = require( './models/namespace.js' );
const OverviewStatistics = require( './models/overview_statistics.js' );
const mailer = require( './mailer' );


// VARIABLES //

const EVENT_SCHEDULER_INTERVAL = 60 * 1000; // 1 minute


// FUNCTIONS //

/**
 * Triggers an event.
 *
 * @param {Object} event - event object to trigger
 */
async function triggerEvent( event ) {
	const date = new Date().getTime();
	const timeString = new Date( event.time ).toLocaleString();
	switch ( event.type ) {
		case 'unlock_lesson': {
			const { id } = event.data;
			debug( `Unlock lesson with id ${id} scheduled at ${timeString} (actual time: ${date})...` );
			const lesson = await Lesson.findOne({ '_id': id });
			if ( lesson ) {
				lesson.active = true;
				lesson.lockUntil = null;
				await lesson.save();
			}
		}
		break;
		case 'lock_lesson': {
			const { id } = event.data;
			debug( `Unlock lesson with id ${id} scheduled at ${timeString} (actual time: ${date})...` );
			const lesson = await Lesson.findOne({ '_id': id });
			if ( lesson ) {
				lesson.active = false;
				lesson.lockAfter = null;
				await lesson.save();
			}
		}
		break;
		case 'send_email': {
			const mail = event.data;
			debug( `Sending email to ${mail.to} scheduled at ${timeString} (actual time: ${date})...` );
			mailer.send( mail, debug );
		}
		break;
		case 'overview_statistics': {
			const nUsers = await User.estimatedDocumentCount();
			const nInstructors = await User.countDocuments({
				writeAccess: true
			});
			const nLessons = await Lesson.estimatedDocumentCount();
			const nCohorts = await Cohort.estimatedDocumentCount();
			const nNamespaces = await Namespace.estimatedDocumentCount();
			const nEvents = await Event.estimatedDocumentCount();
			const nFiles = await File.estimatedDocumentCount();
			const nTickets = await Ticket.estimatedDocumentCount();
			const nSessionData = await SessionData.estimatedDocumentCount();
			const nOpenTickets = await Ticket.countDocuments({
				done: false
			});
			const nClosedTickets = await Ticket.countDocuments({
				done: true
			});
			const results = await User.aggregate([
				{ $group: {
					_id: null,
					spentTime: { $sum: '$spentTime' }
				}}
			]);
			if ( results[ 0 ] ) {
				const spentTime = results[ 0 ].spentTime;
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
				const yesterday = new Date( date );
				yesterday.setDate( yesterday.getDate() - 1 );
				const dailyActiveUsers = await User.countDocuments({
					updatedAt: { $gte: yesterday }
				});
				const lastWeek = new Date( date );
				lastWeek.setDate( lastWeek.getDate() - 7 );
				const weeklyActiveUsers = await User.countDocuments({
					updatedAt: { $gte: lastWeek }
				});
				const lastMonth = new Date( date );
				lastMonth.setDate( lastMonth.getDate() - 30 );
				const monthlyActiveUsers = await User.countDocuments({
					updatedAt: { $gte: lastMonth }
				});
				const stats = new OverviewStatistics({
					nInstructors,
					nUsers,
					nLessons,
					nCohorts,
					nNamespaces,
					nSessionData,
					nEvents,
					nFiles,
					nTickets,
					nOpenTickets,
					nClosedTickets,
					actionTypes,
					dailyActiveUsers,
					weeklyActiveUsers,
					monthlyActiveUsers,
					spentTime
				});
				await stats.save();
				const admin = await User.findOne({
					administrator: true
				});
				const overviewStatsEvent = new Event({
					type: 'overview_statistics',
					time: new Date().setHours( 24, 1, 0, 0 ), // Calculate statistics one minute after next midnight...
					user: admin
				});
				await overviewStatsEvent.save();
			}
		}
		break;
	}
	event.done = true;
	event.save();
}

/**
 * Scheduler function that checks for events that need to be triggered and triggers them.
 */
async function checkEvents() {
	const date = new Date().getTime();
	const openEvents = await Event.find({
		time: { $lt: date },
		done: false
	});
	debug( `Processing ${openEvents.length} due events...` );
	for ( let i = 0; i < openEvents.length; i++ ) {
		const event = openEvents[ i ];
		await triggerEvent( event );
	}
}


// MAIN //

// Check for events that need to be triggered every minute...
setInterval( checkEvents, EVENT_SCHEDULER_INTERVAL );

const main = {};
setReadOnly( main, 'triggerEvent', triggerEvent );


// EXPORTS //

module.exports = main;
