const { connect } = require('../db');
const { daysBetween, round2 } = require('../utils');
const { calcLateFee } = require('../billing');
const { recordPayment, totalPaid } = require('./payments');


async function returnVehicle(data) {
  const db = await connect();

  const booking = await db.collection('bookings').findOne({ bookingNo: data.bookingNo });
  if (!booking) throw new Error('Booking not found');
  if (booking.status !== 'active') throw new Error('This rental is not active (status is ' + booking.status + ')');

  const agreement = await db.collection('agreements').findOne({ bookingId: booking._id });
  if (data.returnDate < booking.startDate) throw new Error('Return date is before the rental start');
  if (data.endOdometer < agreement.startOdometer) {
    throw new Error('End odometer cannot be less than start odometer (' + agreement.startOdometer + ')');
  }

  const damage = Number(data.damageCharge || 0);
  const lateDays = data.returnDate > booking.endDate ? daysBetween(booking.endDate, data.returnDate) : 0;
  const lateFee = calcLateFee(booking.dailyRate, lateDays);
  const total = round2(booking.estimate + lateFee + damage);

  
  const paid = await totalPaid(db, booking._id);
  const balance = round2(total - paid);

  if (balance > 0) {
    await recordPayment(db, booking._id, balance, data.method, 'final', data.returnDate);
  } else if (balance < 0) {
    await recordPayment(db, booking._id, balance, data.method, 'refund', data.returnDate);
  }

  const result = {
    bookingId: booking._id,
    returnedOn: data.returnDate,
    endOdometer: data.endOdometer,
    kmDriven: data.endOdometer - agreement.startOdometer,
    lateDays: lateDays,
    lateFee: lateFee,
    damageCharge: damage,
    totalCharge: total
  };
  await db.collection('returns').insertOne(result);

  await db.collection('bookings').updateOne(
    { _id: booking._id },
    { $set: { status: 'completed', finalCharge: total, returnedOn: data.returnDate } }
  );
  await db.collection('vehicles').updateOne(
    { _id: booking.vehicleId },
    { $set: { status: 'available', odometer: data.endOdometer } }
  );

  return { rentalCharge: booking.estimate, lateDays, lateFee, damage, total, paid, balance, kmDriven: result.kmDriven };
}

module.exports = { returnVehicle };
