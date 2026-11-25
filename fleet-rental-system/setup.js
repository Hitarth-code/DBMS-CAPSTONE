

const { connect, close } = require('./db');

const schemas = {
  vehicles: {
    bsonType: 'object',
    required: ['regNo', 'make', 'model', 'type', 'dailyRate', 'odometer', 'status'],
    properties: {
      regNo: { bsonType: 'string' },
      make: { bsonType: 'string' },
      model: { bsonType: 'string' },
      type: { enum: ['hatchback', 'sedan', 'suv', 'van'] },
      dailyRate: { bsonType: 'number', minimum: 1 },
      odometer: { bsonType: 'number', minimum: 0 },
      status: { enum: ['available', 'rented', 'maintenance'] }
    }
  },

  customers: {
    bsonType: 'object',
    required: ['name', 'phone', 'email', 'licenseNo', 'licenseExpiry'],
    properties: {
      name: { bsonType: 'string' },
      phone: { bsonType: 'string' },
      email: { bsonType: 'string' },
      licenseNo: { bsonType: 'string' },
      licenseExpiry: { bsonType: 'date' }
    }
  },

  bookings: {
    bsonType: 'object',
    required: ['bookingNo', 'vehicleId', 'customerId', 'startDate', 'endDate', 'estimate', 'status'],
    properties: {
      bookingNo: { bsonType: 'string' },
      vehicleId: { bsonType: 'objectId' },
      customerId: { bsonType: 'objectId' },
      startDate: { bsonType: 'date' },
      endDate: { bsonType: 'date' },
      estimate: { bsonType: 'number', minimum: 0 },
      status: { enum: ['booked', 'active', 'completed', 'cancelled'] }
    }
  },

  agreements: {
    bsonType: 'object',
    required: ['agreementNo', 'bookingId', 'signedOn', 'startOdometer', 'depositAmount'],
    properties: {
      agreementNo: { bsonType: 'string' },
      bookingId: { bsonType: 'objectId' },
      signedOn: { bsonType: 'date' },
      startOdometer: { bsonType: 'number', minimum: 0 },
      depositAmount: { bsonType: 'number', minimum: 0 }
    }
  },

  payments: {
    bsonType: 'object',
    required: ['paymentNo', 'bookingId', 'amount', 'method', 'type', 'paidOn'],
    properties: {
      paymentNo: { bsonType: 'string' },
      bookingId: { bsonType: 'objectId' },
      amount: { bsonType: 'number' },   // negative for refunds
      method: { enum: ['cash', 'card', 'upi', 'bank_transfer'] },
      type: { enum: ['deposit', 'rental', 'final', 'refund'] },
      paidOn: { bsonType: 'date' }
    }
  },

  returns: {
    bsonType: 'object',
    required: ['bookingId', 'returnedOn', 'endOdometer', 'lateDays', 'totalCharge'],
    properties: {
      bookingId: { bsonType: 'objectId' },
      returnedOn: { bsonType: 'date' },
      endOdometer: { bsonType: 'number', minimum: 0 },
      kmDriven: { bsonType: 'number', minimum: 0 },
      lateDays: { bsonType: 'number', minimum: 0 },
      lateFee: { bsonType: 'number', minimum: 0 },
      damageCharge: { bsonType: 'number', minimum: 0 },
      totalCharge: { bsonType: 'number', minimum: 0 }
    }
  },

  maintenance: {
    bsonType: 'object',
    required: ['maintenanceNo', 'vehicleId', 'type', 'startDate', 'endDate', 'status'],
    properties: {
      maintenanceNo: { bsonType: 'string' },
      vehicleId: { bsonType: 'objectId' },
      type: { enum: ['service', 'repair', 'inspection', 'tyres'] },
      description: { bsonType: 'string' },
      startDate: { bsonType: 'date' },
      endDate: { bsonType: 'date' },
      cost: { bsonType: ['number', 'null'] },
      status: { enum: ['scheduled', 'in_progress', 'done'] }
    }
  }
};

const indexes = {
  vehicles: [
    [{ regNo: 1 }, { unique: true }],
    [{ status: 1 }, {}],
    [{ type: 1 }, {}]
  ],
  customers: [
    [{ email: 1 }, { unique: true }],
    [{ licenseNo: 1 }, { unique: true }]
  ],
  bookings: [
    [{ bookingNo: 1 }, { unique: true }],
    [{ vehicleId: 1, startDate: 1, endDate: 1 }, {}],   // used by the overlap check
    [{ customerId: 1 }, {}],
    [{ status: 1 }, {}]
  ],
  agreements: [
    [{ bookingId: 1 }, { unique: true }]
  ],
  payments: [
    [{ bookingId: 1 }, {}],
    [{ paidOn: 1 }, {}]
  ],
  returns: [
    [{ bookingId: 1 }, { unique: true }]
  ],
  maintenance: [
    [{ maintenanceNo: 1 }, { unique: true }],
    [{ vehicleId: 1, startDate: 1, endDate: 1 }, {}]
  ]
};

async function setup() {
  const db = await connect();

  for (const name of Object.keys(schemas)) {
    const found = await db.listCollections({ name: name }).toArray();
    const validator = { $jsonSchema: schemas[name] };

    if (found.length === 0) {
      await db.createCollection(name, { validator: validator });
    } else {
      await db.command({ collMod: name, validator: validator });
    }

    for (const [keys, options] of indexes[name]) {
      await db.collection(name).createIndex(keys, options);
    }
  }

  console.log('Collections and indexes are ready.');
}

module.exports = { setup };

if (require.main === module) {
  setup()
    .catch(err => console.error('Setup failed:', err.message))
    .finally(() => close());
}
