import 'server-only';
import { resolveUserFromRequest } from '@/lib/auth-session';
import { prisma } from '@/lib/prisma';
import { productionEnginePrivateStorage } from './private-storage';
import type { EngineReaderPorts } from './reader-http';
export function engineReaderPorts(): EngineReaderPorts { return { db: prisma, storage: productionEnginePrivateStorage,
  parent: async request => (await resolveUserFromRequest(request))?.user ?? null }; }
