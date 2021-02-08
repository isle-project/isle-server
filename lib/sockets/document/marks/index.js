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
	link, // Render links first, see: https://discuss.prosemirror.net/t/prevent-marks-from-breaking-up-links/401/5
	code,
	em,
	fontSize,
	strikethrough,
	strong,
	subscript,
	superscript,
	textColor,
	underline // Render underlines last so they have the correct text color
};


// EXPORTS //

module.exports = main;
