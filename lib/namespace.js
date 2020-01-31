/**
* Copyright (C) 2016-2020 The ISLE Authors
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
const uniqueValidator = require( 'mongoose-unique-validator' );
const AnnouncementSchema = require( './announcement_schema.js' );


// MAIN //

const Schema = mongoose.Schema;

const NamespaceSchema = new Schema({
	owners: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'User' }
	],
	title: {
		'type': String,
		'required': true,
		'unique': true
	},
	description: {
		'type': String,
		'required': false
	},
	announcements: {
		'type': [ AnnouncementSchema ],
		'default': []
	}
}, { timestamps: true });

NamespaceSchema.path( 'owners' ).validate( function validate( owners ) {
	if ( !owners ) {
		return false;
	}
	if ( owners.length === 0 ) {
		return false;
	}
	return true;
}, 'Namespaces need at least one owner' );

const Namespace = mongoose.model( 'Namespace', NamespaceSchema );

NamespaceSchema.plugin( uniqueValidator );


// EXPORTS //

module.exports = Namespace;
