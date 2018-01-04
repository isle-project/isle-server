'use strict';

// MODULES //

var mongoose = require( 'mongoose' );
var debug = require( 'debug' )( 'cohort' );


// MAIN //

var Schema = mongoose.Schema;

var CohortSchema = new Schema({
	members: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'User' }
	],
	title: {
		'type': String,
		'required': true
	},
	startDate: {
		'type': Date,
		'required': true,
		'default': Date.now
	},
	endDate: {
		'type': Date
	},
	namespace: {
		'type': Schema.Types.ObjectId,
		'ref': 'Namespace'
	}
});

var Cohort = mongoose.model( 'Cohort', CohortSchema );


CohortSchema.path( 'title' ).validate( function validate( title, clbk ) {
	var self = this;
	if ( !self.namespace ) {
		return clbk( true );
	}
	Cohort.findOne( { title: title, namespace: self.namespace._id }, function find( err, cohort ) {
		if ( !cohort ){
			return clbk( true );
		}
		return clbk( false );
	});
}, 'Cohort with the given title already exists' );

// EXPORTS //

module.exports = Cohort;
