'use strict';

// MODULES //

const link = require( './link.js' );
const em = require( './em.js' );
const strong = require( './strong.js' );
const code = require( './code.js' );
const subscript = require( './subscript.js' );
const textColor = require( './text_color.js' );
const fontSize = require( './font_size.js' );
const strikethrough = require( './strikethrough.js' );
const superscript = require( './superscript.js' );
const underline = require( './underline.js' );


// MAIN //

const main = {
	link,
	em,
	strong,
	code,
	subscript,
	superscript,
	underline,
	strikethrough,
	textColor,
	fontSize
};


// EXPORTS //

module.exports = main;
