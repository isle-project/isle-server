'use strict';

// MODULES //

const { Schema } = require( 'prosemirror-model' );
const marks = require( './marks' );
const nodes = require( './nodes' );


// EXPORTS //

module.exports = new Schema({ nodes, marks });
