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

const mongoose = require( 'mongoose' );


// MAIN //

/**
 * @openapi
 *
 *   components:
 *     schemas:
 *       OverviewStatistics:
 *         type: object
 *         required:
 *           - nUsers
 *           - nInstructors
 *           - nLessons
 *           - nCohorts
 *           - nNamespaces
 *           - nSessionData
 *           - nEvents
 *           - nFiles
 *         properties:
 *           nUsers:
 *             type: integer
 *             description: Number of registered users.
 *             example: 191
 *           nInstructors:
 *             type: integer
 *             description: Number of registered instructors.
 *             example: 3
 *           nLessons:
 *             type: integer
 *             description: Number of lessons.
 *             example: 5
 *           nCohorts:
 *             type: integer
 *             description: Number of cohorts.
 *             example: 2
 *           nNamespaces:
 *             type: integer
 *             description: Number of namespaces.
 *             example: 2
 *           nSessionData:
 *             type: integer
 *             description: Number of session data.
 *             example: 121
 *           nEvents:
 *             type: integer
 *             description: Number of events.
 *             example: 99
 *           nFiles:
 *             type: integer
 *             description: Number of files.
 *             example: 3
 *           nTickets:
 *             type: integer
 *             description: Number of tickets.
 *             example: 3
 *             default: 0
 *           nOpenTickets:
 *             type: integer
 *             description: Number of open tickets.
 *             example: 3
 *             default: 0
 *           nClosedTickets:
 *             type: integer
 *             description: Number of closed tickets.
 *             example: 2
 *             default: 0
 *           spentTime:
 *             type: integer
 *             description: Total time spent on the platform.
 *             example: 1234
 *             default: 0
 *           dailyActiveUsers:
 *             type: integer
 *             description: Number of daily active users.
 *             example: 311
 *             default: 0
 *           weeklyActiveUsers:
 *             type: integer
 *             description: Number of weekly active users.
 *             example: 581
 *             default: 0
 *           monthlyActiveUsers:
 *             type: integer
 *             description: Number of monthly active users.
 *             example: 913
 *           actionTypes:
 *             type: object
 *             description: Number of actions by type.
 *             default: {}
 *           createdAt:
 *             type: string
 *             format: date-time
 *             description: Date when the statistics were collected.
 *             example: "2016-12-01T00:00:00.000Z"
 *           updatedAt:
 *             type: string
 *             format: date-time
 *             description: Date when the statistics object was last updated.
 *             example: "2016-12-01T00:00:00.000Z"
 */

const Schema = mongoose.Schema;

const OverviewStatistics = new Schema({
	nUsers: {
		'type': Number,
		'required': true
	},
	nInstructors: {
		'type': Number,
		'required': true
	},
	nLessons: {
		'type': Number,
		'required': true
	},
	nCohorts: {
		'type': Number,
		'required': true
	},
	nNamespaces: {
		'type': Number,
		'required': true
	},
	nSessionData: {
		'type': Number,
		'required': true
	},
	nEvents: {
		'type': Number,
		'required': true
	},
	nFiles: {
		'type': Number,
		'required': true
	},
	nTickets: {
		'type': Number,
		'default': 0
	},
	nOpenTickets: {
		'type': Number,
		'default': 0
	},
	nClosedTickets: {
		'type': Number,
		'default': 0
	},
	spentTime: {
		'type': Number,
		'default': 0
	},
	dailyActiveUsers: {
		'type': Number,
		'default': 0
	},
	weeklyActiveUsers: {
		'type': Number,
		'default': 0
	},
	monthlyActiveUsers: {
		'type': Number,
		'default': 0
	},
	actionTypes: {
		'type': Object,
		'default': {}
	}
}, { timestamps: true });


// EXPORTS //

module.exports = mongoose.model( 'OverviewStatistics', OverviewStatistics );
