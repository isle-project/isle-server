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

const CustomUserFieldSchema = new Schema({
	name: {
		'type': String,
		'required': true
	},
	description: {
		'type': String,
		'required': true
	},
	type: {
		'type': String,
		'required': true
	},
	position: {
		'type': Number,
		'required': true
	},
	options: {
		'type': Array,
		'default': null
	},
	showOnProfile: {
		'type': Boolean,
		'default': false
	},
	editableOnSignup: {
		'type': Boolean,
		'default': false
	},
	editableOnProfile: {
		'type': Boolean,
		'default': false
	},
	userRelation: {
		'type': String,
		'enum': [ 'one', 'many' ],
		'default': null
	}
});

const CustomUserField = mongoose.model( 'CustomUserField', CustomUserFieldSchema );


// EXPORTS //

module.exports = CustomUserField;
