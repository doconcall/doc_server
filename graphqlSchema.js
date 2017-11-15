const {
	GraphQLSchema,
	GraphQLNonNull,
	GraphQLObjectType,
	GraphQLString,
	GraphQLInt,
	GraphQLFloat,
	GraphQLBoolean,
	GraphQLList
} = require('graphql');
const crypto = require('crypto2');
const FCM = require('fcm-push');
const Database = require('./dynamoDBWrapper');
const {findNearby, clone, serverKey} = require('./local');

function putTimestamp(obj, property) {
	obj[property] = new Date().getTime();
	return obj;
}

function hashPassword(obj) {
	return new Promise((resolve, reject) =>
		crypto.hash.sha256(obj.password,
			(err, hash) => {
				if (err) return reject(err);
				obj.password = hash;
				resolve(obj);
			}));
}

function sendResolved(database, dids, selected, fcm, id) {
	if(!dids) return [];
	let rejected = dids.filter(doctorID => doctorID !== selected);
	//get device id of all doctors who are not selected
	if (rejected.length === 0) return null;
	Database.getResult(database.getQueryBuilder('doctor')
		.where('email').in(rejected))
		.then(deviceIDs =>
			Promise.all(
				//send resolved notification to each doctor
				([].concat(deviceIDs))
					.map(({deviceID}) =>
						deviceID && deviceID !== "null" ?
							fcm.send({
								to: deviceID,
								data: {
									title: 'resolved',
									body: id
								}
							}) : null))
		);
}

const doctorType = new GraphQLObjectType({
	name: 'doctor',
	description: 'data type representing a doctor registered with the service',
	fields: () => ({
		email: {type: new GraphQLNonNull(GraphQLString), description: 'registered email id'},
		info: {
			type: new GraphQLObjectType({
				name: 'doctorInfo',
				description: 'redundant information about the registered doctor',
				fields: () => ({
					name: {type: GraphQLString, description: 'name of the doctor'},
					designation: {type: GraphQLString, description: 'current job description of the doctor'},
					phone: {type: GraphQLString, description: 'cellular contact no'}
				})
			})
		},
		lat: {type: GraphQLFloat, description: 'latest latitude reported'},
		lon: {type: GraphQLFloat, description: 'latest longitude reported'},
		accepted: {type: GraphQLInt, description: 'sos request completed by the doctor'},
		total: {type: GraphQLInt, description: 'total request delivered to the doctor'},
		deviceID: {type: GraphQLString, description: 'device id to send push notification'}
	})
});

const transitType = new GraphQLObjectType({
	name: 'ambulance',
	description: 'data type representing a transit service registered with this service',
	fields: () => ({
		email: {type: new GraphQLNonNull(GraphQLString), description: 'registered email id'},
		info: {
			type: new GraphQLObjectType({
				name: 'transitInfo',
				description: 'redundant information about the registered doctor',
				fields: () => ({
					name: {type: GraphQLString, description: 'name of the transit'},
					phone: {type: GraphQLString, description: 'cellular contact no'}
				})
			})
		},
		lat: {type: GraphQLFloat, description: 'latest latitude reported'},
		lon: {type: GraphQLFloat, description: 'latest longitude reported'},
		accepted: {type: GraphQLInt, description: 'sos request completed by the ambulance'},
		total: {type: GraphQLInt, description: 'total request delivered to the ambulance'},
		deviceID: {type: GraphQLString, description: 'device id to send push notification'}
	})
});

const clientType = new GraphQLObjectType({
	name: 'client',
	description: 'data type representing a client registered with the service',
	fields: () => ({
		email: {type: new GraphQLNonNull(GraphQLString), description: 'registered email id'},
		info: {
			type: new GraphQLObjectType({
				name: 'clientInfo',
				description: 'redundant information about the registered client',
				fields: () => ({
					name: {type: GraphQLString, description: 'name of the client'},
					phone: {type: GraphQLString, description: 'cellular contact no'},
					history: {type: GraphQLString, description: 'medical history pre saved by the client'}
				})
			})
		},
		deviceID: {type: GraphQLString, description: 'device id to send push notification'}
	})
});

