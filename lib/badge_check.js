'use strict';

// MODULES //

var contains = require( '@stdlib/assert/contains' );
var badges = require( './badges.json' );


// FUNCTIONS //

function checkConditions( badge, user ) {
	switch ( badge.name ) {
	case 'profile':
		return user.picture !== 'anonymous.jpg';
	}
}


// MAIN //

function badgeCheck( user ) {
	const existingBadges = user.badges;
	const potentialBadges = [];
	console.log( badges );
	for ( let i = 0; badges.length; i++ ) {
		if ( !contains( existingBadges, badges[ i ].name ) ) {
			potentialBadges.push( badges[ i ] );
		}
	}
	// Check whether user should be awarded any new badges:
	const newBadges = [];
	for ( let i = 0; i < potentialBadges.length; i++ ) {
		if ( checkConditions( potentialBadges[ i ], user ) ) {
			newBadges.push( potentialBadges[ i ].name );
		}
	}
	return newBadges;
}


// EXPORTS //

module.exports = badgeCheck;
