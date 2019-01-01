'use strict';

// MODULES //

const contains = require( '@stdlib/assert/contains' );
const objectKeys = require( '@stdlib/utils/keys' );
const debug = require( 'debug' )( 'badge-check' );
const badges = require( './badges.json' );


// VARIABLES //

const MASTERING_THRESHOLD = 0.75;


// FUNCTIONS //

function masteredLessons( lessonData ) {
	const keys = objectKeys( lessonData );
	let mastered = 0;
	for ( let i = 0; i < keys.length; i++ ) {
		const data = lessonData[ keys[ i ] ];
		if ( data.progress >= MASTERING_THRESHOLD ) {
			mastered += 1;
		}
	}
	return mastered;
}

function sumActionTypes( lessonData ) {
	const keys = objectKeys( lessonData );
	const out = {};
	for ( let i = 0; i < keys.length; i++ ) {
		const types = lessonData[ keys[ i ] ].actionTypes;
		if ( types ) {
			const typeNames = objectKeys( types );
			for ( let j = 0; j < typeNames.length; j++ ) {
				const name = typeNames[ j ];
				if ( out[ name ] ) {
					out[ name ] += types[ name ];
				} else {
					out[ name ] = types[ name ];
				}
			}
		}
	}
	return out;
}

function countMessages( lessonData ) {
	const keys = objectKeys( lessonData );
	let msgCount = 0;
	for ( let i = 0; i < keys.length; i++ ) {
		msgCount += lessonData[ keys[ i ] ].chatMessages;
	}
	return msgCount;
}


// MAIN //

function badgeCheck( user ) {
	const existingBadges = user.badges;
	const potentialBadges = [];
	for ( let i = 0; i < badges.length; i++ ) {
		const name = badges[ i ].name;
		debug( `Check whether badge with name ${name} has already been acquired...` );
		if ( !contains( existingBadges, name ) ) {
			potentialBadges.push( badges[ i ] );
		}
	}
	debug( 'Received array of potential badges...' );

	// Summarize user data:
	const lessonData = user.lessonData;
	const actionTypes = sumActionTypes( lessonData );
	const mastered = masteredLessons( lessonData );
	const msgCount = countMessages( lessonData );
	const nFeedbacks = actionTypes[ 'USER_FEEDBACK_UNDERSTOOD' ] + actionTypes[ 'USER_FEEDBACK_CONFUSED' ] + ( 5 * actionTypes[ 'USER_FEEDBACK_FORM' ] );

	// Check whether user should be awarded any new badges:
	const newBadges = [];
	for ( let i = 0; i < potentialBadges.length; i++ ) {
		if ( checkConditions( potentialBadges[ i ] ) ) {
			newBadges.push( potentialBadges[ i ].name );
		}
	}
	debug( 'Return array of new badges: '+newBadges.join( ', ' ) );
	return newBadges;

	function checkConditions( badge ) {
		switch ( badge.name ) {
		case 'profile':
			return user.picture !== 'anonymous.jpg';
		case 'stamina':
			return user.spentTime > ( 60000 * 90 );
		case '10 lessons':
			return mastered >= 10;
		case '25 lessons':
			return mastered >= 25;
		case '50 lessons':
			return mastered >= 50;
		case '100 chats':
			return msgCount >= 100;
		case '500 chats':
			return msgCount >= 500;
		case '25 feedbacks':
			return nFeedbacks >= 25;
		case '100 feedbacks':
			return nFeedbacks >= 100;
		}
	}
}


// EXPORTS //

module.exports = badgeCheck;
