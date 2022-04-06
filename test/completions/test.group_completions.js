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

/* eslint-disable max-nested-callbacks, no-multi-spaces */

'use strict';

// MODULES //

const tape = require( 'tape' );
const { DEFAULT_TAG,
        groupCompletions,
        makeCompletionPolicy } = require( './../../lib/helpers/completions.js' );


// FIXTURES //

const basicPolicy = makeCompletionPolicy();

const nodeCompletions = [
        {
            'u1': { 'homework': [ [80, 1646160630592 ] ] },
            'u2': { 'homework': [ [100, 1646160630592 ] ] },
            'u3': { 'exams': [ [60, 1646160630592 ] ] },
            'u4': { 'exams': [ [100, 1646160630592 ] ] }
        },
        {
            'u1': { 'exams': [ [ 60, 1646160630592 ] ] },
            'u2': { 'exams': [ [ 100, 1646160630592 + 300000 ] ] },
            'u5': { 'homework': [ [50, 1646160630592 ] ] }
        },
        {
            'u1': { 'lab': [ [ 50, 1646160630592 ] ] },
            'u4': { 'lab': [ [ 100, 1646160630592 ] ] }
        }
];

const nodeCompletionsWithoutTags = [
        {
            'u1': { [DEFAULT_TAG]: [ [80, 1646160630592 ] ] },
            'u2': { [DEFAULT_TAG]: [ [100, 1646160630592 ] ] },
            'u3': { [DEFAULT_TAG]: [ [60, 1646160630592 ] ] },
            'u4': { [DEFAULT_TAG]: [ [100, 1646160630592 ] ] }
        },
        {
            'u1': { [DEFAULT_TAG]: [ [60, 1646160630592] ] },
            'u2': { [DEFAULT_TAG]: [ [100, 1646160630592 + 300000] ] },
            'u5': { [DEFAULT_TAG]: [ [50, 1646160630592] ] }
        },
        {
            'u1': { [DEFAULT_TAG]: [ [50, 1646160630592] ] },
            'u4': { [DEFAULT_TAG]: [ [100, 1646160630592] ] }
        }
];

const nodeCompletionsWithSomeTagsMissing = [
        {
            'u1': { [DEFAULT_TAG]: [ [80, 1646160630592] ] },
            'u2': { [DEFAULT_TAG]: [ [100, 1646160630592] ] },
            'u3': { 'exams': [ [60, 1646160630592] ] },
            'u4': { 'exams': [ [100, 1646160630592] ] }
        },
        {
            'u1': { 'exams': [ [60, 1646160630592] ] },
            'u2': { 'exams': [ [100, 1646160630592 + 300000] ] },
            'u5': { [DEFAULT_TAG]: [ [50, 1646160630592] ] }
        },
        {
            'u1': { 'lab': [ [50, 1646160630592] ] },
            'u4': { 'lab': [ [100, 1646160630592] ] }
        }
];


// TESTS //

tape( 'main export is a function', t => {
        t.ok( true, __filename );
        t.ok( typeof groupCompletions === 'function', 'main export is a function' );
        t.end();
});

tape( 'the function returns an object with user id keys mapping to an object of tag names to two-element arrays of completion values and times (all tags)', t => {
        const expected = {
                u1: {
                        homework: [ [ 80, 1646160630592 ] ],
                        exams: [ [ 60, 1646160630592 ] ],
                        lab: [ [ 50, 1646160630592 ] ]
                },
                u2: {
                        homework: [ [ 100, 1646160630592 ] ],
                        exams: [ [ 100, 1646160630592 + 300000 ] ],
                        lab: []
                },
                u3: {
                        homework: [],
                        exams: [ [ 60, 1646160630592 ] ],
                        lab: []
                },
                u4: {
                        homework: [],
                        exams: [ [ 100, 1646160630592 ] ],
                        lab: [ [ 100, 1646160630592 ] ]
                },
                u5: {
                        homework: [ [ 50, 1646160630592 ] ],
                        exams: [],
                        lab: []
                }
        };
        const actual = groupCompletions( nodeCompletions, basicPolicy );
        t.deepEqual( actual, expected, 'returns expected value' );
        t.end();
});

tape( 'the function returns an object with user id keys mapping to an object with the default tag mapping to two-element arrays of completion values and times (no tags)', t => {
        const expected = {
                u1: {
                        [DEFAULT_TAG]: [ [ 80, 1646160630592 ], [ 60, 1646160630592 ], [ 50, 1646160630592 ] ]
                },
                u2: {
                        [DEFAULT_TAG]: [ [ 100, 1646160630592 ], [ 100, 1646160630592 + 300000 ] ]
                },
                u3: {
                        [DEFAULT_TAG]: [ [ 60, 1646160630592 ] ]
                },
                u4: {
                        [DEFAULT_TAG]: [ [ 100, 1646160630592 ], [ 100, 1646160630592 ] ]
                },
                u5: {
                        [DEFAULT_TAG]: [ [ 50, 1646160630592 ] ]
                }
        };
        const actual = groupCompletions( nodeCompletionsWithoutTags, basicPolicy );
        t.deepEqual( actual, expected, 'returns expected value' );
        t.end();
});

tape( 'the function returns an object with user id keys mapping to an object with tag names mapping to two-element arrays of completion values and times (with some tags)', t => {
        const expected = {
                u1: {
                        [DEFAULT_TAG]: [ [ 80, 1646160630592 ] ],
                        exams: [ [ 60, 1646160630592 ] ],
                        lab: [ [ 50, 1646160630592 ] ]
                },
                u2: {
                        [DEFAULT_TAG]: [ [ 100, 1646160630592 ] ],
                        exams: [ [100, 1646160630592 + 300000] ],
                        lab: []
                },
                u3: {
                        [DEFAULT_TAG]: [],
                        exams: [ [ 60, 1646160630592 ] ],
                        lab: []
                },
                u4: {
                        [DEFAULT_TAG]: [],
                        exams: [ [ 100, 1646160630592 ] ],
                        lab: [ [ 100, 1646160630592 ] ]
                },
                u5: {
                        [DEFAULT_TAG]: [ [ 50, 1646160630592 ] ],
                        exams: [],
                        lab: []
                }
        };
        const actual = groupCompletions( nodeCompletionsWithSomeTagsMissing, basicPolicy );
        t.deepEqual( actual, expected, 'returns expected value' );
        t.end();
});
