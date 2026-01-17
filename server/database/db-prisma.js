const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Parse DATABASE_URL to add connection pool parameters for Supabase
let databaseUrl = process.env.DATABASE_URL || '';

// If using Supabase connection pooling, ensure proper parameters
if (databaseUrl.includes('pooler.supabase.com') || databaseUrl.includes('supabase.co')) {
  // Add connection pool parameters if not present
  if (!databaseUrl.includes('?')) {
    databaseUrl += '?pgbouncer=true&connection_limit=10';
  } else if (!databaseUrl.includes('pgbouncer')) {
    databaseUrl += '&pgbouncer=true&connection_limit=10';
  }
}

const prisma = new PrismaClient({
  // Suppress connection-related warnings that are handled automatically
  log: process.env.NODE_ENV === 'development' 
    ? [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' }
      ]
    : [{ emit: 'event', level: 'error' }],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  // Optimize connection pooling for Supabase
  // Add connection pool settings
  __internal: {
    engine: {
      connectTimeout: 10000,
      queryTimeout: 20000,
    },
  },
});

// Filter out non-critical connection errors
prisma.$on('error', (e) => {
  // Only log if it's not a "Closed" connection error (which is handled by ensureConnection)
  const errorStr = String(e);
  if (!errorStr.includes('Closed') && !errorStr.includes('connection')) {
    console.error('Prisma error:', e);
  }
});

prisma.$on('warn', (e) => {
  // Suppress connection-related warnings that are handled automatically
  const warnStr = String(e);
  if (!warnStr.includes('Closed') && !warnStr.includes('connection')) {
    console.warn('Prisma warning:', e);
  }
});

// Add connection retry logic
let connectionRetries = 0;
const MAX_RETRIES = 3;

const ensureConnection = async () => {
  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    connectionRetries = 0;
    return true;
  } catch (error) {
    // Check if it's a connection error
    const errorMessage = error.message || String(error);
    if (errorMessage.includes('Closed') || errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
      connectionRetries++;
      if (connectionRetries < MAX_RETRIES) {
        console.log(`Connection lost, attempting reconnect (${connectionRetries}/${MAX_RETRIES})...`);
        try {
          // Disconnect first, then reconnect
          await prisma.$disconnect().catch(() => {});
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          await prisma.$connect();
          connectionRetries = 0;
          console.log('Connection restored successfully');
          return true;
        } catch (reconnectError) {
          console.error('Reconnection failed:', reconnectError.message || reconnectError);
          return false;
        }
      } else {
        console.error('Max reconnection attempts reached');
        return false;
      }
    }
    // If it's not a connection error, just return false
    return false;
  }
};

let initialized = false;

