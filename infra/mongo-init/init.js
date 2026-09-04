// MongoDB init script — runs once on first container start.
// Creates application databases and a dedicated user for each service.

const rootDb = db.getSiblingDB('admin');

const appUser = 'nearmart_app';
const appPass = 'nearmart_app_secret'; // override via MONGO_APP_PASSWORD in production

const databases = [
  'nearmart_auth',
  'nearmart_vendors',
  'nearmart_catalog',
  'nearmart_orders',
  'nearmart_payments',
  'nearmart_reviews',
  'nearmart_realtime',
  'nearmart_notifications',
];

databases.forEach((dbName) => {
  const appDb = db.getSiblingDB(dbName);
  // Insert a sentinel document to actually create the DB
  appDb.createCollection('_init');
  print(`[init] Created database: ${dbName}`);
});

// Create a single cross-database application user
rootDb.createUser({
  user: appUser,
  pwd:  appPass,
  roles: databases.map((dbName) => ({
    role: 'readWrite',
    db:   dbName,
  })),
});

print('[init] nearmart_app user created with readWrite on all service databases.');
