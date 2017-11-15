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
		/*graphql(graphqlSchema(initTables(new Database(), require('./dynamoSchema'), false)), event.body)
			.then(response => callback(null, {
				statusCode: 200,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Credentials": true
				},
				body: JSON.stringify(response)
			}))
			.catch(errors => callback(null, {
				statusCode: errors[0].message,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Credentials": true
				},
				body: JSON.stringify(errors)
			}))*/
		let app = require('express')();
		app.use(require('express-graphql')({
			schema: graphqlSchema(initTables(new Database(), require('./dynamoSchema'), false)),
			graphiql: false
		}));
		require('aws-serverless-express').proxy(app, event, context);
	}
};
/*return callback(null, {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true
			},
			body: JSON.stringify(event.body)
		});*/