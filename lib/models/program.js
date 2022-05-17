/**
* Copyright (C) 2016-present The ISLE Authors
*
* The isle-server program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

'use strict';

// MODULES //

const mongoose = require( 'mongoose' );
const CompletionMetricSchema = require( './completion_metric.js' );


// MAIN //

const Schema = mongoose.Schema;

const ProgramSchema = new Schema({
	owners: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'User' }
	],
	namespaces: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'Namespace' }
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
	completions: {
		'type': [ CompletionMetricSchema ],
		'required': false,
		'default': []
	},
	users: [
		{ 'type': Schema.Types.ObjectId, 'ref': 'User' }
	]
}, { timestamps: true });

ProgramSchema.path( 'owners' ).validate( function validate( owners ) {
	if ( !owners ) {
		return false;
	}
	if ( owners.length === 0 ) {
		return false;
	}
	return true;
}, 'Programs need at least one owner' );

ProgramSchema.pre( 'save', function save( next ) {
	const program = this; //eslint-disable-line
	if ( program.isNew ) {
		mongoose.models.Program.countDocuments({
			title: program.title
		}, function onResult( err, count ) {
			if ( err ) {
				return next( err );
			}
			if ( count > 0 ) {
				return next( new Error( 'A program with this title already exists.' ) );
			}
			next();
		});
	} else {
		next();
	}
});

const Program = mongoose.model( 'Program', ProgramSchema );


// EXPORTS //

module.exports = Program;
