'use strict';

// MODULES //

const mongoose = require( 'mongoose' );
const debug = require( 'debug' )( 'cohort' );


// MAIN //

const Schema = mongoose.Schema;

const CohortSchema = new Schema({
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

const Cohort = mongoose.model( 'Cohort', CohortSchema );

CohortSchema.path( 'title' ).validate({
	'isAsync': true,
	'validator': function validate( title, clbk ) {
		var self = this;
		var msg = 'Cohort with the given title already exists';
		if ( !self.namespace ) {
			debug( 'Namespace not found...' );
			return clbk( true, msg );
		}
		Cohort.findOne( { title: title, namespace: self.namespace._id }, function find( err, cohort ) {
			if ( !cohort ){
				debug( 'Cohort does not exist yet, title is valid.' );
				return clbk( true, msg );
			}
			debug( 'Cohort already exists, title is invalid.' );
			return clbk( false, msg );
		});
	}
});


// EXPORTS //

module.exports = Cohort;
