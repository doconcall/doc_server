const Database = require('./dynamoDBWrapper');
const geolib = require('geolib');

function getBoundingBox(lat, lon) {
	let points = [];
	for (let i = 0; i < 4; i++)
		points.push(geolib.computeDestinationPoint({lat: lat, lon: lon}, 2500, 90 * i));
	return {
		top: Math.max(points[0].latitude, points[2].latitude),
		right: Math.max(points[1].longitude, points[3].longitude),
		bottom: Math.min(points[0].latitude, points[2].latitude),
		left: Math.min(points[1].longitude, points[3].longitude)
	};
}

function flattenGeoSearch(array) {
	return array.map(obj => obj.email);
}

let searchRadius = 10000;

module.exports = {
	serverKey: 'AAAAgO7z7Fs:APA91bEBdhyYAP7txX1rhtalypEhSw73JqpNXiRKLz-nHkNmBQiu4Q-i5OrAt039K5gGPSHK87hKywvw5ave42W9t2dtEwuaJciKb7voswvuClaA46b6zQpCkrqJa02oTABnr4aaRe-g',
	initTables(db, schema, create) {
		for (let table in schema)
			if (schema.hasOwnProperty(table))
				db.describeTable(table, schema[table]);
		return create ? db.createTables() : db;
	},
	findNearby(database, table, sos, radius, attr) {
		if (radius > searchRadius) throw new Error('range should be less than ' + searchRadius + 'm');
		return new Promise((resolve, reject) => {
			let {top, right, bottom, left} = getBoundingBox(sos.lat, sos.lon, radius);
			Database.getResult(database.getQueryBuilder(table)
				.where('lat').between(bottom, top)
				.where('lon').between(left, right)
				.attributes('email'))
				.then(result => {
					sos[attr] = flattenGeoSearch([].concat(result));
					resolve(sos);
				})
				.catch(reject);
		});
	},
	clone(obj) {
		return Object.assign({}, obj);
	}
};