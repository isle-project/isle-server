// MODULES //

const mongoose = require( 'mongoose' );
const debug = require( 'debug' )( 'server' );
const config = require( './../etc/config.json' );


// MAIN //

// Set Promise library for mongoose:
mongoose.Promise = global.Promise;

mongoose.connect( config.mongodb, {
	'keepAlive': true,
	'useCreateIndex': true,
	'useNewUrlParser': true,
	'useFindAndModify': false,
	'useUnifiedTopology': true
})
.then( () => {
	debug( 'Successfully connected to MongoDB...' );
})
.catch( ( err ) => {
	debug( 'Encountered an error:'+err.message );
});
