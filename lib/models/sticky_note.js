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

const Schema = mongoose.Schema;

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
