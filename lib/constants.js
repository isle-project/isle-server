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

const url = require( 'url' );
const resolve = require( 'path' ).resolve;
const isAbsolutePath = require( '@stdlib/assert/is-absolute-path' );
const config = require( '../etc/config.json' );


// VARIABLES //

const {
	backupDirectory = './../backups',
	namespacesDirectory = './../public',
	mediaDirectory = './../media',
	localesDirectory = './../locales',
	logsDirectory = './../logs',
	server: SERVER_HOST_NAME
} = config;
const NAMESPACES_DIRECTORY = isAbsolutePath( namespacesDirectory ) ?
	namespacesDirectory : resolve( __dirname, namespacesDirectory );
const MEDIA_DIRECTORY = isAbsolutePath( mediaDirectory ) ? mediaDirectory : resolve( __dirname, mediaDirectory );
const BACKUP_DIRECTORY = isAbsolutePath( backupDirectory ) ? backupDirectory : resolve( __dirname, backupDirectory );
const LOCALES_DIRECTORY = isAbsolutePath( localesDirectory ) ? localesDirectory : resolve( __dirname, localesDirectory );
const LOGS_DIRECTORY = isAbsolutePath( logsDirectory ) ? logsDirectory : resolve( __dirname, logsDirectory );
const NOTIFICATIONS_EMAIL = {
	name: 'ISLE Messenger',
	address: `notifications@${url.parse( SERVER_HOST_NAME ).host}`
};


// MAIN //

const main = {
	NAMESPACES_DIRECTORY,
	MEDIA_DIRECTORY,
	BACKUP_DIRECTORY,
	LOCALES_DIRECTORY,
	LOGS_DIRECTORY,
	NOTIFICATIONS_EMAIL,
	SERVER_HOST_NAME
};


// EXPORTS //

module.exports = main;
