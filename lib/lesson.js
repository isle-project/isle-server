'use strict';

// MODULES //

var mongoose = require( 'mongoose' );


// MAIN //

var Schema = mongoose.Schema;

var LessonSchema = new Schema({
	namespace: {
		'type': Schema.Types.ObjectId,
		'ref': 'Namespace'
	},
	title: {
		'type': String,
		'required': true,
	},
	description: {
		'type': String,
		'required': false,
		'default': 'No description supplied.'
	},
	active: {
		'type': Boolean,
		'required': false,
		'default': true
	},
	public: {
		'type': Boolean,
		'required': false,
		'default': true
	},
	metadata: {
		'type': Object,
		'required': false
	}
});


// EXPORTS //

module.exports = mongoose.model( 'Lesson', LessonSchema );
