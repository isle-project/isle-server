'use strict';

// MODULES //

const { Schema } = require( 'prosemirror-model' );
const marks = require( './marks.js' );
const nodes = require( './nodes.js' );


// EXPORTS //

module.exports = new Schema({ nodes, marks });
