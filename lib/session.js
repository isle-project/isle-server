'use strict';

// MODULES //

const mongoose = require( 'mongoose' );


// MAIN //

const Schema = mongoose.Schema;

const SessionSchema = new Schema({
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
