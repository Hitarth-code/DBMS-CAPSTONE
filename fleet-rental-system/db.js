const { MongoClient } = require('mongodb');
const config = require('./config');

const client = new MongoClient(config.MONGO_URI);
let db = null;

async function connect() {
  if (!db) {
    await client.connect();
    db = client.db(config.DB_NAME);
  }
  return db;
}

async function close() {
  await client.close();
  db = null;
}

module.exports = { connect, close };
