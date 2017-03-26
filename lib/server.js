'use strict';

// MODULES //

var express = require( 'express' );
var bodyParser = require( 'body-parser' );
var mongoose = require( 'mongoose' );
var Schema = mongoose.Schema;
var jwt = require( 'jsonwebtoken' );
var _ = require( 'lodash' );
var bcrypt = require( 'bcrypt' );


var passport = require( 'passport' );
var passportJWT = require( 'passport-jwt' );

var ExtractJwt = passportJWT.ExtractJwt;
var JwtStrategy = passportJWT.Strategy;


// VARIABLES //

var connStr = 'mongodb://localhost:8000/mongoose-bcrypt-test';
mongoose.connect( connStr, function( err ) {
    if ( err ) throw err;
    console.log( 'Successfully connected to MongoDB' );
});

var users = [
  {
    id: 1,
    name: 'jonathanmh',
    password: '%2yx4'
  },
  {
    id: 2,
    name: 'test',
    password: 'test'
  }
];


// MAIN //

var app = express();

var jwtOptions = {
	jwtFromRequest: ExtractJwt.fromAuthHeader(),
	secretOrKey: 'tasmanianDevil'
};

var strategy = new JwtStrategy( jwtOptions, function( jwt_payload, next ) {
	console.log( 'payload received', jwt_payload );
	// usually this would be a database call:
	var user = users[ _.findIndex(users, {id: jwt_payload.id}) ];
	if ( user ) {
		next( null, user );
	} else {
		next( null, false );
	}
});

passport.use( strategy );

app.use( passport.initialize() );

// Parse application/x-www-form-urlencoded for easier testing with Postman or plain HTML forms
app.use( bodyParser.urlencoded({
	extended: true
}) );

// Parse application/json:
app.use( bodyParser.json() );

app.get( '/', function( req, res ) {
	res.json({ message: 'Express is up!' });
});

app.get( '/secret', passport.authenticate( 'jwt', { session: false }), function( req, res ) {
	res.json( 'Success! You can not see this without a token' );
});

app.post( '/login', function( req, res ) {
	if ( req.body.name && req.body.password ) {
		var name = req.body.name;
		var password = req.body.password;
	}
	// Usually this would be a database call:
	var user = users[ _.findIndex(users, {name: name}) ];
	if ( !user ) {
		res.status( 401 ).json({ message: 'no such user found' });
	}

	if ( user.password === req.body.password ) {
		// from now on we'll identify the user by the id and the id is the only personalized value that goes into our token
		var payload = { id: user.id };
		var token = jwt.sign( payload, jwtOptions.secretOrKey );
		res.json({ message: "ok", token: token });
	} else {
		res.status( 401 ).json({ message: "passwords did not match" });
	}
});

app.listen( 3000, function() {
	console.log( 'Express running' );
});
