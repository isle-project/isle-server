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
