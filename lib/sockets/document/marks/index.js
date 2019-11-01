'use strict';

// MODULES //

const { marks } = require( 'prosemirror-schema-basic' );
const subscript = require( './subscript.js' );
const textColor = require( './text_color.js' );
const fontSize = require( './font_size.js' );
const strikethrough = require( './strikethrough.js' );
const superscript = require( './superscript.js' );
const underline = require( './underline.js' );


// MAIN //

const main = {
	...marks,
	subscript,
	superscript,
	underline,
	strikethrough,
	textColor,
	fontSize
};


// EXPORTS //

module.exports = main;
