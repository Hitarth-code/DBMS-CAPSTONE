const { connect } = require('../db');

async function addVehicle(data) {
  const db = await connect();

  const vehicle = {
    regNo: data.regNo.toUpperCase(),
    make: data.make,
    model: data.model,
    type: data.type,
    dailyRate: Number(data.dailyRate),
    odometer: Number(data.odometer || 0),
    status: 'available',
    createdAt: new Date()
  };

  await db.collection('vehicles').insertOne(vehicle);
  return vehicle;
}

async function findVehicle(regNo) {
  const db = await connect();
  const vehicle = await db.collection('vehicles').findOne({ regNo: regNo.toUpperCase() });
  if (!vehicle) throw new Error('No vehicle with reg no ' + regNo);
  return vehicle;
}

async function listVehicles(filter = {}) {
  const db = await connect();
  return db.collection('vehicles').find(filter).sort({ regNo: 1 }).toArray();
}


async function availableVehicles(start, end, type) {
  const db = await connect();

  const bookedIds = await db.collection('bookings').distinct('vehicleId', {
    status: { $in: ['booked', 'active'] },
    startDate: { $lt: end },
    endDate: { $gt: start }
  });

  const workshopIds = await db.collection('maintenance').distinct('vehicleId', {
    startDate: { $lt: end },
    endDate: { $gt: start }
  });

  const filter = { _id: { $nin: bookedIds.concat(workshopIds) } };
  if (type) filter.type = type;

  return db.collection('vehicles').find(filter).sort({ dailyRate: 1 }).toArray();
}

module.exports = { addVehicle, findVehicle, listVehicles, availableVehicles };