const sosRequest = new GraphQLObjectType({
	name: 'sosRequest',
	description: 'data type representing an sos request made by any registered client',
	fields: () => ({
		id: {type: GraphQLString, description: 'unique request id, generated automatically'},
		cid: {type: GraphQLString, description: 'client email id making the request'},
		lat: {type: GraphQLFloat, description: 'latitude of the request'},
		lon: {type: GraphQLFloat, description: 'longitude of the request'},
		note: {type: GraphQLString, description: 'additional information provided by the client making the request'},
		dids: {type: new GraphQLList(GraphQLString), description: 'email ids of doctors that are nearby'},
		fulfilled: {type: GraphQLString, description: 'email id of that doctor who has accepted the sos'},
		rejection: {type: GraphQLInt, description: 'rejection count of particular sos'},
		resolved: {type: GraphQLBoolean, description: 'state of the request'},
		createdAt: {type: GraphQLString, description: 'unix time when the request was created'},
		updatedAt: {type: GraphQLString, description: 'unix time when the request was updated'}
	})
});

const transitRequest = new GraphQLObjectType({
	name: 'transitRequest',
	description: 'data type representing an sos request made by any registered client',
	fields: () => ({
		id: {type: GraphQLString, description: 'unique request id, generated automatically'},
		did: {type: GraphQLString, description: 'doctor email id making the request'},
		lat: {type: GraphQLFloat, description: 'latitude of the request'},
		lon: {type: GraphQLFloat, description: 'longitude of the request'},
		note: {type: GraphQLString, description: 'additional information provided by the doctor making the request'},
		tids: {type: new GraphQLList(GraphQLString), description: 'email ids of doctors that are nearby'},
		fulfilled: {type: GraphQLString, description: 'email id of that doctor who has accepted the sos'},
		rejection: {type: GraphQLInt, description: 'rejection count of particular sos'},
		resolved: {type: GraphQLBoolean, description: 'state of the request'},
		createdAt: {type: GraphQLString, description: 'unix time when the request was created'},
		updatedAt: {type: GraphQLString, description: 'unix time when the request was updated'}
	})
});

