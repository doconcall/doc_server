const Database = require('./dynamoDBWrapper');
const {initTables} = require('./local');
let graphqlHTTP = require('express-graphql');
const awsServerlessExpress = require('aws-serverless-express');

//initialize graphQL schema with after initTables initializes the database object
let graphqlSchema = require('./graphqlSchema')(initTables(new Database(), require('./dynamoSchema')));

//initialize express app
let app = require('express')();
//add graphqlHTTP as middleware as it will handle all requests
app.use(graphqlHTTP({schema: graphqlSchema, graphiql: false}));

//create serverless express app
let serverless = awsServerlessExpress.createServer(app);

//maintenance function
process.on('exit', () => serverless.close());

//maintenance function
process.on('SIGINT', process.exit);

module.exports = {
	handler: (event, context, callback) =>
		//initialize the server
		awsServerlessExpress.proxy(serverless, event, context)
};