// MongoDB connection using Mongoose.
// Reads connection string from MONGODB_URI only — no hard-coded credentials.

import mongoose from 'mongoose';
import { config } from './env.js';

mongoose.set('strictQuery', true);

let connectionState = 'disconnected'; // disconnected | connected | connecting | error

function getConnectionState() {
  // Reflect Mongoose's actual readyState, not a cached value.
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting.
  const map = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return map[mongoose.connection.readyState] ?? 'unknown';
}

async function connectDatabase() {
  if (!config.mongoUri) {
    const err = new Error('MONGODB_URI is not configured');
    err.code = 'MISSING_CONFIG';
    throw err;
  }

  connectionState = 'connecting';

  try {
    const connection = await mongoose.connect(config.mongoUri, {
      // Reasonable timeouts so we fail fast and report clearly.
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    connectionState = 'connected';

    // Attach lifecycle listeners for clearer observability.
    mongoose.connection.on('connected', () => {
      connectionState = 'connected';
      // eslint-disable-next-line no-console
      console.log('[db] MongoDB connected');
    });

    mongoose.connection.on('error', (err) => {
      connectionState = 'error';
      // eslint-disable-next-line no-console
      console.error('[db] MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      connectionState = 'disconnected';
      // eslint-disable-next-line no-console
      console.warn('[db] MongoDB disconnected');
    });

    return connection;
  } catch (error) {
    connectionState = 'error';
    // Surface a clear, actionable error message.
    // eslint-disable-next-line no-console
    console.error(
      `[db] Failed to connect to MongoDB: ${error.message}`,
    );
    throw error;
  }
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
      connectionState = 'disconnected';
      // eslint-disable-next-line no-console
      console.log('[db] MongoDB connection closed');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[db] Error closing MongoDB connection:', error.message);
    }
  }
}

export { connectDatabase, disconnectDatabase, getConnectionState };