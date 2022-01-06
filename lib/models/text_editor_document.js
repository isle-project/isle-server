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
 *       TextEditorDocument:
 *         type: object
 *         required:
 *           - id
 *           - namespace
 *           - lesson
 *           - doc
 *         properties:
 *           id:
 *             type: string
 *             description: The unique identifier for the text editor corresponding to the document.
 *           namespace:
 *             $ref: '#/components/schemas/Namespace'
 *             description: The namespace corresponding to the document.
 *           lesson:
 *             $ref: '#/components/schemas/Lesson'
 *             description: The lesson corresponding to the document.
 *           users:
 *             type: array
 *             description: The users who have contributed to the document.
 *             items:
 *               $ref: '#/components/schemas/User'
 *           version:
 *             type: integer
 *             description: The version of the document.
 *             default: 0
 *             minimum: 0
 *           doc:
 *             type: object
 *             description: The document data as a JSON object.
 *           comments:
 *             type: array
 *             description: The comments associated with the document.
 *             default: []
 *           steps:
 *             type: array
 *             description: Array of compressed steps constituting the document's history.
 *             default: []
 */

const Schema = mongoose.Schema;

const TextEditorDocumentSchema = new Schema({
	id: {
		'type': String,
		'required': true
	},
	namespace: {
		'type': Schema.Types.ObjectId,
		'ref': 'Namespace',
		'required': true
	},
	lesson: {
		'type': Schema.Types.ObjectId,
		'ref': 'Lesson',
		'required': true
	},
	users: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'User' }
	],
	version: {
		'type': Number,
		'default': 0,
		'min': 0
	},
	doc: {
		'type': Object,
		'required': true
	},
	comments: {
		'type': Array,
		'default': []
	},
	steps: {
		'type': Array,
		'default': []
	}
}, { timestamps: true });

const TextEditorDocument = mongoose.model( 'TextEditorDocument', TextEditorDocumentSchema );


// EXPORTS //

module.exports = TextEditorDocument;
