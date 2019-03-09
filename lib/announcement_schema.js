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


// EXPORTS //

module.exports = AnnouncementSchema;