module.exports = (database) =>
	new GraphQLSchema({
		query: new GraphQLObjectType({
			name: 'query',
			description: 'methods for GET requests',
			fields: () => ({
				hello: {
					type: GraphQLString,
					description: 'GET test request',
					args: {
						name: {
							name: 'name',
							type: GraphQLString
						}
					},
					resolve: (parent, args) => `hello ${( args.name || 'world')}`
				},
				doctor: {
					type: doctorType,
					description: 'login method for doctor',
					args: {
						email: {
							name: 'email',
							description: 'email id to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) =>
						Promise.all([
								hashPassword({password: args.password}),
								Database.getResult(database.getQueryBuilder('doctor')
									.where('email').equals(args.email))
							])
							.then(results => {
								if (results[1].length === 0) throw new Error(404);
								let {password} = results[0];
								if (password !== results[1].password) throw new Error(401);
								return results[1];
							})
				},
				/*doctors: {
					type: new GraphQLList(doctorType),
					description:'get info of doctors',
					args: {
						ids: {
							name: 'ids',
							description:'',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) => Database.getResult(database.getQueryBuilder('doctor').where('email').in(JSON.parse(args.ids)))
				},*/
				client: {
					type: clientType,
					description: 'login method for client',
					args: {
						email: {
							name: 'email',
							description: 'email id to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) =>
						Promise.all([
								hashPassword({password: args.password}),
								Database.getResult(database.getQueryBuilder('client')
									.where('email').equals(args.email))
							])
							.then(results => {
								if (results[1].length === 0) throw new Error(404);
								let {password} = results[0];
								if (password !== results[1].password) throw new Error(401);
								return results[1];
							})
				},
				transit: {
					type: transitType,
					description: 'login method for transit',
					args: {
						email: {
							name: 'email',
							description: 'email id to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) =>
						Promise.all([
								hashPassword({password: args.password}),
								Database.getResult(database.getQueryBuilder('transit')
									.where('email').equals(args.email))
							])
							.then(results => {
								if (results[1].length === 0) throw new Error(404);
								let {password} = results[0];
								if (password !== results[1].password) throw new Error(401);
								return results[1];
							})
				},
				sosHistory: {
					type: new GraphQLList(sosRequest),
					description: 'sosRequest history method',
					args: {
						email: {
							name: 'email',
							description: 'email id to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						},
						type: {
							name: 'type',
							description: 'can be one of client or doctor',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) =>
						hashPassword({password: args.password})
							.then(({password}) =>
								Database.getResult(database.getQueryBuilder(args.type)
									.where('email').equals(args.email)
									.where('password').equals(password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								if (args.type === 'doctor')
									return Database.getResult(database.getQueryBuilder('request')
										.where('dids').contains(args.email));
								else return Database.getResult(database.getQueryBuilder('request')
									.where('cid').equals(args.email));
							})
							.then(results => [].concat(results))
				},
				transitHistory: {
					type: new GraphQLList(transitRequest),
					description: 'transitRequest history method',
					args: {
						email: {
							name: 'email',
							description: 'email id to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						},
						type: {
							name: 'type',
							description: 'can be one of doctor or transit',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) =>
						hashPassword({password: args.password})
							.then(({password}) =>
								Database.getResult(database.getQueryBuilder(args.type)
									.where('email').equals(args.email)
									.where('password').equals(password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								if (args.type === 'transit')
									return Database.getResult(database.getQueryBuilder('transitRequest')
										.where('tids').contains(args.email));
								else return Database.getResult(database.getQueryBuilder('transitRequest')
									.where('did').equals(args.email));
							})
							.then(results => [].concat(results))
				},
				getInfo: {
					type: GraphQLString,
					description: 'info of any doctor, client or transit',
					args: {
						fromEmail: {
							name: 'fromEmail',
							description: 'email id to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						fromPassword: {
							name: 'fromPassword',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						},
						fromType: {
							name: 'fromType',
							description: 'can be one of client, doctor or transit',
							type: new GraphQLNonNull(GraphQLString)
						},
						requestEmail: {
							name: 'requestEmail',
							description: 'email id of the person whose information is requested',
							type: new GraphQLNonNull(GraphQLString)
						},
						requestType: {
							name: 'requestType',
							description: 'type of the person whose information is requested, can only be client, doctor or transit',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, {fromEmail, fromPassword, fromType, requestEmail, requestType}) =>
						Promise.all([
								hashPassword({password: fromPassword}),
								Database.getResult(database.getQueryBuilder(fromType)
									.where('email').equals(fromEmail))
							])
							.then(results => {
								if (results[1].length === 0) throw new Error(404);
								if (results[0].password !== results[1].password) throw new Error(401);
								return Database.getResult(database.getQueryBuilder(requestType)
									.where('email').equals(requestEmail))
							})
							.then(data => {
								if (data.length === 0) throw new Error(404);
								delete data.password;
								delete data.deviceID;
								delete data.updatedAt;
								delete data.createdAt;
								if (requestType !== 'client') {
									delete data.lat;
									delete data.lon;
									delete data.accepted;
									delete data.total;
								}
								return JSON.stringify(data);
							})
				}
			})
		}),
		mutation: new GraphQLObjectType({
			name: 'mutation',
			description: 'methods for PUT, POST requests',
			fields: () => ({
				hello: {
					type: GraphQLString,
					description: 'PUT test method',
					args: {
						name: {
							name: 'name',
							type: GraphQLString
						}
					},
					resolve: (parent, args) => `hello ${( args.name || 'world')}`
				},
				newDoctor: {
					type: doctorType,
					description: 'sign up method for doctor',
					args: {
						doctor: {
							name: 'doctor',
							description: 'JSON of doctor credentials\nRequires email, password, name, phone and designation',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, {doctor}) =>
						hashPassword(JSON.parse(doctor))
							.then(hashed => database.putItems('doctor', Object.assign({accepted: 0, total: 0},
								putTimestamp(hashed, 'createdAt'))))
				},
				newClient: {
					type: clientType,
					description: 'sign up method for client',
					args: {
						client: {
							name: 'client',
							description: 'JSON of doctor credentials\nRequires email, password, name, phone, medical history',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, {client}) =>
						hashPassword(JSON.parse(client))
							.then(hashed => database.putItems('client', putTimestamp(hashed, 'createdAt')))
				},
				newTransit: {
					type: transitType,
					description: 'sign up method for transit',
					args: {
						transit: {
							name: 'transit',
							description: 'JSON of transit credentials\nRequires email, password, name, phone',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, {transit}) =>
						hashPassword(JSON.parse(transit))
							.then(hashed => database.putItems('transit', Object.assign({accepted: 0, total: 0},
								putTimestamp(hashed, 'createdAt'))))
				},
				newSOS: {
					type: sosRequest,
					description: 'method to broadcast new sosRequest from only client',
					args: {
						email: {
							name: 'email',
							description: 'email to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						},
						sos: {
							name: 'sos',
							description: 'JSON of sos request\nShould contain cid, lat, lon, note',
							type: new GraphQLNonNull(GraphQLString)
						},
						radius: {
							name: 'radius',
							description: 'search radius of the sos',
							type: new GraphQLNonNull(GraphQLFloat)
						},
						
					},
					resolve: (parent, args) => {
						let fcm = new FCM(serverKey);
						return hashPassword({password: args.password})
							.then(({password}) => Database.getResult(database.getQueryBuilder('client')
								.where('email').equals(args.email)
								.where('password').equals(password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								//find nearby doctors
								return findNearby(database, 'doctor', Object.assign(JSON.parse(args.sos), {resolved: false}), args.radius, 'dids')
							})
							//put the sos request in the table
							.then(sos => database.putItems('request', putTimestamp(sos, 'createdAt')))
							.then(sos => Promise.all([sos]
								.concat(sos.dids ?
									sos.dids
										.map(doctor =>
											//update each doctor stat
											database.updateItem('doctor', putTimestamp({
													email: doctor,
													total: {$add: 1}
												}, 'updatedAt'))
												.then(({deviceID}) =>
													//send notification to doctor if deviceID available
													deviceID && deviceID !== "null" ? fcm.send({
														to: deviceID,
														data: {
															title: 'sos',
															body: JSON.stringify({
																id: sos.id,
																lat: sos.lat,
																lon: sos.lon,
																note: sos.note
															})
														}
													}) : null
												)) : null)))
							.then(results => results[0])
					}
				},
				extendRange: {
					type: sosRequest,
					description: 'method to extend search radius of any existing sosRequest',
					args: {
						email: {
							name: 'email',
							description: 'email to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						},
						id: {
							name: 'id',
							description: 'sos id to extend its search radius',
							type: new GraphQLNonNull(GraphQLString)
						},
						radius: {
							name: 'radius',
							description: 'extended search radius',
							type: new GraphQLNonNull(GraphQLFloat)
						}
					},
					resolve: (parent, args) => {
						let fcm = new FCM(serverKey);
						return hashPassword({password: args.password})
							.then(({password}) => Database.getResult(database.getQueryBuilder('client')
								.where('email').equals(args.email)
								.where('password').equals(password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								return Database.getResult(database.getQueryBuilder('request')
									.where('id').equals(args.id));
							})
							.then(sos => Promise.all([sos, findNearby(database, 'doctor', clone(sos), args.radius, 'dids')]))
							.then(results => {
								let prev = results[0].dids, more = results[1].dids.filter(i => !prev.includes(i));
								//merge the new doctor list with new ones
								//update the request with new doctors
								return Promise.all([
									more,
									database.updateItem('request', putTimestamp({
										id: args.id,
										dids: prev.concat(more)
									}, 'updatedAt'))
								]);
							})
							//send push notification to new doctors
							.then(results => Promise.all([results[1]]
								.concat(results[0].map(doctor =>
									//update new doctor stat
									database.updateItem('doctor', putTimestamp({
											email: doctor,
											total: {$add: 1}
										}, 'updatedAt'))
										.then(({deviceID}) =>
											//send notification to doctor if deviceID available
											deviceID && deviceID !== "null" ? fcm.send({
												to: deviceID,
												data: {
													title: 'sos',
													body: JSON.stringify({
														id: results[1].id,
														lat: results[1].lat,
														lon: results[1].lon,
														note: results[1].note
													})
												}
											}) : null
										)))))
							.then(results => results[0]);
						
					}
				},
				newTransitRequest: {
					type: transitRequest,
					description: 'method to broadcast new transit request from only doctors',
					args: {
						email: {
							name: 'email',
							description: 'email to authenticate ',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						},
						request: {
							name: 'request',
							description: 'id of the sos request with which this request is associated',
							type: new GraphQLNonNull(GraphQLString)
						},
						radius: {
							name: 'radius',
							description: 'search radius of this request',
							type: new GraphQLNonNull(GraphQLFloat)
						},
					},
					resolve: (parent, args) => {
						let transitReq = null;
						let fcm = new FCM(serverKey);
						return hashPassword({password: args.password})
							.then(({password}) => Database.getResult(database.getQueryBuilder('doctor')
								.where('email').equals(args.email)
								.where('password').equals(password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								//find nearby transits
								return findNearby(database, 'transit', Object.assign(JSON.parse(args.request), {resolved: false}), args.radius, 'tids')
							})
							.then(trans => database.putItems('transitRequest', putTimestamp(trans, 'createdAt')))
							.then(trans =>
								Promise.all(
									(transitReq = trans).tids
										.map(transit =>
											//update each transit service stat
											database.updateItem('transit', putTimestamp({
													email: transit,
													total: {$add: 1}
												}, 'updatedAt'))
												.then(({deviceID}) =>
													//send notification to transit service if deviceID available
													deviceID && deviceID !== "null" ? fcm.send({
														to: deviceID,
														data: {
															title: 'sos',
															body: JSON.stringify({
																id: transitReq.id,
																lat: transitReq.lat,
																lon: transitReq.lon,
																note: transitReq.note
															})
														}
													}) : null
												))
								))
							.then(updated => transitReq)
					}
				},
				updateLocation: {
					type: GraphQLBoolean,
					description: 'method to update location',
					args: {
						email: {
							name: 'email',
							description: 'email to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						},
						type: {
							name: 'type',
							description: 'can be one of doctor or transit',
							type: new GraphQLNonNull(GraphQLString)
						},
						location: {
							name: 'location',
							description: 'JSON of location, should contain lat and lon',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, {email, location, type, password}) => {
						if (type === 'client') throw new Error(405);
						return hashPassword({password: password})
							.then(obj => Database.getResult(database.getQueryBuilder(type)
								.where('email').equals(email)
								.where('password').equals(obj.password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								let {lat, lon} = JSON.parse(location);
								return database.updateItem(type, putTimestamp({
									email: email,
									lat: lat,
									lon: lon
								}, 'updatedAt'));
							})
							.then(update => true);
					}
				},
				updateDeviceID: {
					type: GraphQLBoolean,
					description: 'method to update deviceID',
					args: {
						email: {
							name: 'email',
							description: 'email to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						},
						type: {
							name: 'id',
							description: 'can one of client, doctor or transit',
							type: new GraphQLNonNull(GraphQLString)
						},
						deviceID: {
							name: 'id',
							description: 'deviceID to update with',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, {type, email, password, deviceID}) =>
						hashPassword({password: password})
							.then(obj => Database.getResult(database.getQueryBuilder(type)
								.where('email').equals(email)
								.where('password').equals(obj.password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								return database.updateItem(type, putTimestamp({
									email: email,
									deviceID: deviceID
								}, 'updatedAt')).then(data => true);
							})
				},
				updateClient: {
					type: clientType,
					description: 'method to update details of the client',
					args: {
						email: {
							name: 'email',
							description: 'email to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						},
						mutation: {
							name: 'mutation',
							description: 'JSON of changes to make to its credentials',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) =>
						hashPassword({password: args.password})
							.then(({password}) => {
								let parsed = JSON.parse(args.mutation);
								return Promise.all([
									Database.getResult(database.getQueryBuilder('client')
										.where('email').equals(args.email)
										.where('password').equals(password)),
									parsed.password ? hashPassword(parsed) : parsed
								]);
							})
							.then(results => {
								if (results[0].length === 0) throw new Error(401);
								if (results[0].info) {
									results[0].info = Object.assign(results[0].info, results[1].info);
									delete results[1].info;
								}
								return database.updateItem('client',
									putTimestamp(Object.assign(results[0], results[1]), 'updatedAt'));
							})
				},
				updateDoctor: {
					type: doctorType,
					description: 'method to update details of the doctor',
					args: {
						email: {
							name: 'email',
							description: 'email to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						},
						mutation: {
							name: 'mutation',
							description: 'JSON of changes to make to its credentials',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) =>
						hashPassword({password: args.password})
							.then(({password}) => {
								let parsed = JSON.parse(args.mutation);
								return Promise.all([
									Database.getResult(database.getQueryBuilder('doctor')
										.where('email').equals(args.email)
										.where('password').equals(password)),
									parsed.password ? hashPassword(parsed) : parsed
								]);
							})
							.then(results => {
								if (results[0].length === 0) throw new Error(401);
								if (results[0].length === 0) throw new Error(401);
								if (results[0].info) {
									results[0].info = Object.assign(results[0].info, results[1].info);
									delete results[1].info;
								}
								return database.updateItem('doctor',
									putTimestamp(Object.assign(results[0], results[1]), 'updatedAt'));
							})
				},
				updateTransit: {
					type: transitType,
					description: 'method to update details of the transit',
					args: {
						email: {
							name: 'email',
							description: 'email to authenticate',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						},
						mutation: {
							name: 'mutation',
							description: 'JSON of changes to make to its credentials',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) =>
						hashPassword({password: args.password})
							.then(({password}) => {
								let parsed = JSON.parse(args.mutation);
								return Promise.all([
									Database.getResult(database.getQueryBuilder('transit')
										.where('email').equals(args.email)
										.where('password').equals(password)),
									parsed.password ? hashPassword(parsed) : parsed
								]);
							})
							.then(results => {
								if (results[0].length === 0) throw new Error(401);
								if (results[0].length === 0) throw new Error(401);
								if (results[0].info) {
									results[0].info = Object.assign(results[0].info, results[1].info);
									delete results[1].info;
								}
								return database.updateItem('transit',
									putTimestamp(Object.assign(results[0], results[1]), 'updatedAt'));
							})
				},
				acceptSOS: {
					type: clientType,
					description: 'method to accept an existing sosRequest',
					args: {
						id: {
							name: 'id',
							description: 'sosRequest id to accept',
							type: new GraphQLNonNull(GraphQLString)
						},
						did: {
							name: 'did',
							description: 'email id of the doctor accepting the request',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) => {
						let fcm = new FCM(serverKey);
						return hashPassword({password: args.password})
							.then(({password}) => Database.getResult(database.getQueryBuilder('doctor')
								.where('email').equals(args.did)
								.where('password').equals(password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								//update the sos request with fulfilled parameter
								return database.updateItem('request', putTimestamp({
									id: args.id,
									fulfilled: args.did
								}, 'updatedAt'));
							})
							.then(({fulfilled, cid, dids}) => {
								return Promise.all([
									//update the selected doctor stat
									database.updateItem('doctor', putTimestamp({
										email: fulfilled,
										accepted: {$add: 1}
									}, 'updatedAt')),
									//get the client details to forward to the selected doctor
									Database.getResult(database.getQueryBuilder('client')
										.where('email').equals(cid)),
									//send sos resolved notification to other nearby doctors
								].concat(sendResolved(database, dids, fulfilled, fcm, args.id)));
							})
							//send client details
							.then(updates => {
								let client = updates[1].deviceID;
								return Promise.all([
									updates[1],
									client && client !== "null" ? fcm.send({
										to: updates[1].deviceID,
										data: {
											title: 'accept',
											body: JSON.stringify(Object.assign(updates[0], {requestID: args.id}))
										}
									}) : null
								]);
							})
							.then(results => results[0])
					}
				},
				declineSOS: {
					type: GraphQLBoolean,
					description: 'method to reject an existing sosRequest',
					args: {
						id: {
							name: 'id',
							description: 'sosRequest id to decline',
							type: new GraphQLNonNull(GraphQLString)
						},
						did: {
							name: 'did',
							description: 'email id of the doctor rejecting the request',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) =>
						hashPassword({password: args.password})
							.then(({password}) => Database.getResult(database.getQueryBuilder('doctor')
								.where('email').equals(args.did)
								.where('password').equals(password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								return database.updateItem('request', putTimestamp({
									id: args.id,
									rejection: {$add: 1}
								}, 'updatedAt'));
							})
							.then(sos => {
								let resolutions = [true];
								if (sos.dids.length === sos.rejection)
									resolutions.concat(Database.getResult(database.getQueryBuilder('client')
										.where('email').equals(sos.cid).attributes('deviceID'))
										.then(({deviceID}) =>
											deviceID && deviceID !== "null" ?
												new FCM(serverKey)
													.send({
														to: deviceID,
														data: {
															title: 'rejection',
															body: JSON.stringify(Object.assign(sos, {requestID: args.id}))
														}
													}) : null));
								return Promise.all(resolutions);
							})
							.then(results => results[0])
				},
				resolveSOS: {
					type: GraphQLBoolean,
					args: {
						id: {
							name: 'id',
							description: 'sosRequest id to resolve',
							type: new GraphQLNonNull(GraphQLString)
						},
						cid: {
							name: 'cid',
							description: 'email id of the client resolving the request',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) => {
						let fcm = new FCM(serverKey);
						return hashPassword({password: args.password})
							.then(({password}) => Database.getResult(database.getQueryBuilder('client')
								.where('email').equals(args.cid)
								.where('password').equals(password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								//update the sos request with fulfilled parameter
								return database.updateItem('request', putTimestamp({
									id: args.id,
									resolved: true
								}, 'updatedAt'));
							})
							.then(mutated => sendResolved(database, mutated.dids, '', fcm, args.id))
							.then(results => true);
					}
				},
				acceptTransitRequest: {
					type: doctorType,
					description: 'method to accept transitRequest',
					args: {
						id: {
							name: 'id',
							description: 'transitRequest id to accept',
							type: new GraphQLNonNull(GraphQLString)
						},
						tid: {
							name: 'tid',
							description: 'email id of the transit accepting the request',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) => {
						let fcm = new FCM(serverKey);
						return hashPassword({password: args.password})
							.then(({password}) => Database.getResult(database.getQueryBuilder('transit')
								.where('email').equals(args.tid)
								.where('password').equals(password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								//update the sos request with fulfilled parameter
								return database.updateItem('transitRequest', putTimestamp({
									id: args.id,
									fulfilled: args.tid
								}, 'updatedAt'));
							})
							.then(({fulfilled, did, tids}) => {
								return Promise.all([
									//update the selected doctor stat
									database.updateItem('transit', putTimestamp({
										email: fulfilled,
										accepted: {$add: 1}
									}, 'updatedAt')),
									//get the client details to forward to the selected doctor
									Database.getResult(database.getQueryBuilder('doctor')
										.where('email').equals(did)),
									//send sos resolved notification to other nearby doctors
								].concat(sendResolved(database, tids, fulfilled, fcm, args.id)));
							})
							//send client details
							.then(updates =>
								Promise.all([
									updates[1],
									updates[1].deviceID && updates[1].deviceID !== "null" ?
										fcm.send({
											to: updates[1].deviceID,
											data: {
												title: 'accept',
												body: JSON.stringify(Object.assign(updates[0], {requestID: args.id}))
											}
										}) : null
								]))
							.then(results => results[0])
					}
				},
				declineTransitRequest: {
					type: GraphQLBoolean,
					args: {
						id: {
							name: 'id',
							description: 'transitRequest id to decline',
							type: new GraphQLNonNull(GraphQLString)
						},
						tid: {
							name: 'tid',
							description: 'email id of the transit accepting the request',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) =>
						hashPassword({password: args.password})
							.then(({password}) => Database.getResult(database.getQueryBuilder('transit')
								.where('email').equals(args.tid)
								.where('password').equals(password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								return database.updateItem('transitRequest', putTimestamp({
									id: args.id,
									rejection: {$add: 1}
								}, 'updatedAt'));
							})
							.then(sos => {
								let resolutions = [true];
								if (sos.tids.length === sos.rejection)
									resolutions.concat(Database.getResult(database.getQueryBuilder('doctor')
										.where('email').equals(sos.did).attributes('deviceID'))
										.then(({deviceID}) => deviceID && deviceID !== "null" ?
											new FCM(serverKey)
												.send({
													to: deviceID,
													data: {
														title: 'rejection',
														body: JSON.stringify(Object.assign(sos, {requestID: args.id}))
													}
												}) :
											null
										))
									;
								return Promise.all(resolutions);
							})
							.then(results => results[0])
				},
				resolveTransitRequest: {
					type: GraphQLBoolean,
					description: 'method to resolve the transitRequest',
					args: {
						id: {
							name: 'id',
							description: 'transitRequest id to resolve',
							type: new GraphQLNonNull(GraphQLString)
						},
						did: {
							name: 'did',
							description: 'email id of the doctor resolving this request',
							type: new GraphQLNonNull(GraphQLString)
						},
						password: {
							name: 'password',
							description: 'password to authenticate with',
							type: new GraphQLNonNull(GraphQLString)
						}
					},
					resolve: (parent, args) =>{
						let fcm = new FCM(serverKey);
						return hashPassword({password: args.password})
							.then(({password}) => Database.getResult(database.getQueryBuilder('doctor')
								.where('email').equals(args.did)
								.where('password').equals(password)))
							.then(result => {
								if (result.length === 0) throw new Error(401);
								//update the sos request with fulfilled parameter
								return database.updateItem('transitRequest', putTimestamp({
									id: args.id,
									resolved: true
								}, 'updatedAt'));
							})
							.then(mutated => sendResolved(database, mutated.tids, '', fcm, args.id))
							.then(results => true);
					}
				}
			})
		})
	});