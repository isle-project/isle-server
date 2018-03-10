// MODULES //

var mongoose = require( 'mongoose' );
var debug = require( 'debug' )( 'server' );
var config = require( './config.json' );


// MAIN //

// Set Promise library for mongoose:
mongoose.Promise = global.Promise;

mongoose.connect( config.mongodb, {
	'keepAlive': true,
	'reconnectTries': 10000
}, function onConnection( err ) {
	if ( err ) {
		throw err;
	}
	debug( 'Successfully connected to MongoDB...' );
});
