// MODULES //

const fs = require( 'fs-extra' );
const path = require( 'path' );
const AdmZip = require( 'adm-zip' );
const debug = require( 'debug' )( 'server' );
const config = require( './config.json' );
const namespacesDirectory = config.namespacesDirectory;

// MAIN //

function unzipLessonFolder( namespaceName, lessonName, filename ) {
	debug( 'Unzipping lesson file...' );
	let filePath = path.resolve( __dirname, namespacesDirectory, filename );
	let zip = new AdmZip( filePath );
	let dirpath = path.join( namespacesDirectory, namespaceName, lessonName );
	dirpath = path.resolve( __dirname, dirpath );
	zip.extractAllTo( dirpath, true );
	fs.unlink( filePath );
}


// EXPORTS //

module.exports = unzipLessonFolder;
