/*
const Database = require('./dynamoDBWrapper');
const graphqlSchema = require('./graphqlSchema');
const {initTables} = require('./local');

module.exports = {
	hello(event, context, callback) {
		return callback(null, {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true
			},
			body: JSON.stringify(event),
		});
	},
	doc(event, context, callback) {
		//initialize express app
		let app = require('express')();
		//put express-graphql as middleware with initialized graphQL schema as argument
		app.use(require('express-graphql')({
			schema: graphqlSchema(initTables(new Database(), require('./dynamoSchema'), false)),
			graphiql: false
		}));
		//since we're using lambda, we need to proxy it with aws-serverless-express
		require('aws-serverless-express').proxy(app, event, context);
	}
};
/!*return callback(null, {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true
			},
			body: JSON.stringify(event.body)
		});*!/*/
