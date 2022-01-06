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
 *       Announcement:
 *         type: object
 *         required:
 *           - title
 *           - body
 *           - author
 *           - email
 *           - picture
 *           - createdAt
 *         properties:
 *           title:
 *             type: string
 *             description: Title of the announcement
 *             example: "New title"
 *           body:
 *             type: string
 *             description: Body of the announcement
 *             example: "This is the body of the announcement"
 *           author:
 *             type: string
 *             description: Username of the author
 *             example: "username"
 *           email:
 *             type: string
 *             description: Email of the author
 *             example: "admin@isledocs.com"
 *           picture:
 *             type: string
 *             description: URL of the author's picture
 *             example: "https://isledocs.com/images/profile.png"
 *           createdAt:
 *             type: string
 *             format: date-time
 *             description: Date of creation
 *             example: "2016-12-31T23:59:59.999Z"
 */

const Schema = mongoose.Schema;

const AnnouncementSchema = new Schema({
	title: {
		'type': String,
		'required': true
	},
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
	createdAt: {
		'type': Number,
		'required': true
	}
});


// EXPORTS //

module.exports = AnnouncementSchema;
