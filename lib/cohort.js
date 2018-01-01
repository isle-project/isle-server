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

CohortSchema.pre( 'save', function save( next ) {
	var self = this;
	Cohort.findOne( { title: self.title, namespace: self.namespace }, function find( err, cohort ) {
		if ( !cohort ){
			next();
		} else {
			var msg = 'Cohort with the given title already exists: ' + self.title;
			debug( msg );
			next( new Error( msg ) );
		}
	});
});


// EXPORTS //

module.exports = Cohort;
