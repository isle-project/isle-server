'use strict';

// MODULES //

const mongoose = require( 'mongoose' );


// MAIN //

const Schema = mongoose.Schema;

const AnnouncementSchema = new Schema({
	title: {
		'type': String,
		'required': true
	},
	body: {
		'type': String,
		'required': true
	},
	author: {
		'type': String,
		'required': true
	},
	email: {
		'type': String,
		'required': true
	},
	picture: {
		'type': String,
		'required': true
	},
	createdAt: {
		'type': Number,
		'required': true
	}
});

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
	announcements: {
		'type': [ AnnouncementSchema ],
		'default': []
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
}, { timestamps: true });


// EXPORTS //

module.exports = mongoose.model( 'Lesson', LessonSchema );
