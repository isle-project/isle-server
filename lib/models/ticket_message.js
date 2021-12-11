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
 *       TicketMessage:
 *         type: object
 *         required:
 *           - body
 *           - author
 *           - email
 *           - picture
 *         properties:
 *           body:
 *             type: string
 *             description: The message body.
 *             example: "Hello, world!"
 *           author:
 *             type: string
 *             description: The message author.
 *             example: "Mister X"
 *           email:
 *             type: string
 *             description: The message author's email address.
 *             example: "misterx@isledocs.com"
 *           picture:
 *             type: string
 *             format: uri
 *             description: The message author's profile picture.
 *             example: "https://isledocs.com/images/misterx.jpg"
 *           attachments:
 *              type: array
 *              items:
 *                $ref: '#/components/schemas/File'
 *           createdAt:
 *             type: string
 *             format: date-time
 *             description: The date and time the message was created.
 *             example: "2016-12-31T23:59:59.999Z"
 *           updatedAt:
 *             type: string
 *             format: date-time
 *             description: The date and time the message was last updated.
 *             example: "2016-12-31T23:59:59.999Z"
 */

const Schema = mongoose.Schema;

const TicketMessageSchema = new Schema({
	body: {
		'type': String,
		'required': true
	},
	author: {
		'type': String,
		'required': true
	},
	email: {
		'type': String,
		'required': true
	},
	picture: {
		'type': String,
		'required': true
	},
	attachments: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'File' }
	]
}, { timestamps: true });


// EXPORTS //

module.exports = TicketMessageSchema;
