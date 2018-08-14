'use strict';

// MODULES //

var mongoose = require( 'mongoose' );


// MAIN //

var Schema = mongoose.Schema;

var FileSchema = new Schema({
	title: {
		'type': String,
		'required': true
	},
	filename: {
		'type': String,
		'required': true
	},
	path: {
		'type': String,
		'required': true
	},
	namespace: {
		'type': Schema.Types.ObjectId,
		'ref': 'Namespace',
		'required': true
	},
	lesson: {
		'type': Schema.Types.ObjectId,
		'ref': 'Lesson'
	},
	type: {
		'type': String
	},
	user: {
		'type': Schema.Types.ObjectId,
		'ref': 'User',
		'required': true
	}
}, { timestamps: true });

var File = mongoose.model( 'File', FileSchema );


// EXPORTS //

module.exports = File;
