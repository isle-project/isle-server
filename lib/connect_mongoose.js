// MODULES //

const mongoose = require( 'mongoose' );
const debug = require( 'debug' )( 'server' );
const config = require( './../etc/config.json' );


// MAIN //

// Set Promise library for mongoose:
mongoose.Promise = global.Promise;

mongoose.connect( config.mongodb, {
	'keepAlive': true,
	'reconnectTries': 10000,
	'useNewUrlParser': true,
	'useFindAndModify': false,
	'useUnifiedTopology': true
}, function onConnection( err ) {
	if ( err ) {
		throw err;
	}
	debug( 'Successfully connected to MongoDB...' );
});
