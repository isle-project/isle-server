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
 *       SketchpadUserData:
 *         type: object
 *         required:
 *           - user
 *           - lesson
 *           - id
 *           - data
 *         properties:
 *           user:
 *             $ref: '#/components/schemas/User'
 *             description: User to whom the sketchpad annotations belong.
 *           lesson:
 *             $ref: '#/components/schemas/Lesson'
 *             description: Lesson to which the sketchpad belongs.
 *           id:
 *             type: string
 *             description: Unique identifier for the sketchpad.
 *           data:
 *             type: object
 *             description: Sketchpad data.
 *           createdAt:
 *             type: string
 *             format: date-time
 *             description: Date and time at which the sketchpad was created.
 *           updatedAt:
 *             type: string
 *             format: date-time
 *             description: Date and time at which the sketchpad was last updated.
 */

const Schema = mongoose.Schema;

const SketchpadUserDataSchema = new Schema({
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
	id: {
		'type': String,
		'required': true
	},
	data: {
		'type': Object,
		'required': true
	}
}, { timestamps: true });


// EXPORTS //

module.exports = mongoose.model( 'SketchpadUserData', SketchpadUserDataSchema );
