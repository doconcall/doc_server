const joi = require('joi');
const dynamo = require('dynamodb');

// noinspection JSUnresolvedFunction
module.exports = {
	doctor: {
		hashKey: 'email',
		schema: {
			email: joi.string().email(),
			password: joi.string(),
			info: {
				name: joi.string(),
				designation: joi.string(),
				phone: joi.number()
			},
			lat: joi.number(),
			lon: joi.number(),
			accepted: joi.number(),
			total: joi.number(),
			deviceID: joi.string(),
			createdAt: joi.number(),
			updatedAt: joi.number()
		}
	},
	client: {
		hashKey: 'email',
		schema: {
			email: joi.string().email(),
			password: joi.string(),
			info: {
				name: joi.string(),
				phone: joi.number(),
				history: joi.string()
			},
			deviceID: joi.string(),
			createdAt: joi.number(),
			updatedAt: joi.number()
		},
	},
	transit: {
		hashKey: 'email',
		schema: {
			email: joi.string().email(),
			password: joi.string(),
			info: {
				name: joi.string(),
				phone: joi.number()
			},
			lat: joi.number(),
			lon: joi.number(),
			accepted: joi.number(),
			total: joi.number(),
			deviceID: joi.string(),
			createdAt: joi.number(),
			updatedAt: joi.number()
		}
	},
	request: {
		hashKey: 'id',
		schema: {
			id: dynamo.types.uuid(),
			cid: joi.string().email(),
			lat: joi.number(),
			lon: joi.number(),
			note: joi.string(),
			dids: dynamo.types.stringSet(),
			fulfilled: joi.string().email(),
			rejection: joi.number(),
			resolved: joi.boolean(),
			createdAt: joi.number(),
			updatedAt: joi.number()
		}
	},
	transitRequest: {
		hashKey: 'id',
		schema: {
			id: dynamo.types.uuid(),
			did: joi.string().email(),
			lat: joi.number(),
			lon: joi.number(),
			note: joi.string(),
			tids: dynamo.types.stringSet(),
			fulfilled: joi.string().email(),
			rejection: joi.number(),
			resolved: joi.boolean(),
			createdAt: joi.number(),
			updatedAt: joi.number()
		}
	}
};