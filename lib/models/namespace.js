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
const AnnouncementSchema = require( './announcement.js' );


// MAIN //

/**
 * @openapi
 *
 *   components:
 *     schemas:
 *       Namespace
 *         type: object
 *         required:
 *           - title
 *           - description
 *         properties:
 *           title:
 *             type: string
 *             description: Title of the namespace (has to be unique, be at least three characters long and not contain any spaces).
 *             example: "36-200"
 *           description:
 *             type: string
 *             description: Description of the namespace (at least three characters long).
 *             example: "Reasoning with Data"
 *           enableTicketing
 *             type: boolean
 *             description: Whether or not to enable ticketing for this namespace.
 *             example: true
 *             default: false
 *           announcements:
 *             type: array
 *             description: Array of announcements for this namespace.
 *             items:
 *               $ref: '#/components/schemas/Announcement'
 *             default: []
 *           owners:
 *             type: array
 *             description: Array of users that are owners of this namespace.
 *             items:
 *               $ref: '#/components/schemas/User'
 *           lessons:
 *             type: array
 *             description: Array of lessons belonging to this namespace.
 *             items:
 *               $ref: '#/components/schemas/Lesson'
 *           createdAt:
 *             type: string
 *             format: date-time
 *             description: Date and time when the namespace was created.
 *             example: "2018-01-01T00:00:00.000Z"
 *           updatedAt:
 *             type: string
 *             format: date-time
 *             description: Date and time when the namespace was last updated.
 *             example: "2018-01-01T00:00:00.000Z"
 */

const Schema = mongoose.Schema;

const NamespaceSchema = new Schema({
	owners: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'User' }
	],
	lessons: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'Lesson' }
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
	enableTicketing: {
		'type': Boolean,
		'default': false
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

NamespaceSchema.pre( 'save', function save( next ) {
	const namespace = this; //eslint-disable-line
	if ( namespace.isNew ) {
		mongoose.models.Namespace.countDocuments({
			title: namespace.title
		}, function onResult( err, count ) {
			if ( err ) {
				return next( err );
			}
			if ( count > 0 ) {
				return next( new Error( 'A namespace with this title already exists.' ) );
			}
			next();
		});
	} else {
		next();
	}
});

const Namespace = mongoose.model( 'Namespace', NamespaceSchema );


// EXPORTS //

module.exports = Namespace;
