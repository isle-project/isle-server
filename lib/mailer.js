'use strict';

// MODULES //

var nodemailer = require( 'nodemailer' );
var debug = require( 'debug' )( 'mailer' );
var mailgunUser = require( './../credentials/mailgun.json' );


// MAILER //

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

	this.send = function send( mailOptions, clbk ) {
		var date;
		if ( Object.prototype.hasOwnProperty.call( mailOptions, 'delay' ) ) {
			date = new Date().getTime();
			date += ( mailOptions.delay * 1000 );
			mailOptions.date = date;
			self.jobs.push( mailOptions );
		} else {
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
				self.transporter.sendMail( self.jobs[ i ] );
				self.jobs.splice( i, 1 );
			}
		}
	};
	self.init();
} // end FUNCTION Mailer()


// EXPORTS //

module.exports = new Mailer();
