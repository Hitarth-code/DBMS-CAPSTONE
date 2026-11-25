const { connect } = require('../db');
const { nextNumber, today, fmt } = require('../utils');

async function scheduleMaintenance(data) {
  const db = await connect();

  if (data.endDate <= data.startDate) throw new Error('End date must be after the start date');

  const vehicle = await db.collection('vehicles').findOne({ regNo: data.regNo.toUpperCase() });
  if (!vehicle) throw new Error('Vehicle not found');

  
  const clash = await db.collection('bookings').findOne({
    vehicleId: vehicle._id,
    status: { $in: ['booked', 'active'] },
    startDate: { $lt: data.endDate },
    endDate: { $gt: data.startDate }
  });
  if (clash) {
    throw new Error('Vehicle has booking ' + clash.bookingNo + ' (' + fmt(clash.startDate) + ' to ' + fmt(clash.endDate) + ') in that period');
  }

  const record = {
    maintenanceNo: await nextNumber(db, 'maintenance', 'MNT-'),
    vehicleId: vehicle._id,
    type: data.type,
    description: data.description || '',
    startDate: data.startDate,
    endDate: data.endDate,
    cost: null,
    status: 'scheduled'
  };
  await db.collection('maintenance').insertOne(record);
  return record;
}

async function startMaintenance(maintenanceNo) {
  const db = await connect();

  const record = await db.collection('maintenance').findOne({ maintenanceNo: maintenanceNo });
  if (!record) throw new Error('Maintenance record not found');
  if (record.status !== 'scheduled') throw new Error('Already ' + record.status);

  const vehicle = await db.collection('vehicles').findOne({ _id: record.vehicleId });
  if (vehicle.status !== 'available') throw new Error('Vehicle is ' + vehicle.status + ', cannot go to maintenance now');

  const t = today();
  const newStart = record.startDate > t ? t : record.startDate;

  await db.collection('maintenance').updateOne(
    { _id: record._id },
    { $set: { status: 'in_progress', startDate: newStart } }
  );
  await db.collection('vehicles').updateOne({ _id: vehicle._id }, { $set: { status: 'maintenance' } });
}

async function completeMaintenance(maintenanceNo, cost) {
  const db = await connect();

  const record = await db.collection('maintenance').findOne({ maintenanceNo: maintenanceNo });
  if (!record) throw new Error('Maintenance record not found');
  if (record.status !== 'in_progress') throw new Error('Maintenance must be in progress to complete it');
  if (!(cost >= 0)) throw new Error('Cost must be a number');

  
  const realEnd = new Date() > record.startDate ? new Date() : new Date(record.startDate.getTime() + 1);

  await db.collection('maintenance').updateOne(
    { _id: record._id },
    { $set: { status: 'done', cost: Number(cost), endDate: realEnd } }
  );
  await db.collection('vehicles').updateOne({ _id: record.vehicleId }, { $set: { status: 'available' } });
}

async function listMaintenance() {
  const db = await connect();
  return db.collection('maintenance').aggregate([
    { $lookup: { from: 'vehicles', localField: 'vehicleId', foreignField: '_id', as: 'vehicle' } },
    { $unwind: '$vehicle' },
    { $sort: { startDate: -1 } },
    {
      $project: {
        _id: 0,
        maintenanceNo: 1,
        regNo: '$vehicle.regNo',
        type: 1,
        startDate: 1,
        endDate: 1,
        cost: 1,
        status: 1
      }
    }
  ]).toArray();
}

module.exports = { scheduleMaintenance, startMaintenance, completeMaintenance, listMaintenance };
