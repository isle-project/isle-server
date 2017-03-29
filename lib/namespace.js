'use strict';

// MODULES //

var mongoose = require( 'mongoose' );


// MAIN //

var Schema = mongoose.Schema;

var NamespaceSchema = new Schema({
	owners: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'User' }
	],
	title: {
		'type': String,
		'required': true,
		'index': { unique: true }
	},
	description: {
		'type': String,
		'required': false
	}
});


// EXPORTS //

module.exports = mongoose.model( 'Namespace', NamespaceSchema );
