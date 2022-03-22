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


// VARIABLES //

const Schema = mongoose.Schema;

const CriterionSchema = new Schema({
	minThreshold: {
		type: Number,
		required: true,
		min: 0,
		max: 100
	},
	maxThreshold: {
		type: Number,
		min: 0,
		max: 100,
		default: 100
	},
	completion: {
		type: String,
		required: true
	}
});


// MAIN //

const CertificateSchema = new Schema({
	name: {
		type: String,
		required: true
	},
	description: {
		type: String,
		required: false
	},
	scope: {
		type: String,
		required: true
	},
	criterion: {
		'type': CriterionSchema,
		'required': true
	},
	template: {
		'type': Object,
		'required': false,
		'default': {}
	}
}, { timestamps: true });

const Certificate = mongoose.model( 'Certificate', CertificateSchema );


// EXPORTS //

module.exports = Certificate;
