'use strict';

// MODULES //

var mongoose = require( 'mongoose' );


// MAIN //

var Schema = mongoose.Schema;

var SessionSchema = new Schema({
	user: {
		'type': Schema.Types.ObjectId,
		'ref': 'User'
	},
	lesson: {
		'type': Schema.Types.ObjectId,
		'ref': 'Lesson',
		'required': true
	},
	startTime: {
		'type': Number,
		'required': true
	},
	endTime: {
		'type': Number
	},
	duration: {
		'type': Number
	},
	finished: {
		'type': Boolean,
		'default': false
	},
	actions: {
		'type': Array,
		'default': []
	}
});


// EXPORTS //

module.exports = mongoose.model( 'Session', SessionSchema );