const init = async () => {
  try {
    // Test connection
    await prisma.$connect();
    console.log('Connected to database via Prisma');
    
    // Initialize default data
    if (!initialized) {
      await insertDefaultData();
      initialized = true;
    }
    
    // Set up periodic connection check (every 5 minutes)
    setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        const errorMessage = error.message || String(error);
        if (errorMessage.includes('Closed') || errorMessage.includes('connection')) {
          console.warn('Periodic connection check failed, attempting reconnect...');
          await ensureConnection();
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    return true;
  } catch (error) {
    console.error('Error connecting to database:', error);
    // Try to reconnect once
    try {
      const reconnected = await ensureConnection();
      if (reconnected) {
        console.log('Reconnected successfully after initial failure');
        if (!initialized) {
          await insertDefaultData();
          initialized = true;
        }
        return true;
      }
    } catch (reconnectError) {
      console.error('Failed to reconnect:', reconnectError);
    }
    throw error;
  }
};

const getDb = () => {
  // Ensure connection is active before returning
  ensureConnection().catch(err => {
    console.error('Error ensuring connection:', err);
  });
  return prisma;
};

// Wrapper functions to maintain compatibility with existing code
const runQuery = async (query, params = []) => {
  // For Prisma, we use the client directly
  // This is a compatibility layer - ideally, migrate to Prisma methods
  throw new Error('runQuery not supported with Prisma. Use Prisma client methods directly.');
};

const getQuery = async (query, params = []) => {
  throw new Error('getQuery not supported with Prisma. Use Prisma client methods directly.');
};

const allQuery = async (query, params = []) => {
  throw new Error('allQuery not supported with Prisma. Use Prisma client methods directly.');
};

// Prisma-specific helper methods
const prismaHelpers = {
  // User operations
  async getUserByUsername(username) {
    return await prisma.user.findUnique({
      where: { username },
      include: { roleRef: true }
    });
  },

  async createUser(data) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword
      }
    });
  },

  // Patient operations
  async getPatientById(id) {
    return await prisma.patient.findUnique({
      where: { id },
      include: { creator: true }
    });
  },

  async getPatientByNationalId(nationalId) {
    return await prisma.patient.findUnique({
      where: { nationalId }
    });
  },

  // Visit operations
  async getVisitById(id) {
    return await prisma.visit.findUnique({
      where: { id },
      include: {
        patient: true,
        labResults: { include: { testCatalog: true, creator: true } },
        prescriptions: { include: { drugCatalog: true, creator: true } },
        diagnoses: { include: { creator: true } },
        statusHistory: { include: { changer: true } },
        attachments: true
      }
    });
  },

  // Lab operations
  async getLabResultsByVisitId(visitId) {
    return await prisma.labResult.findMany({
      where: { visitId },
      include: { testCatalog: true, creator: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  // Pharmacy operations
  async getPrescriptionsByVisitId(visitId) {
    return await prisma.pharmacyPrescription.findMany({
      where: { visitId },
      include: { drugCatalog: true, creator: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  // Catalog operations
  async getLabTestsCatalog() {
    return await prisma.labTestCatalog.findMany({
      where: { isActive: 1 },
      orderBy: { testName: 'asc' }
    });
  },

  async getDrugsCatalog() {
    return await prisma.drugCatalog.findMany({
      where: { isActive: 1 },
      orderBy: { drugName: 'asc' }
    });
  }
};

// Insert default data
const insertDefaultData = async () => {
  try {
    // Check if data already exists
    const existingRoles = await prisma.role.count();
    if (existingRoles > 0) {
      console.log('Default data already exists, skipping...');
      return;
    }

    // Insert default roles
    const roles = [
      { name: 'admin', displayName: 'مدير النظام', isSystemRole: 1 },
      { name: 'inquiry', displayName: 'موظف الاستعلامات', isSystemRole: 1 },
      { name: 'lab', displayName: 'موظف التحاليل', isSystemRole: 1 },
      { name: 'lab_manager', displayName: 'مدير المختبر', isSystemRole: 1 },
      { name: 'pharmacist', displayName: 'الصيدلي', isSystemRole: 1 },
      { name: 'pharmacy_manager', displayName: 'مدير الصيدلية', isSystemRole: 1 },
      { name: 'doctor', displayName: 'الطبيب', isSystemRole: 1 }
    ];

    for (const roleData of roles) {
      await prisma.role.create({ data: roleData });
    }

    // Insert default users
    const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
    const inquiryRole = await prisma.role.findUnique({ where: { name: 'inquiry' } });
    const labRole = await prisma.role.findUnique({ where: { name: 'lab' } });
    const labManagerRole = await prisma.role.findUnique({ where: { name: 'lab_manager' } });
    const pharmacistRole = await prisma.role.findUnique({ where: { name: 'pharmacist' } });
    const pharmacyManagerRole = await prisma.role.findUnique({ where: { name: 'pharmacy_manager' } });
    const doctorRole = await prisma.role.findUnique({ where: { name: 'doctor' } });

    const defaultUsers = [
      {
        username: 'admin',
        password: await bcrypt.hash('admin123', 10),
        role: 'admin',
        roleId: adminRole.id,
        name: 'مدير النظام'
      },
      {
        username: 'inquiry',
        password: await bcrypt.hash('inquiry123', 10),
        role: 'inquiry',
        roleId: inquiryRole.id,
        name: 'موظف الاستعلامات'
      },
      {
        username: 'lab',
        password: await bcrypt.hash('lab123', 10),
        role: 'lab',
        roleId: labRole.id,
        name: 'موظف التحاليل'
      },
      {
        username: 'lab_manager',
        password: await bcrypt.hash('lab_manager123', 10),
        role: 'lab_manager',
        roleId: labManagerRole.id,
        name: 'مدير المختبر'
      },
      {
        username: 'pharmacist',
        password: await bcrypt.hash('pharmacist123', 10),
        role: 'pharmacist',
        roleId: pharmacistRole.id,
        name: 'الصيدلي'
      },
      {
        username: 'pharmacy_manager',
        password: await bcrypt.hash('pharmacy_manager123', 10),
        role: 'pharmacy_manager',
        roleId: pharmacyManagerRole.id,
        name: 'مدير الصيدلية'
      },
      {
        username: 'doctor',
        password: await bcrypt.hash('doctor123', 10),
        role: 'doctor',
        roleId: doctorRole.id,
        name: 'الطبيب'
      }
    ];

    for (const userData of defaultUsers) {
      await prisma.user.create({ data: userData });
    }

    console.log('Default roles and users created successfully');
  } catch (error) {
    console.error('Error inserting default data:', error);
    // Don't throw - allow app to continue
  }
};

// Close connection
const disconnect = async () => {
  await prisma.$disconnect();
};

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = {
  init,
  getDb,
  prisma: prisma,
  helpers: prismaHelpers,
  disconnect,
  ensureConnection,
  // Compatibility layer (will throw errors - use Prisma methods instead)
  runQuery,
  getQuery,
  allQuery
};
