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

const router = require( 'express' ).Router();
const { stat } = require( 'fs/promises' );
const multer = require( 'multer' );
const isObject = require( '@stdlib/assert/is-object' );
const isJSON = require( '@stdlib/assert/is-json' );
const debug = require( './debug' );
const storage = require( './storage' );
const passport = require( './passport.js' );
const validateObjectId = require( './helpers/validate_object_id.js' );
const validateString = require( './helpers/validate_string.js' );
const validateOwner = require( './helpers/validate_owner.js' );
const validateAdmin = require( './helpers/validate_admin.js' );
const wrapAsync = require( './utils/wrap_async.js' );
const ErrorStatus = require( './helpers/error.js' );
const Namespace = require( './models/namespace.js' );
const Ticket = require( './models/ticket.js' );
const File = require( './models/file.js' );
const User = require( './models/user.js' );
const mailer = require( './mailer' );
const { NOTIFICATIONS_EMAIL, SERVER_HOST_NAME } = require( './constants.js' );


// VARIABLES //

const TICKET_PRIORITIES = [ 'Low', 'Middle', 'High' ];
const attachmentsUpload = multer({ storage: storage }).array( 'attachment', 6 );


// FUNCTIONS //

async function sendCreatedTicketNotification( ticketID, { namespace, user, title, description }, t ) {
	const result = await Namespace
		.findOne({ _id: namespace })
		.populate( 'owners', [ 'email', 'name' ])
		.exec();
	const { owners } = result;
	const emails = new Set();
	const administrators = await User.find({ administrator: true });

	const users = [];
	for ( let i = 0; i < owners.length; i++ ) {
		const user = owners[ i ];
		if ( !emails.has( user.email ) ) {
			emails.add( user.email );
			users.push( user );
		}
	}
	for ( let i = 0; i < administrators.length; i++ ) {
		const admin = administrators[ i ];
		if ( !emails.has( admin.email ) ) {
			emails.add( admin.email );
			users.push( admin );
		}
	}
	for ( let i = 0; i < users.length; i++ ) {
		const recipient = users[ i ];
		const link = recipient.administrator ?
			`${SERVER_HOST_NAME}/dashboard/#/admin/tickets?ticket=${ticketID}` :
			`${SERVER_HOST_NAME}/dashboard/#/namespace-data/${result.title}/tickets?ticket=${ticketID}`;
		const mail = {
			'from': NOTIFICATIONS_EMAIL,
			'subject': t('ticket-created-title', { title } ),
			'to': recipient.email,
			'text': `
					${t('ticket-created-email', {
						recipient: recipient.name,
						user: user.name,
						email: user.email,
						namespace: result.title
					})}
					<br />
					<br />
					<b>${title}:</b> <br />
					${description}
					<br />
					<br />
					${t('ticket-email-disclaimer')}
			`,
			'link': link
		};
		debug( 'Mail: ' + JSON.stringify( mail ) );
		mailer.send( mail, function onDone( error ) {
			if ( error ) {
				throw new ErrorStatus( 503, t( 'email-service-not-available' ) );
			}
		});
	}
}

function sendTicketMessageNotification( ticket, sender, message, t ) {
	const emails = new Set();
	const recipients = [];
	if ( ticket.user.email !== sender.email ) {
		const ticketAuthor = ticket.user;
		emails.add( ticket.user.email );
		const mail = {
			'from': NOTIFICATIONS_EMAIL,
			'subject': t('ticket-own-reply-title', { title: ticket.title }),
			'to': ticketAuthor.email,
			'text': `
				${t('ticket-own-reply-email', {
					recipient: ticketAuthor.name,
					sender: sender.name,
					email: sender.email
				})}
				<br />
				<br />
				${message}
				<br />
				<br />
				${t('ticket-email-disclaimer')}
			`,
			'link': `${SERVER_HOST_NAME}/dashboard/#/profile?ticket=${ticket._id}`
		};
		debug( 'Mail: ' + JSON.stringify( mail ) );
		mailer.send( mail, function onDone( error ) {
			if ( error ) {
				throw new ErrorStatus( 503, t( 'email-service-not-available' ) );
			}
		});
	}
	ticket.messages.forEach( x => {
		if ( !emails.has( x.email ) && sender.email !== x.email ) {
			emails.add( x.email );
			recipients.push({
				email: x.email,
				name: x.author
			});
		}
	});
	debug( 'Send email to '+recipients.length+' recipients...' );
	for ( let i = 0; i < recipients.length; i++ ) {
		const recipient = recipients[ i ];
		const link = recipient.administrator ?
			`${SERVER_HOST_NAME}/dashboard/#/admin/tickets?ticket=${ticket._id}` :
			`${SERVER_HOST_NAME}/dashboard/#/namespace-data/${ticket.namespace.title}/tickets?ticket=${ticket._id}`;
		const mail = {
			'from': NOTIFICATIONS_EMAIL,
			'subject': t('ticket-reply-title', { title: ticket.title }),
			'to': recipient.email,
			'text': `
				${t('ticket-reply-email', {
					recipient: recipient.name,
					sender: sender.name,
					email: sender.email,
					ticket: ticket.title,
					namespace: ticket.namespace.title
				})}
				<br />
				<br />
				${message}
				<br />
				<br />
				${t('ticket-email-disclaimer')}
			`,
			'link': link
		};
		debug( 'Mail: ' + JSON.stringify( mail ) );
		mailer.send( mail, function onDone( error ) {
			if ( error ) {
				throw new ErrorStatus( 503, t( 'email-service-not-available' ) );
			}
		});
	}
}


// MAIN //

