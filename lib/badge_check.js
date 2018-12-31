'use strict';

// MODULES //

var contains = require( '@stdlib/assert/contains' );
var objectKeys = require( '@stdlib/utils/keys' );
var debug = require( 'debug' )( 'badge-check' );
var badges = require( './badges.json' );


// VARIABLES //

const MASTERING_THRESHOLD = 0.75;


// FUNCTIONS //

function noMasteredLessons( lessonData ) {
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

function checkConditions( badge, user ) {
	let mastered;
	switch ( badge.name ) {
	case 'profile':
		return user.picture !== 'anonymous.jpg';
	case 'stamina':
		return user.spentTime > ( 60000 * 90 );
	case '10 lessons':
		mastered = noMasteredLessons( user.lessonData );
		return mastered >= 10;
	case '25 lessons':
		mastered = noMasteredLessons( user.lessonData );
		return mastered >= 25;
	case '50 lessons':
		mastered = noMasteredLessons( user.lessonData );
		return mastered >= 50;
	}
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

	// Check whether user should be awarded any new badges:
	const newBadges = [];
	for ( let i = 0; i < potentialBadges.length; i++ ) {
		if ( checkConditions( potentialBadges[ i ], user ) ) {
			newBadges.push( potentialBadges[ i ].name );
		}
	}
	debug( 'Return array of new badges: '+newBadges.join( ', ' ) );
	return newBadges;
}


// EXPORTS //

module.exports = badgeCheck;
