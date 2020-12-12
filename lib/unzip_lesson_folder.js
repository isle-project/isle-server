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

const { unlink } = require( 'fs/promises' );
const path = require( 'path' );
const AdmZip = require( 'adm-zip' );
const captureWebsite = require( 'capture-website' );
const debug = require( 'debug' )( 'server' );
const config = require( './../etc/config.json' );
const namespacesDirectory = config.namespacesDirectory;
const serverHostName = config.server;


// MAIN //

async function unzipLessonFolder( namespaceName, lessonName, filename ) {
	const filePath = path.resolve( __dirname, namespacesDirectory, filename );
	const zip = new AdmZip( filePath );
	let dirpath = path.join( namespacesDirectory, namespaceName, lessonName );
	dirpath = path.resolve( __dirname, dirpath );
	debug( `Unzipping lesson file ${filePath} to ${dirpath}` );
	zip.extractAllTo( dirpath, true );
	const lessonURL = serverHostName + '/' + namespaceName + '/' + lessonName + '/index.html';
	try {
		await unlink( dirpath+'/preview.jpg' );
	}
	catch ( err ) {
		debug( `Encountered an error: ${err.message}` );
	}
	finally {
		try {
			await captureWebsite.file( lessonURL, dirpath+'/preview.jpg', {
				delay: 20
			});
		}
		catch ( err ) {
			debug( `Encountered an error: ${err.message}` );
		}
	}
	return unlink( filePath );
}


// EXPORTS //

module.exports = unzipLessonFolder;
