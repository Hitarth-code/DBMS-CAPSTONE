const { connect } = require('../db');

async function addCustomer(data) {
  const db = await connect();

  const customer = {
    name: data.name,
    phone: data.phone,
    email: data.email.toLowerCase(),
    licenseNo: data.licenseNo.toUpperCase(),
    licenseExpiry: data.licenseExpiry,
    createdAt: new Date()
  };

  await db.collection('customers').insertOne(customer);
  return customer;
}

async function findCustomer(email) {
  const db = await connect();
  const customer = await db.collection('customers').findOne({ email: email.toLowerCase() });
  if (!customer) throw new Error('No customer with email ' + email);
  return customer;
}

async function listCustomers() {
  const db = await connect();
  return db.collection('customers').find().sort({ name: 1 }).toArray();
}

module.exports = { addCustomer, findCustomer, listCustomers };
