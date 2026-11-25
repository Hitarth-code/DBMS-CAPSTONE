const { connect } = require('../db');
const { DAY, today, daysBetween, round2 } = require('../utils');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


async function revenueByMonth(year) {
  const db = await connect();
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));

  const rows = await db.collection('payments').aggregate([
    { $match: { paidOn: { $gte: from, $lt: to } } },
    { $group: { _id: { $month: '$paidOn' }, revenue: { $sum: '$amount' }, payments: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();

  return rows.map(r => ({ month: MONTHS[r._id - 1], payments: r.payments, revenue: round2(r.revenue) }));
}

async function revenueByVehicleType(from, to) {
  const db = await connect();

  const rows = await db.collection('payments').aggregate([
    { $match: { paidOn: { $gte: from, $lt: to } } },
    { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'booking' } },
    { $unwind: '$booking' },
    { $lookup: { from: 'vehicles', localField: 'booking.vehicleId', foreignField: '_id', as: 'vehicle' } },
    { $unwind: '$vehicle' },
    { $group: { _id: '$vehicle.type', revenue: { $sum: '$amount' }, payments: { $sum: 1 } } },
    { $sort: { revenue: -1 } }
  ]).toArray();

  return rows.map(r => ({ vehicleType: r._id, payments: r.payments, revenue: round2(r.revenue) }));
}


async function utilization(from, to) {
  const db = await connect();
  const periodDays = daysBetween(from, to);

  const vehicles = await db.collection('vehicles').find().sort({ regNo: 1 }).toArray();
  const bookings = await db.collection('bookings').find({
    status: { $in: ['active', 'completed'] },
    startDate: { $lt: to },
    endDate: { $gt: from }
  }).toArray();

  return vehicles.map(v => {
    let rentedDays = 0;
    let trips = 0;

    bookings.filter(b => b.vehicleId.equals(v._id)).forEach(b => {
      const s = b.startDate > from ? b.startDate : from;
      const e = b.endDate < to ? b.endDate : to;
      rentedDays += Math.round((e - s) / DAY);
      trips++;
    });

    return {
      regNo: v.regNo,
      vehicle: v.make + ' ' + v.model,
      trips: trips,
      rentedDays: rentedDays,
      utilization: round2((rentedDays / periodDays) * 100) + '%'
    };
  }).sort((a, b) => parseFloat(b.utilization) - parseFloat(a.utilization));
}

async function fleetStatus() {
  const db = await connect();
  const rows = await db.collection('vehicles').aggregate([
    { $group: { _id: '$status', vehicles: { $sum: 1 }, avgOdometer: { $avg: '$odometer' } } },
    { $sort: { _id: 1 } }
  ]).toArray();

  return rows.map(r => ({ status: r._id, vehicles: r.vehicles, avgOdometer: Math.round(r.avgOdometer) }));
}

async function maintenanceCost() {
  const db = await connect();
  const rows = await db.collection('maintenance').aggregate([
    { $match: { status: 'done' } },
    { $group: { _id: '$vehicleId', jobs: { $sum: 1 }, totalCost: { $sum: '$cost' } } },
    { $lookup: { from: 'vehicles', localField: '_id', foreignField: '_id', as: 'vehicle' } },
    { $unwind: '$vehicle' },
    { $sort: { totalCost: -1 } }
  ]).toArray();

  return rows.map(r => ({ regNo: r.vehicle.regNo, vehicle: r.vehicle.make + ' ' + r.vehicle.model, jobs: r.jobs, totalCost: r.totalCost }));
}

async function topCustomers(limit = 5) {
  const db = await connect();
  const rows = await db.collection('bookings').aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: '$customerId', trips: { $sum: 1 }, spent: { $sum: '$finalCharge' } } },
    { $sort: { spent: -1 } },
    { $limit: limit },
    { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
    { $unwind: '$customer' }
  ]).toArray();

  return rows.map(r => ({ name: r.customer.name, email: r.customer.email, trips: r.trips, spent: round2(r.spent) }));
}

// active rentals whose end date has already passed
async function overdueRentals() {
  const db = await connect();
  const t = today();

  const rows = await db.collection('bookings').aggregate([
    { $match: { status: 'active', endDate: { $lt: t } } },
    { $lookup: { from: 'vehicles', localField: 'vehicleId', foreignField: '_id', as: 'vehicle' } },
    { $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: 'customer' } },
    { $unwind: '$vehicle' },
    { $unwind: '$customer' }
  ]).toArray();

  return rows.map(r => ({
    bookingNo: r.bookingNo,
    regNo: r.vehicle.regNo,
    customer: r.customer.name,
    phone: r.customer.phone,
    daysOverdue: daysBetween(r.endDate, t)
  }));
}

module.exports = { revenueByMonth, revenueByVehicleType, utilization, fleetStatus, maintenanceCost, topCustomers, overdueRentals };
