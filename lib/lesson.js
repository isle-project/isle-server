'use strict';

// MODULES //

const mongoose = require( 'mongoose' );


// MAIN //

const Schema = mongoose.Schema;

const LessonSchema = new Schema({
	namespace: {
		'type': Schema.Types.ObjectId,
		'ref': 'Namespace',
		'required': true
	},
	title: {
		'type': String,
		'required': true
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
		'default': false
	},
	metadata: {
		'type': Object,
		'required': false
	}
}, { timestamps: true });


// EXPORTS //

module.exports = mongoose.model( 'Lesson', LessonSchema );
