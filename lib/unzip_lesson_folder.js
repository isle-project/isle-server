// MODULES //

var fs = require( 'fs-extra' );
var path = require( 'path' );
var AdmZip = require( 'adm-zip' );
var debug = require( 'debug' )( 'server' );
var config = require( './config.json' );
var namespacesDirectory = config.namespacesDirectory;

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
