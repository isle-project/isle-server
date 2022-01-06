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
 *       Event:
 *         type: object
 *         required:
 *           - time
 *           - type
 *         properties:
 *           time:
 *             type: integer
 *             description: Time when event should occur (in milliseconds since the epoch).
 *           type:
 *             type: string
 *             description: Type of event.
 *           data:
 *             type: object
 *             description: Event-specific data.
 *             default: {}
 *           done:
 *             type: boolean
 *             description: Whether or not the event has been processed.
 *             default: false
 *           user:
 *             $ref: '#/components/schemas/User'
 */

const Schema = mongoose.Schema;

const EventSchema = new Schema({
	time: {
		'type': Number,
		'required': true
	},
	type: {
		'type': String,
		'required': true
	},
	data: {
		'type': Object,
		'required': false,
		'default': {}
	},
	done: {
		'type': Boolean,
		'default': false
	},
	user: {
		'type': Schema.Types.ObjectId,
		'ref': 'User'
	}
});

const Event = mongoose.model( 'Event', EventSchema );


// EXPORTS //

module.exports = Event;
