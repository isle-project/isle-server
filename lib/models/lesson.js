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

const LessonSchema = new Schema({
	namespace: {
		'type': Schema.Types.ObjectId,
		'ref': 'Namespace',
		'required': true
	},
	title: {
		'type': String,
		'required': true
	},
	description: {
		'type': String,
		'required': false,
		'default': 'No description supplied.'
	},
	active: {
		'type': Boolean,
		'required': false,
		'default': true
	},
	public: {
		'type': Boolean,
		'required': false,
		'default': false
	},
	lockUntil: {
		'type': Schema.Types.ObjectId,
		'ref': 'Event',
		'required': false
	},
	metadata: {
		'type': Object,
		'required': false
	}
}, { timestamps: true });


// EXPORTS //

module.exports = mongoose.model( 'Lesson', LessonSchema );
