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
 *       SketchpadOwnerData:
 *         type: object
 *         required:
 *           - lesson
 *           - id
 *           - data
 *         properties:
 *           lesson:
 *             $ref: '#/components/schemas/Lesson'
 *             description: Lesson associated with the sketchpad.
 *           id:
 *             type: string
 *             description: Unique identifier for the sketchpad.
 *           data:
 *             type: object
 *             description: Sketchpad annotation data.
 *           createdAt:
 *             type: string
 *             format: date-time
 *             description: Date and time when the sketchpad owner data was created.
 *             example: '2018-01-01T00:00:00.000Z'
 *           updatedAt:
 *             type: string
 *             format: date-time
 *             description: Date and time when the sketchpad owner data was last updated.
 *             example: '2018-01-01T00:00:00.000Z'
 */

const Schema = mongoose.Schema;

const SketchpadOwnerDataSchema = new Schema({
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

module.exports = mongoose.model( 'SketchpadOwnerData', SketchpadOwnerDataSchema );
