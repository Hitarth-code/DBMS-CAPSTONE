const { connect } = require('../db');
const config = require('../config');
const { daysBetween, nextNumber, round2, fmt } = require('../utils');
const { calcCharge } = require('../billing');
const { recordPayment } = require('./payments');


async function findClash(db, vehicleId, start, end) {
  return db.collection('bookings').findOne({
    vehicleId: vehicleId,
    status: { $in: ['booked', 'active'] },
    startDate: { $lt: end },
    endDate: { $gt: start }
  });
}

async function createBooking(data) {
  const db = await connect();
  const start = data.startDate;
  const end = data.endDate;

  if (end <= start) throw new Error('End date must be after the start date');

  const vehicle = await db.collection('vehicles').findOne({ regNo: data.regNo.toUpperCase() });
  if (!vehicle) throw new Error('Vehicle not found');

  const customer = await db.collection('customers').findOne({ email: data.email.toLowerCase() });
  if (!customer) throw new Error('Customer not found');

  if (customer.licenseExpiry < end) {
    throw new Error('Driving license expires before the rental ends (' + fmt(customer.licenseExpiry) + ')');
  }

  const clash = await findClash(db, vehicle._id, start, end);
  if (clash) {
    throw new Error('Vehicle is already booked ' + fmt(clash.startDate) + ' to ' + fmt(clash.endDate) + ' (' + clash.bookingNo + ')');
  }

  const workshop = await db.collection('maintenance').findOne({
    vehicleId: vehicle._id,
    startDate: { $lt: end },
    endDate: { $gt: start }
  });
  if (workshop) {
    throw new Error('Vehicle is in maintenance ' + fmt(workshop.startDate) + ' to ' + fmt(workshop.endDate));
  }

  const days = daysBetween(start, end);
  const bill = calcCharge(vehicle.dailyRate, days);

  const booking = {
    bookingNo: await nextNumber(db, 'booking', 'BK-'),
    vehicleId: vehicle._id,
    customerId: customer._id,
    startDate: start,
    endDate: end,
    days: days,
    dailyRate: vehicle.dailyRate,
    estimate: bill.total,
    status: 'booked',
    createdAt: new Date()
  };

  await db.collection('bookings').insertOne(booking);
  return { booking, bill };
}

// customer comes to pick up the vehicle: agreement is made and deposit is taken
async function startRental(bookingNo, method = 'cash', onDate = new Date()) {
  const db = await connect();

  const booking = await db.collection('bookings').findOne({ bookingNo: bookingNo });
  if (!booking) throw new Error('Booking not found');
  if (booking.status !== 'booked') throw new Error('Only a booked booking can be started (status is ' + booking.status + ')');

  const vehicle = await db.collection('vehicles').findOne({ _id: booking.vehicleId });
  if (vehicle.status !== 'available') throw new Error('Vehicle is not available right now (' + vehicle.status + ')');

  const deposit = round2(booking.estimate * config.DEPOSIT_PERCENT);

  const agreement = {
    agreementNo: await nextNumber(db, 'agreement', 'AGR-'),
    bookingId: booking._id,
    customerId: booking.customerId,
    vehicleId: booking.vehicleId,
    signedOn: onDate,
    startOdometer: vehicle.odometer,
    depositAmount: deposit,
    terms: 'Standard rental terms. Fuel full to full. Late return charged extra.'
  };
  await db.collection('agreements').insertOne(agreement);

  await recordPayment(db, booking._id, deposit, method, 'deposit', onDate);

  await db.collection('bookings').updateOne({ _id: booking._id }, { $set: { status: 'active' } });
  await db.collection('vehicles').updateOne({ _id: vehicle._id }, { $set: { status: 'rented' } });

  return agreement;
}

async function cancelBooking(bookingNo) {
  const db = await connect();
  const booking = await db.collection('bookings').findOne({ bookingNo: bookingNo });
  if (!booking) throw new Error('Booking not found');
  if (booking.status !== 'booked') throw new Error('Only bookings that have not started can be cancelled');

  await db.collection('bookings').updateOne(
    { _id: booking._id },
    { $set: { status: 'cancelled', cancelledOn: new Date() } }
  );
}

async function listBookings(filter = {}) {
  const db = await connect();
  return db.collection('bookings').aggregate([
    { $match: filter },
    { $lookup: { from: 'vehicles', localField: 'vehicleId', foreignField: '_id', as: 'vehicle' } },
    { $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: 'customer' } },
    { $unwind: '$vehicle' },
    { $unwind: '$customer' },
    { $sort: { startDate: -1 } },
    {
      $project: {
        _id: 0,
        bookingNo: 1,
        regNo: '$vehicle.regNo',
        customer: '$customer.name',
        startDate: 1,
        endDate: 1,
        days: 1,
        estimate: 1,
        status: 1
      }
    }
  ]).toArray();
}

module.exports = { createBooking, startRental, cancelBooking, listBookings };
