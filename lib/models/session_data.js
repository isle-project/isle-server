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
 *       SessionData:
 *         type: object
 *         required:
 *           - user
 *           - lesson
 *           - type
 *           - data
 *         properties:
 *           user:
 *             $ref: '#/components/schemas/User'
 *           lesson:
 *             $ref: '#/components/schemas/Lesson'
 *           type:
 *             type: string
 *             description: The type of session data.
 *           data:
 *             type: object
 *             description: Key-value pairs of session data.
 */

const Schema = mongoose.Schema;

const SessionDataSchema = new Schema({
	user: {
		'type': Schema.Types.ObjectId,
		'ref': 'User'
	},
	component: {
		'type': String,
		'required': true
	},
	componentType: {
		'type': String,
		'required': true
	},
	lesson: {
		'type': Schema.Types.ObjectId,
		'ref': 'Lesson',
		'required': true
	},
	data: {
		'type': Object,
		'required': true
	}
});


// EXPORTS //

module.exports = mongoose.model( 'SessionData', SessionDataSchema );
