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


// MAIN //

const Schema = mongoose.Schema;

const AssessmentSchema = new Schema({
	user: {
		'type': Schema.Types.ObjectId,
		'ref': 'User',
		'required': true
	},
	lesson: {
		'type': Schema.Types.ObjectId,
		'ref': 'Lesson',
		'required': true
	},
	component: {
		'type': String,
		'required': true
	},
	componentType: {
		'type': String,
		'required': true
	},
	metricName: {
		'type': String, // Standard values are 'interacted', 'completed', 'correct'
		'required': true
	},
	score: {
		'type': Number,
		'required': true,
		'min': 0,
		'max': 100
	},
	time: {
		'type': Number,
		'required': true
	},
	tag: {
		'type': String, // Example: designate specific questions as part of a graded quiz and others as optional practice questions
		'required': false
	}
}, { timestamps: false });

const Assessment = mongoose.model( 'Assessment', AssessmentSchema );


// EXPORTS //

module.exports = Assessment;
