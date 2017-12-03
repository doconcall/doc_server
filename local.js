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
	//firebase server key to send notifications
	serverKey: 'AAAAgO7z7Fs:APA91bEBdhyYAP7txX1rhtalypEhSw73JqpNXiRKLz-nHkNmBQiu4Q-i5OrAt039K5gGPSHK87hKywvw5ave42W9t2dtEwuaJciKb7voswvuClaA46b6zQpCkrqJa02oTABnr4aaRe-g',
	/**
	 * initializes table in dynamoDB
	 * @param db: database object that needs tables to be initialized with
	 * @param schema: schema of all the tables
	 * @param create: boolean specifying whether we should create new tables, ignore if already created
	 * @returns {*}
	 */
	initTables(db, schema, create) {
		for (let table in schema)
			if (schema.hasOwnProperty(table))
				db.describeTable(table, schema[table]);
		return create ? db.createTables() : db;
	},
	/**
	 * finds all nearby doctors within the specified radius
	 * @param database: the database we want to search doctors or transit services in
	 * @param table: can only be doctor or transit
	 * @param sos: the object we populate with found doctors or transit service
	 * @param radius: radius of search
	 * @param attr: the attribute we populate found doctors or transit service
	 * @returns {Promise}
	 */
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