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

// MODULES //

const fs = require( 'fs-extra' );
const path = require( 'path' );
const AdmZip = require( 'adm-zip' );
const captureWebsite = require( 'capture-website' );
const debug = require( 'debug' )( 'server' );
const config = require( './../etc/config.json' );
const namespacesDirectory = config.namespacesDirectory;
const serverHostName = config.server;


// MAIN //

function unzipLessonFolder( namespaceName, lessonName, filename ) {
	debug( 'Unzipping lesson file...' );
	const filePath = path.resolve( __dirname, namespacesDirectory, filename );
	const zip = new AdmZip( filePath );
	let dirpath = path.join( namespacesDirectory, namespaceName, lessonName );
	dirpath = path.resolve( __dirname, dirpath );
	zip.extractAllTo( dirpath, true );
	const lessonURL = serverHostName + '/' + namespaceName + '/' + lessonName + '/index.html';
	captureWebsite.file( lessonURL, dirpath+'/preview.jpg', {
		delay: 20
	});
	return fs.unlink( filePath );
}


// EXPORTS //

module.exports = unzipLessonFolder;
