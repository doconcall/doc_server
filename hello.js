module.exports = {
	handler(event, context, callback) {
		return callback(null, {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true
			},
			body: JSON.stringify(event),
		});
	}
};