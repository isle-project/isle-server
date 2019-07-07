// MODULES //

const fs = require( 'fs-extra' );
const path = require( 'path' );
const AdmZip = require( 'adm-zip' );
const captureWebsite = require( 'capture-website' );
const debug = require( 'debug' )( 'server' );
const config = require( './config.json' );
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
	captureWebsite.file( lessonURL, dirpath+'/preview.png', {
		delay: 20
	});
	fs.unlink( filePath );
}


// EXPORTS //

module.exports = unzipLessonFolder;
