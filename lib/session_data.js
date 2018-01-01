'use strict';

// MODULES //

var mongoose = require( 'mongoose' );


// MAIN //

var Schema = mongoose.Schema;

var SessionDataSchema = new Schema({
	user: {
		'type': Schema.Types.ObjectId,
		'ref': 'User'
	},
	lesson: {
		'type': Schema.Types.ObjectId,
		'ref': 'Lesson',
		'required': true
	},
	type: {
		'type': String,
		'required': true
	},
	data: {
		'type': Object,
		'required': true
	}
});


// EXPORTS //

module.exports = mongoose.model( 'SessionData', SessionDataSchema );
