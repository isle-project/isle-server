'use strict';

// MODULES //

var mongoose = require( 'mongoose' );


// MAIN //

var Schema = mongoose.Schema;

var FileSchema = new Schema({
	title: {
		'type': String,
		'required': true,
	},
	path: {
		'type': String,
		'required': true
	},
	namespace: {
		'type': Schema.Types.ObjectId,
		'ref': 'Namespace'
	},
	lesson: {
		'type': Schema.Types.ObjectId,
		'ref': 'Lesson'
	},
	user: {
		'type': Schema.Types.ObjectId,
		'ref': 'User'
	}
});


const File = mongoose.model( 'File', FileSchema );


// EXPORTS //

module.exports = File;