router.post( '/create_ticket',
	attachmentsUpload,
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onCreateTicket( req, res ) {
		const { lessonID, namespaceID, title, description } = req.body;
		debug( `Create ticket for namespace with id ${namespaceID} and lesson ${lessonID}...`);

		validateObjectId( namespaceID, 'namespaceID', req.t );
		validateObjectId( lessonID, 'lessonID', req.t );
		validateString( title, 'title', req.t );
		validateString( description, 'description', req.t );

		if ( req.body.component ) {
			validateString( req.body.component, 'component', req.t );
		}
		let platform = req.body.platform;
		if ( isJSON( platform ) ) {
			platform = JSON.parse( platform );
		}
		if ( !isObject( platform ) ) {
			return res.status( 400 ).send( req.t( 'field-expect-object', {
				field: 'platform'
			}) );
		}
		const attachments = [];
		if ( req.files ) {
			const files = req.files;
			debug( `Processing ${files.length} files...` );
			for ( let i = 0; i < files.length; i++ ) {
				const file = files[ i ];
				const fileMetaData = {
					user: req.user,
					title: file.originalname,
					filename: file.filename,
					path: file.path,
					type: file.mimetype,
					owner: false
				};
				const stats = await stat( file.path );
				const fileSizeInBytes = stats.size;
				const fileSizeInMegabytes = fileSizeInBytes / 1e6;
				fileMetaData.size = fileSizeInMegabytes;
				fileMetaData.namespace = namespaceID;
				if ( lessonID ) {
					fileMetaData.lesson = lessonID;
				}
				const savedFile = new File( fileMetaData );
				await savedFile.save();
				attachments.push( savedFile );
			}
		} else {
			debug( 'Create ticket with no attachments...' );
		}
		const ticketObj = {
			namespace: namespaceID,
			lesson: lessonID,
			user: req.user,
			title: title,
			description: description,
			component: req.body.component,
			platform,
			attachments
		};
		const ticket = new Ticket( ticketObj );
		await ticket.save();
		sendCreatedTicketNotification( ticket._id, ticketObj, req.t );
		res.json({
			message: 'ok',
			attachments
		});
	})
);

router.get( '/get_all_tickets',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetTickets( req, res ) {
		validateAdmin( req );

		const tickets = await Ticket
			.find({})
			.populate( 'user', [ 'name', 'email', 'picture' ] )
			.populate( 'lesson', [ 'title' ] )
			.populate( 'namespace', [ 'title' ] )
			.exec();
		res.json({ message: 'ok', tickets });
	})
);

router.get( '/get_course_tickets',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetTickets( req, res ) {
		const { namespaceID } = req.query;
		validateObjectId( namespaceID, 'namespaceID', req.t );
		await validateOwner( req, namespaceID );

		const tickets = await Ticket
			.find({
				namespace: namespaceID
			})
			.populate( 'user', [ 'name', 'email', 'picture' ] )
			.populate( 'lesson', [ 'title' ] )
			.exec();
		res.json({ message: 'ok', tickets });
	})
);

router.get( '/get_user_tickets',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onGetTickets( req, res ) {
		const tickets = await Ticket
			.find({
				user: req.user
			})
			.populate( 'user', [ 'name', 'email', 'picture' ] )
			.populate( 'lesson', [ 'title' ] )
			.populate( 'namespace', [ 'title' ] )
			.populate( 'attachments', [ 'title', 'path', 'filename' ] )
			.exec();
		res.json({ message: 'ok', tickets });
	})
);

router.post( '/delete_ticket',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onDeleteTicket( req, res ) {
		validateAdmin( req );
		validateObjectId( req.body.id, 'id', req.t );
		const status = await Ticket.deleteOne({ _id: req.body.id });
		res.json({ message: req.t( 'ticket-deleted' ), status });
	})
);

router.post( '/update_ticket_priority',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onPriorityIncrease( req, res ) {
		const { ticketID, priority } = req.body;

		if ( !TICKET_PRIORITIES.includes( priority ) ) {
			return res.status( 400 ).send(
				req.t( 'field-expect-categories', { field: 'priority', values: TICKET_PRIORITIES })
			);
		}
		validateObjectId( ticketID, 'ticketID', req.t );
		await Ticket.updateOne(
			{ _id: ticketID },
			{ priority }
		);
		res.json({ message: 'ok' });
	})
);

router.post( '/add_ticket_message',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onAddTicketMessage( req, res ) {
		const { ticketID, body } = req.body;

		validateObjectId( ticketID, 'ticketID', req.t );

		const ticket = await Ticket
			.findById( ticketID )
			.populate( 'user', [ 'name', 'email' ])
			.populate( 'namespace', 'title' )
			.exec();
		ticket.messages.unshift({
			body,
			author: req.user.name,
			email: req.user.email,
			picture: req.user.picture
		});
		await ticket.save();
		sendTicketMessageNotification( ticket, req.user, body, req.t );
		res.json({ message: req.t( 'ticket-message-added' ) });
	})
);

router.post( '/open_ticket',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onTicketOpen( req, res ) {
		const { ticketID } = req.body;
		validateObjectId( ticketID, 'ticketID', req.t );

		await Ticket.updateOne(
			{ _id: ticketID },
			{ done: false }
		);
		res.json({ message: req.t( 'ticket-opened' ) });
	})
);

router.post( '/close_ticket',
	passport.authenticate( 'jwt', { session: false }),
	wrapAsync( async function onTicketClose( req, res ) {
		const { ticketID } = req.body;
		validateObjectId( ticketID, 'ticketID', req.t );

		await Ticket.updateOne(
			{ _id: ticketID },
			{ done: true }
		);
		res.json({ message: req.t( 'ticket-closed' ) });
	})
);


// EXPORTS //

module.exports = router;
