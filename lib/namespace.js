'use strict';

// MODULES //

var mongoose = require( 'mongoose' );
var uniqueValidator = require( 'mongoose-unique-validator' );


// MAIN //

var Schema = mongoose.Schema;

var NamespaceSchema = new Schema({
	owners: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'User' }
	],
	title: {
		'type': String,
		'required': true,
		'unique': true
	},
	description: {
		'type': String,
		'required': false
	}
});

NamespaceSchema.path( 'owners' ).validate( function validate( owners ) {
	if ( !owners ) {
		return false;
	}
	if ( owners.length === 0 ) {
		return false;
	}
	return true;
}, 'Namespaces need at least one owner' );

var Namespace = mongoose.model( 'Namespace', NamespaceSchema );

NamespaceSchema.plugin( uniqueValidator );


// EXPORTS //

module.exports = Namespace;
