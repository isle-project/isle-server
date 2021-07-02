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

const fs = require( 'fs' );
const path = require( 'path' );
const nodemailer = require( 'nodemailer' );
const debug = require( 'debug' )( 'mailer' );
const replace = require( '@stdlib/string/replace' );
const noop = require( '@stdlib/utils/noop' );
const { mailgun } = require( './../credentials.js' );
const config = require( './../../etc/config.json' );


// VARIABLES //

let HTML_TEMPLATE = fs.readFileSync( path.join( __dirname, './email_template.txt' ) ).toString();
HTML_TEMPLATE = replace( HTML_TEMPLATE, '{{server}}', config.server );
let HTML_TEMPLATE_WITH_LINK = fs.readFileSync( path.join( __dirname, './email_template_with_link.txt' ) ).toString();
HTML_TEMPLATE_WITH_LINK = replace( HTML_TEMPLATE_WITH_LINK, '{{server}}', config.server );


// MAIN  //

/**
* Creates a mailer instance.
*
* @param {Object} config - mailer configuration
* @param {Array} mails - array of mails
*/
function Mailer( config ) {
	const self = this;
	const transportOptions = {
		'service': 'Mailgun',
		'auth': mailgun
	};
	self.jobs = [];

	if ( !config ) {
		this.transporter = nodemailer.createTransport( transportOptions );
	} else {
		this.transporter = nodemailer.createTransport( config );
	}
	self.active = false;
	this.transporter.verify( function onVerification( error, success ) {
		if ( error ) {
			debug( 'Encountered an error: '+error.message );
			self.active = false;
		} else {
			debug( 'Server is ready to send emails.' );
			self.active = true;
		}
	});
	this.send = function send( mailOptions, clbk = noop ) {
		if ( !mailOptions.subject || ( !mailOptions.text && !mailOptions.html ) ) {
			debug( 'Skipping trying to send empty email: '+JSON.stringify( mailOptions ) );
			return;
		}
		let date;
		if ( Object.prototype.hasOwnProperty.call( mailOptions, 'delay' ) ) {
			date = new Date().getTime();
			date += ( mailOptions.delay * 1000 );
			mailOptions.clbk = clbk;
			self.jobs.push( mailOptions );
		} else {
			mailOptions.date = date;
			if ( mailOptions.link ) {
				let html = replace( HTML_TEMPLATE_WITH_LINK, '{{text}}', mailOptions.text || '' );
				html = replace( html, '{{link}}', mailOptions.link );
				mailOptions.html = html;
			} else {
				mailOptions.html = replace( HTML_TEMPLATE, '{{text}}', mailOptions.text || '' );
			}
			this.transporter.sendMail( mailOptions, clbk );
		}
	};

	this.init = function init() {
		debug( 'Mailer initialized.' );
		setInterval( self.check, 3000 );
	};
	this.check = function check() {
		const currentDate = new Date().getTime();
		let i = self.jobs.length;
		while ( i-- ) {
			if ( self.jobs[ i ].date > currentDate ) {
				const clbk = self.jobs[ i ].clbk || noop;
				self.transporter.sendMail( self.jobs[ i ], clbk );
				self.jobs.splice( i, 1 );
			}
		}
	};
	self.init();
}


// EXPORTS //

module.exports = new Mailer();
