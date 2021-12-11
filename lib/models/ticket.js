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
const TicketMessageSchema = require( './ticket_message.js' );


// MAIN //

/**
 * @openapi
 *
 *   components:
 *     schemas:
 *       Ticket:
 *         type: object
 *         required:
 *           - title
 *           - description
 *           - namespace
 *           - user
 *         properties:
 *           title:
 *             type: string
 *             description: Title of the ticket.
 *             example: "How to create a new ticket?"
 *           description:
 *             type: string
 *             description: Description of the ticket.
 *             example: "I want to create a new ticket so that I can help the user."
 *           component:
 *             type: string
 *             description: Component of the ticket is associated with.
 *             example: "Sketchpad"
 *             default: "General"
 *           namespace:
 *             $ref: '#/components/schemas/Namespace'
 *           lesson:
 *             $ref: '#/components/schemas/Lesson'
 *           user:
 *             $ref: '#/components/schemas/User'
 *           platform:
 *             type: object
 *             description: Platform of the user who created the ticket.
 *             default: {}
 *           done:
 *             type: boolean
 *             description: Whether the ticket has been resolved.
 *             default: false
 *           priority:
 *             type: string
 *             description: Priority of the ticket.
 *             enum: [ "Low", "Middle", "High" ]
 *             default: "Low"
 *           messages:
 *             type: array
 *             description: Messages associated with the ticket.
 *             items:
 *               $ref: '#/components/schemas/TicketMessage'
 *             default: []
 *           attachments:
 *             type: array
 *             description: Attachments associated with the ticket.
 *             items:
 *               $ref: '#/components/schemas/File'
 *           createdAt:
 *             type: string
 *             description: Date and time when the ticket was created.
 *             format: date-time
 *             example: "2018-01-01T00:00:00.000Z"
 *           updatedAt:
 *             type: string
 *             description: Date and time when the ticket was last updated.
 *             format: date-time
 *             example: "2018-01-01T00:00:00.000Z"
 */

const Schema = mongoose.Schema;

const TicketSchema = new Schema({
	title: {
		'type': String,
		'required': true
	},
	description: {
		'type': String,
		'required': true
	},
	component: {
		'type': String,
		'default': 'General'
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
	user: {
		'type': Schema.Types.ObjectId,
		'ref': 'User',
		'required': true
	},
	platform: {
		'type': Object,
		'default': {}
	},
	done: {
		'type': Boolean,
		'default': false
	},
	priority: {
		'type': String,
		'enum': [ 'Low', 'Middle', 'High' ],
		'default': 'Low'
	},
	messages: {
		'type': [ TicketMessageSchema ],
		'default': []
	},
	attachments: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'File' }
	]
}, { timestamps: true });

const Ticket = mongoose.model( 'Ticket', TicketSchema );


// EXPORTS //

module.exports = Ticket;
