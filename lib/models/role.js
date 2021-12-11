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
 *       Role:
 *         type: object
 *         properties:
 *           title:
 *             type: string
 *             description: Title of the role (unique identifier).
 *             example: "Administrator"
 *           searchContext:
 *             type: string
 *             description: Search context for the role.
 *             example: "course"
 *             enum: ["course","program","global"]
 *           createdBy:
 *             $ref: '#/components/schemas/User'
 *           authorizedRoles:
 *             description: Roles authorized to edit the role.
 *             type: array
 *             items:
 *                $ref: '#/components/schemas/Role'
 *           permissions:
 *             type: object
 *             description: Permissions associated with the role.
 *             example: { "create": true, "read": true, "update": true, "delete": true }
 *           createdAt:
 *             type: string
 *             format: date-time
 *             description: Date and time when the role was created.
 *             example: "2018-01-01T00:00:00.000Z"
 *           updatedAt:
 *             type: string
 *             format: date-time
 *             description: Date and time when the role was last updated.
 *             example: "2018-01-01T00:00:00.000Z"
 */

const Schema = mongoose.Schema;

const RoleSchema = new Schema({
	title: {
		'type': String,
		'required': true,
		'unique': true
	},
	searchContext: {
		'type': String,
		'enum': [ 'course', 'program', 'global' ],
		'default': null
	},
	createdBy: {
		'type': Schema.Types.ObjectId,
		'ref': 'User'
	},
	authorizedRoles: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'Role' }
	],
	permissions: {
		'type': Object,
		'required': true,
		'default': {}
	}
}, { timestamps: true });

const Role = mongoose.model( 'Role', RoleSchema );


// EXPORTS //

module.exports = Role;
