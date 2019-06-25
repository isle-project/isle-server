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
	private: {
		'type': Boolean,
		'default': false
	},
	emailFilter: {
		'type': String
	},
	namespace: {
		'type': Schema.Types.ObjectId,
		'ref': 'Namespace'
	}
});

const Cohort = mongoose.model( 'Cohort', CohortSchema );

CohortSchema.path( 'title' ).validate({
	'validator': function validate( title ) {
		var self = this;
		return new Promise( function promise( resolve, reject ) {
			if ( !self.namespace ) {
				debug( 'Namespace not found...' );
				return resolve( true );
			}
			Cohort.findOne( { title: title, namespace: self.namespace._id }, function find( err, cohort ) {
				if ( err ) {
					return reject( err );
				}
				if ( !cohort ){
					debug( 'Cohort does not exist yet, title is valid.' );
					return resolve( true );
				}
				debug( 'Cohort already exists, title is invalid.' );
				resolve( false );
			});
		});
	},
	'message': 'Cohort title is invalid.'
});


// EXPORTS //

module.exports = Cohort;
