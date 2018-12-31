'use strict';

// MODULES //

const fs = require( 'fs' );
const path = require( 'path' );
const nodemailer = require( 'nodemailer' );
const debug = require( 'debug' )( 'mailer' );
const replace = require( '@stdlib/string/replace' );
const noop = require( '@stdlib/utils/noop' );
const mailgunUser = require( './../credentials/mailgun.json' );


// VARIABLES //

const HTML_TEMPLATE = fs.readFileSync( path.join( __dirname, './email_template.txt' ) ).toString();


// MAIN  //

/**
* Creates a mailer instance.
*
* @param {Object} config - mailer configuration
* @param {Array} mails - array of mails
*/
function Mailer( config ) {
	var transportOptions;
	var self;

	self = this;
	transportOptions = {
		'service': 'Mailgun',
		'auth': mailgunUser
	};
	self.jobs = [];

	if ( !config ) {
		this.transporter = nodemailer.createTransport( transportOptions );
	} else {
		this.transporter = nodemailer.createTransport( config );
	}

	this.send = function send( mailOptions, clbk = noop ) {
		var date;
		if ( Object.prototype.hasOwnProperty.call( mailOptions, 'delay' ) ) {
			date = new Date().getTime();
			date += ( mailOptions.delay * 1000 );
			mailOptions.clbk = clbk;
			self.jobs.push( mailOptions );
		} else {
			mailOptions.date = date;
			mailOptions.html = replace( HTML_TEMPLATE, '{{text}}', mailOptions.text || '' );
			this.transporter.sendMail( mailOptions, clbk );
		}
	};

	this.init = function init() {
		debug( 'Mailer initialized.' );
		setInterval( self.check, 3000 );
	};
	this.check = function check() {
		var currentDate;
		var i;

		currentDate = new Date().getTime();
		i = self.jobs.length;
		while ( i-- ) {
			if ( self.jobs[ i ].date > currentDate ) {
				var clbk = self.jobs[ i ].clbk || noop;
				self.transporter.sendMail( self.jobs[ i ], clbk );
				self.jobs.splice( i, 1 );
			}
		}
	};
	self.init();
}


// EXPORTS //

module.exports = new Mailer();
