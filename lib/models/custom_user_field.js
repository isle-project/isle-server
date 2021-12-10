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
 *       CustomField:
 *         type: object
 *         properties:
 *           name:
 *             type: string
 *             description: The name of the custom field.
 *             example: "Favorite Color"
 *             required: true
 *           description:
 *             type: string
 *             description: A description of the custom field.
 *             example: "What is your favorite color?"
 *             required: true
 *           type:
 *             type: string
 *             description: The type of the custom field  (can be one of `text` for free text, `checkbox` for a Boolean, or `dropdown` for a list of options)
 *             example: "text"
 *             required: true
 *           position:
 *             type: integer
 *             description: The position of the custom field.
 *             example: 1
 *             required: true
 *           options:
 *             type: array
 *             description: The options of the custom field (only applicable when `type` is set to `dropdown`).
 *             items:
 *               type: string
 *            showOnProfile:
 *              type: boolean
 *              description: Whether or not the custom field should be shown on the user profile.
 *              example: true
 *              required: false
 *              default: false
 *            editableOnSignup:
 *              type: boolean
 *              description: Whether users should be prompted to enter a value for the custom field when signing up.
 *              example: true
 *              required: false
 *              default: false
 *            editableOnProfile:
 *              type: boolean
 *              description: Whether users should be prompted to enter a value for the custom field when editing their profile.
 *              example: true
 *              required: false
 *              default: false
 *            userRelation:
 *              type: string
 *              description: optional field indicating whether custom field has a one to `one` or one to `many` relation to the user table, i.e. whether a value of the field is unique to one user or not.
 *              example: "many"
 *              required: false
 *              default: null
 */

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
