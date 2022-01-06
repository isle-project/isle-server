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
 *       Backup:
 *         type: object
 *         required:
 *           - filename
 *           - path
 *         properties:
 *           filename:
 *             type: string
 *             description: The name of the backup file.
 *           path:
 *             type: string
 *             description: The path to the backup file.
 *           size:
 *             type: integer
 *             description: The size of the backup file in bytes.
 *           created_at:
 *             type: string
 *             format: date-time
 *             description: The date and time the backup was created.
 *           updated_at:
 *             type: string
 *             format: date-time
 *             description: The date and time the backup was last updated.
 *         example:
 *           filename: 'backup.zip'
 *           path: '/tmp/backup.zip'
 *           size: 12345
 *           created_at: '2016-01-01T00:00:00.000Z'
 *           updated_at: '2016-01-01T00:00:00.000Z'
 */
const Schema = mongoose.Schema;

const BackupSchema = new Schema({
	filename: {
		'type': String,
		'required': true
	},
	path: {
		'type': String,
		'required': true
	},
	size: {
		'type': Number
	}
}, { timestamps: true });

const Backup = mongoose.model( 'Backup', BackupSchema );


// EXPORTS //

module.exports = Backup;
