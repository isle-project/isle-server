'use strict';

// MODULES //

const mongoose = require( 'mongoose' );


// MAIN //

const Schema = mongoose.Schema;

const SessionDataSchema = new Schema({
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
