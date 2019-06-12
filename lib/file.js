'use strict';

// MODULES //

const mongoose = require( 'mongoose' );


// MAIN //

const Schema = mongoose.Schema;

const FileSchema = new Schema({
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
	size: {
		'type': Number
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

const File = mongoose.model( 'File', FileSchema );


// EXPORTS //

module.exports = File;
