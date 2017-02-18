'use strict';

// MODULES //

var querystring = require( 'querystring' );
var ObjectID = require( 'mongodb' ).ObjectID;
var mongojs = require( 'mongojs' );
var debug = require( 'debug' )( 'server' );
var http = require( 'http' );
var path = require( 'path' );
var util = require( 'util' );
var url = require( 'url' );
var fs = require( 'fs' );
var Mailer = require( './mailer.js' );


// VARIABLES //

var databaseUrl = 'ISLE';
var collections = [
	'lessons',
	'mails',
	'users'
];
var db = mongojs( databaseUrl, collections );
db.users.createIndex( { 'email': 1 }, { unique: true } );

var REGEXP_LAST = /(\/[A-Z]*)$/i;


// FUNCTIONS //

/**
* Retrieve a document from the database.
*
* @param {string} collectionName - collection name
* @param {string} key - search key
* @param {string} searchValue - search value
* @param {Function} clbk - callback function
*/
function getItem( collectionName, key, searchValue, clbk ) {
	var collection = db.collection( collectionName );
	var query = {};
	query[ key ] = searchValue;
	collection.findOne( query, clbk );
} // end FUNCTION getItem()

/**
* Save a document to a collection.
*
* @param {string} collectionName - collection name
* @param {Object} obj - document object
* @param {Function} clbk - callback function
*/
function saveItem( collectionName, obj, clbk ) {
	var collection = db.collection( collectionName );
	collection.insert( obj, clbk );
} // end FUNCTION saveItem()


/**
* Update a document in a collection.
*
* @param {string} collectionName - collection name
* @param {string} id - document id
* @param {Object} obj - document object
* @param {Function} clbk - callback function
*/
function updateItem( collectionName, id, obj, clbk ) {
	var collection = db.collection( collectionName );
	collection.update( { _id: id }, obj, clbk );
} // end FUNCTION updateItem()


/**
* Send back result of GET request.
*
* @param {Object} response - response object
* @param {Object} result - collection document
*/
function sendGETResponse( response, result ) {
	response.writeHead( 200, {
		'Content-Type': 'application/json'
	});
	response.end( JSON.stringify( result ) );
} // end FUNCTION sendGETResponse()

/**
* Send back result of POST request.
*
* @param {Object} response - response object
* @param {Object} result - collection document
*/
function sendPOSTResponse( response, result ) {
	response.writeHead( 200, {
		'Content-Type': 'application/json',
	});
	response.end( JSON.stringify( result ) );
} // end FUNCTION sendPOSTResponse()


// CREATE MAILER //

var mailer = new Mailer();


// SERVER //

// Create the server:
http.createServer( function onCall( request, response ) {
	var queryData;
	var pathname;
	var query;
	var user;
	var res;

	if ( request.headers.origin ) {
		response.setHeader( 'Access-Control-Allow-Origin', request.headers.origin );
	}
	response.setHeader( 'Access-Control-Request-Method', '*' );
	response.setHeader( 'Access-Control-Allow-Methods', 'OPTIONS, GET, POST' );
	response.setHeader( 'Access-Control-Allow-Headers', '*' );
	response.setHeader( 'Access-Control-Allow-Credentials', 'true' );
	console.log( 'Server receives a yet unspecified request' );

	queryData = '';
	if ( request.method === 'GET' ) {
		console.log( 'Incoming GET request.' );

		pathname = url.parse( request.url ).pathname;
		pathname = REGEXP_LAST.exec( pathname)[ 1 ];
		query = querystring.parse( url.parse( request.url ).query );

		switch ( pathname ) {
		case '/user':
			console.log( 'Check user...' );
			user = getItem( 'users', 'email', query.email, function onDone( err, res ) {
				var user;
				if ( !res ) {
					user = {
						'email': query.email,
						'name': query.name,
						'sessions': []
					};
					saveItem( 'users', user, function onSaved( err, res ) {
						console.log( 'Created new user.' );
						sendGETResponse( response, res );
					});
				}
				else {
					sendGETResponse( response, res );
				}
			});
		break;
		case '/ping':
			response.writeHead( 200, {
				'Content-Type': 'text/plain'
			});
			response.end( 'live' );
		break;
		}
	}

	if ( request.method === 'POST' ) {
		console.log( 'Incoming POST request.' );
		request.on( 'data', function onData( data ) {
			queryData += data;
			if ( queryData.length > 1e6 ) {
				queryData = '';
				response.writeHead( 413, { 'Content-Type': 'text/plain' } ).end();
				request.connection.destroy();
			}
		});

		request.on( 'end', function onEnd() {
			var pathname;
			console.log( 'POST request received.');

			pathname = url.parse( request.url ).pathname;
			pathname = REGEXP_LAST.exec( pathname)[ 1 ];
			response.post = querystring.parse( queryData );

			switch ( pathname ) {
			case '/mail':
				mailer.send( response.post, function onDone( err, res ) {
					if ( !err ) {
						sendPOSTResponse( response, res );
					} else {
						sendPOSTResponse( response, err );
					}
				});
			break;
			case '/storeSessionElement':
				debug( 'Should store a lesson...' );
				var obj = JSON.parse( response.post.stringified );
				var userID = ObjectID( obj.userID );
				getItem( 'users', '_id', userID, function onDone( err, user ) {
					var i;
					if ( err ) {
						debug( 'User not found' );
						sendPOSTResponse( response, err );
					} else {
						debug( 'User found' );
						for ( i = 0; i < user.sessions.length; i++ ) {
							if ( user.sessions[ i ].startTime === obj.startTime ) {
								debug( 'Session found. Adding element...' );
								let session = user.sessions[ i ];
								switch ( obj.type ) {
									case 'vars':
										session.vars = obj.data;
									break;
									case 'action':
										session.actions.push( obj.data );
									break;
								}
							}
						}
						updateItem( 'users', userID, user, function onUpdated( err, res ) {
							if ( !err ) {
								sendPOSTResponse( response, res );
							} else {
								sendPOSTResponse( response, err );
							}
						});
					}
				});
			break;
			case '/updateSession':
				var session = JSON.parse( response.post.stringified );
				var userID = ObjectID( session.userID );
				debug( 'Updating session...' );
				getItem( 'users', '_id', userID, function onDone( err, user ) {
					var found;
					var i;
					if ( err ) {
						debug( 'User not found' );
						sendPOSTResponse( response, err );
					} else {
						found = false;
						for ( i = 0; i < user.sessions.length; i++ ) {
							if ( user.sessions[ i ].startTime === session.startTime ) {
								debug( 'Found session to update...' );
								user.sessions[ i ] = session;
								found = true;
							}
						}
						if ( !found ) {
							debug( 'Adding a new session...' );
							user.sessions.push( session );
						}
						updateItem( 'users', userID, user, function onUpdated( err, res ) {
							if ( !err ) {
								sendPOSTResponse( response, res );
							} else {
								sendPOSTResponse( response, err );
							}
						});
					}
				});
			break;
			}
		});
	}

}).listen( 17777 );
