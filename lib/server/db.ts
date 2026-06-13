import dns from 'dns';
import { MongoClient, Db } from 'mongodb';
import { configureMongoDns } from './mongo-dns';

configureMongoDns();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.warn('MONGODB_URI is not set');
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var _mongoDb: Db | undefined;
}

export async function connectToDatabase() {
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not configured');
  }

  if (global._mongoClient && global._mongoDb) {
    return { client: global._mongoClient, db: global._mongoDb };
  }

  const client = await MongoClient.connect(uri);
  const db = client.db('nestworth');

  global._mongoClient = client;
  global._mongoDb = db;

  return { client, db };
}

export function setCorsHeaders(res: { setHeader: (key: string, value: string) => void }) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function handleOptions(req: { method?: string }, res: { status: (code: number) => { end: () => void } }) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
