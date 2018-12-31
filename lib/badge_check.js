'use strict';

// MODULES //

var contains = require( '@stdlib/assert/contains' );
var objectKeys = require( '@stdlib/utils/object-keys' );
var debug = require( 'debug' )( 'badge-check' );
var badges = require( './badges.json' );


// FUNCTIONS //

function checkConditions( badge, user ) {
	const lessonKeys = objectKeys( user.lessonData );
	switch ( badge.name ) {
	case 'profile':
		return user.picture !== 'anonymous.jpg';
	case 'stamina':
		return user.spentTime > ( 60000 * 90 );
	case '10 lessons':
		return lessonKeys.length >= 5;
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
