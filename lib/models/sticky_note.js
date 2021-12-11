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


// VARIABLES //

const Schema = mongoose.Schema;

/**
 * @openapi
 *
 *   components:
 *     schemas:
 *       StickyNoteSize:
 *         type: object
 *         required:
 *           - width
 *           - height
 *         properties:
 *           width:
 *             type: integer
 *             example: 400
 *           height:
 *             type: integer
 *             example: 200
 */

const SizeSchema = new Schema({
	width: {
		'type': Number,
		'required': true
	},
	height: {
		'type': Number,
		'required': true
	}
});


// MAIN //

/**
 * @openapi
 *
 *   components:
 *     schemas:
 *       StickyNote:
 *         type: object
 *         required:
 *           - left
 *           - top
 *           - user
 *           - lesson
 *         properties:
 *           title:
 *             type: string
 *             description: "The title of the sticky note."
 *             example: "Hello World"
 *             default: ""
 *           body:
 *             type: string
 *             description: "The body of the sticky note."
 *             example: "This is a sticky note."
 *             default: ""
 *           left:
 *             type: number
 *             description: "The x-coordinate of the top-left corner of the sticky note."
 *             example: 45
 *           top:
 *             type: number
 *             description: "The y-coordinate of the top-left corner of the sticky note."
 *             example: 90
 *           size:
 *             $ref: '#/components/schemas/StickyNoteSize'
 *             description: "The size of the sticky note."
 *             example: { width: 100, height: 100 }
 *           user:
 *             $ref: '#/components/schemas/User'
 *             description: "The user who created the sticky note."
 *           lesson:
 *             $ref: '#/components/schemas/Lesson'
 *             description: "The lesson to which the sticky note belongs."
 *           visibility:
 *             type: string
 *             description: "The visibility of the sticky note."
 *             example: "public"
 *             enum: [ "public", "private", "instructor" ]
 *             default: "private"
 *           createdAt:
 *             type: string
 *             format: date-time
 *             description: "The date and time when the sticky note was created."
 *             example: "2018-01-01T00:00:00.000Z"
 *           updatedAt:
 *             type: string
 *             format: date-time
 *             description: "The date and time when the sticky note was last updated."
 *             example: "2018-01-01T00:00:00.000Z"
 */

const StickyNoteSchema = new Schema({
	title: {
		'type': String,
		'default': ''
	},
	body: {
		'type': String,
		'default': ''
	},
	left: {
		'type': Number,
		'required': true
	},
	top: {
		'type': Number,
		'required': true
	},
	size: {
		'type': SizeSchema,
		'default': {
			'width': 300,
			'height': 300
		}
	},
	user: {
		'type': Schema.Types.ObjectId,
		'ref': 'User',
		'required': true
	},
	lesson: {
		'type': Schema.Types.ObjectId,
		'ref': 'Lesson',
		'required': true
	},
	visibility: {
		'type': String,
		'enum': [ 'private', 'public', 'instructor' ],
		'default': 'private'
	}
}, { timestamps: true });

const StickyNote = mongoose.model( 'StickyNote', StickyNoteSchema );


// EXPORTS //

module.exports = StickyNote;
