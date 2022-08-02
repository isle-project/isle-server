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
const CompletionMetricSchema = require( './completion_metric.js' );


// MAIN //

/**
 * @openapi
 *
 *   components:
 *     schemas:
 *       Lesson:
 *         type: object
 *         required:
 *           - namespace
 *           - title
 *         properties:
 *           namespace:
 *             $ref: '#/components/schemas/Namespace'
 *             description: The namespace in which the lesson is located.
 *           title:
 *             type: string
 *             description: Title of the lesson.
 *           description:
 *             type: string
 *             description: Description of the lesson.
 *             example: "This is a lesson about the history of the world."
 *             default: "No description supplied."
 *           active:
 *             type: boolean
 *             description: Whether or not the lesson is active.
 *             default: true
 *             example: false
 *           hideFromDashboard:
 *             type: boolean
 *             description: Whether lesson can be accessed by users and is visible in the dashboard for users enrolled in the namespace.
 *             default: false
 *             example: true
 *           public:
 *             type: boolean
 *             description: Whether lesson should be visible in the gallery for other users with writeAccess (instructors etc.).
 *             default: false
 *             example: true
 *           lockAfter:
 *             $ref: '#/components/schemas/Event'
 *             description: When the lesson should be locked after the specified event, i.e. be set from active to inactive.
 *             default: null
 *           lockUntil:
 *             $ref: '#/components/schemas/Event'
 *             description: When the lesson should be unlocked after the specified event, i.e. be set from inactive to active.
 *             default: null
 *           metadata:
 *             type: object
 *             description: Additional metadata for the lesson.
 *           template:
 *             type: boolean
 *             description: Whether the lesson can be used as a template for other lessons.
 *             default: false
 *             example: true
 *           createdAt:
 *             type: string
 *             format: date-time
 *             description: Date and time when the lesson was created.
 *             example: "2018-01-01T00:00:00.000Z"
 *           updatedAt:
 *             type: string
 *             format: date-time
 *             description: Date and time when the lesson was last updated.
 *             example: "2018-01-01T00:00:00.000Z"
 */

const Schema = mongoose.Schema;

const LessonSchema = new Schema({
	namespace: {
		'type': Schema.Types.ObjectId,
		'ref': 'Namespace',
		'required': true
	},
	title: {
		'type': String,
		'required': true
	},
	description: {
		'type': String,
		'required': false,
		'default': 'No description supplied.'
	},
	active: {
		'type': Boolean,
		'required': false,
		'default': true
	},
	hideFromDashboard: {
		'type': Boolean,
		'required': false,
		'default': false
	},
	public: {
		'type': Boolean,
		'required': false,
		'default': false
	},
	lockAfter: {
		'type': Schema.Types.ObjectId,
		'ref': 'Event',
		'required': false
	},
	lockUntil: {
		'type': Schema.Types.ObjectId,
		'ref': 'Event',
		'required': false
	},
	metadata: {
		'type': Object,
		'required': false
	},
	tag: {
		'type': String,
		'required': false,
		'default': '_default_tag'
	},
	template: {
		'type': Boolean,
		'required': false,
		'default': false
	},
	completions: {
		'type': [ CompletionMetricSchema ],
		'required': false,
		'default': []
	}
}, { timestamps: true });


// EXPORTS //

module.exports = mongoose.model( 'Lesson', LessonSchema );
