'use strict';

// MODULES //

const mongoose = require( 'mongoose' );
const uniqueValidator = require( 'mongoose-unique-validator' );
const AnnouncementSchema = require( './announcement_schema.js' );


// MAIN //

const Schema = mongoose.Schema;

const NamespaceSchema = new Schema({
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
	},
	announcements: {
		'type': [ AnnouncementSchema ],
		'default': []
	}
}, { timestamps: true });

NamespaceSchema.path( 'owners' ).validate( function validate( owners ) {
	if ( !owners ) {
		return false;
	}
	if ( owners.length === 0 ) {
		return false;
	}
	return true;
}, 'Namespaces need at least one owner' );

const Namespace = mongoose.model( 'Namespace', NamespaceSchema );

NamespaceSchema.plugin( uniqueValidator );


// EXPORTS //

module.exports = Namespace;
