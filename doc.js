const Database = require('./dynamoDBWrapper');
const {initTables} = require('./local');
let graphqlHTTP = require('express-graphql');
const awsServerlessExpress = require('aws-serverless-express');

let graphqlSchema = require('./graphqlSchema')(initTables(new Database(), require('./dynamoSchema')));

let app = require('express')();
app.use(graphqlHTTP({schema: graphqlSchema, graphiql: false}));

let serverless = awsServerlessExpress.createServer(app);

process.on('exit', () => serverless.close());

process.on('SIGINT', process.exit);

module.exports = {
	handler: (event, context, callback) =>
		awsServerlessExpress.proxy(serverless, event, context)
};