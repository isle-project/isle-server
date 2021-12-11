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
 *       File:
 *         type: object
 *         required:
 *           - title
 *           - filename
 *           - path
 *           - namespace
 *           - user
 *         properties:
 *           title:
 *             type: string
 *             description: Original file name.
 *             example: "LectureNotes.pdf"
 *           filename:
 *             type: string
 *             description: Filename with namespace / lesson or digit sequence prepended.
 *             example: "1-LectureNotes.pdf"
 *           path:
 *             type: string
 *             description: Path to the file.
 *             example: "/home/user/Documents/1-LectureNotes.pdf"
 *           size:
 *             type: integer
 *             description: File size in megabyte.
 *           namespace:
 *             $ref: '#/components/schemas/Namespace'
 *             description: Namespace the file belongs to.
 *           lesson:
 *             $ref: '#/components/schemas/Lesson'
 *             description: Lesson the file belongs to (if applicable).
 *           type:
 *             type: string
 *             description: File type.
 *             example: "pdf"
 *           user:
 *             $ref: '#/components/schemas/User'
 *             description: User who uploaded the file.
 *           owner:
 *             type: boolean
 *             description: Whether the file was uploaded by a namespace owner.
 *             example: true
 *             default: false
 *           createdAt:
 *             type: string
 *             format: date-time
 *             description: Date and time the file was uploaded.
 *             example: "2018-01-01T00:00:00.000Z"
 *           updatedAt:
 *             type: string
 *             format: date-time
 *             description: Date and time the file was last updated.
 *             example: "2018-01-01T00:00:00.000Z"
 */

const Schema = mongoose.Schema;

const FileSchema = new Schema({
	title: {
		'type': String,
		'required': true
	},
	filename: {
		'type': String,
		'required': true
	},
	path: {
		'type': String,
		'required': true
	},
	size: {
		'type': Number
	},
	namespace: {
		'type': Schema.Types.ObjectId,
		'ref': 'Namespace',
		'required': true
	},
	lesson: {
		'type': Schema.Types.ObjectId,
		'ref': 'Lesson'
	},
	type: {
		'type': String
	},
	user: {
		'type': Schema.Types.ObjectId,
		'ref': 'User',
		'required': true
	},
	owner: {
		'type': Boolean,
		'required': false,
		'default': false
	}
}, { timestamps: true });

const File = mongoose.model( 'File', FileSchema );


// EXPORTS //

module.exports = File;
