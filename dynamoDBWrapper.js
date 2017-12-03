const dynamo = require('dynamodb');

class Database {
	constructor(credentials) {
		credentials && dynamo.AWS.config.update(credentials);
		this.describeTable = this.describeTable.bind(this);
		this.createTables = this.createTables.bind(this);
		this.putItems = this.putItems.bind(this);
		this.getQueryBuilder = this.getQueryBuilder.bind(this);
		this.deleteItem = this.deleteItem.bind(this);
		this.updateItem = this.updateItem.bind(this);
	}
	
	/**
	 * initialize tables. Tables can accessed this.tableName
	 * where tableName can be any defined table name
	 * @param tableName: name of the table
	 * @param tableSchema: schema of the table
	 * @returns {Database}
	 */
	describeTable(tableName, tableSchema) {
		this[tableName] = dynamo.define(tableName, tableSchema);
		return this;
	}
	
	createTables() {
		return new Promise((resolve, reject) =>
			dynamo.createTables(err => {
				if (err) return reject(err);
				resolve(true);
			}));
	}
	
	putItems(tableName, items) {
		return new Promise((resolve, reject) => {
			let table = this[tableName];
			if (!table) return reject(tableName + " does not exist");
			table.create(items, {overwrite: false},
				(err, data) => {
					if (err) return reject(err);
					if (Array.isArray(data)) {
						let result = [];
						data.map(({attrs}) => result.push(attrs));
						resolve(result);
					}
					else resolve(data.attrs)
				});
		});
	}
	
	getQueryBuilder(tableName) {
		let table = this[tableName];
		if (!table) return null;
		return table.scan();
	}
	
	static getResult(query) {
		return new Promise((resolve, reject) => {
			query.exec((err, data) => {
				if (err) return reject(err);
				if (!data) return null;
				let {Items} = data;
				let results = Items.map(item => item.attrs);
				resolve(results.length === 1 ? results[0] : results);
			});
		});
	}
	
	deleteItem(tableName, item) {
		return new Promise((resolve, reject) => {
			let table = this[tableName];
			if (!table) return reject(tableName + " does not exist");
			table.destroy(item, err => err ? reject(err) : resolve(true));
		})
	}
	
	updateItem(tableName, item) {
		return new Promise((resolve, reject) => {
			let table = this[tableName];
			if (!table) return reject(tableName + " does not exist");
			table.update(item, (err, {attrs}) => err ? reject(err) : resolve(attrs));
		});
	}
}

module.exports = Database;