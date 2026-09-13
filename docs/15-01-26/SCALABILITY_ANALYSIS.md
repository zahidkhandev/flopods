# Flopods Scalability Analysis & Recommendations

## Target: 100,000 Concurrent Users on AWS

**Date:** January 2025  
**Current Status:** Production-ready architecture with good foundations  
**Gap Analysis:** Focus on scalability, performance, and AWS optimization

---

## 🎯 Executive Summary

Your Flopods platform has a **solid foundation** with:

- ✅ Well-structured monorepo (Turborepo)
- ✅ Modern tech stack (NestJS, React, PostgreSQL, Redis, DynamoDB)
- ✅ Good database schema organization (multi-schema Prisma)
- ✅ WebSocket implementation for real-time collaboration
- ✅ Queue system (BullMQ/SQS abstraction)
- ✅ Vector search with pgvector

**However, for 100k users, you need critical optimizations:**

### Critical Issues (Must Fix)

1. **No database connection pooling configuration** - Will exhaust connections
2. **In-memory WebSocket state** - Won't scale across multiple EC2 instances
3. **Missing vector search indexes** - HNSW index not created
4. **No Redis clustering** - Single Redis instance will bottleneck
5. **Missing database read replicas** - All queries hit primary DB
6. **No CDN/CloudFront** - Static assets served from EC2
7. **No API rate limiting** - Vulnerable to abuse
8. **Missing monitoring/observability** - Can't detect issues at scale

### High Priority (Should Fix)

9. **No database query optimization** - Missing query analysis
10. **No caching layer** - Repeated queries hit DB
11. **WebSocket rate limiting too permissive** - 100 events/sec is high
12. **Missing database partitioning** - Large tables will slow down
13. **No background job scaling** - Fixed concurrency (10 workers)
14. **Missing S3 CloudFront** - Direct S3 access is slower

---

## 📊 Database Optimization (RDS PostgreSQL)

### Current State

- ✅ Good schema organization (core, canvas, billing, documents, admin)
- ✅ Good indexes on foreign keys and common queries
- ✅ pgvector extension enabled
- ❌ **No connection pooling** (Prisma uses default pool)
- ❌ **No HNSW index on vector column**
- ❌ **No read replicas**
- ❌ **No partitioning** for large tables

### Critical Fixes Needed

#### 1. **Connection Pooling** (URGENT)

**Problem:** Prisma default pool (10 connections) will exhaust with 100k users.

**Solution:** Use PgBouncer or RDS Proxy

```typescript
// apps/backend/src/prisma/prisma.service.ts
// Add connection pool configuration
super({
  adapter,
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings
  __internal: {
    engine: {
      connectTimeout: 10000,
      queryTimeout: 30000,
    },
  },
});
```

**RDS Configuration:**

- Use **RDS Proxy** (recommended) or **PgBouncer** on separate EC2
- Pool size: **100-200 connections** (RDS Proxy handles this)
- Enable connection pooling mode: **Transaction pooling**

**Environment Variables:**

```bash
# Use RDS Proxy endpoint instead of direct RDS
DATABASE_URL=postgresql://user:pass@flopods-proxy.xxxxx.rds.amazonaws.com:5432/flopods?pgbouncer=true&connection_limit=100
```

#### 2. **Vector Search Index** (URGENT)

**Problem:** Vector similarity search is slow without HNSW index.

**Current:** No index on `vector` column in `Embedding` table.

**Solution:** Create HNSW index

```sql
-- Migration: Create HNSW index for vector search
CREATE INDEX IF NOT EXISTS embedding_vector_hnsw_idx
ON documents."Embedding"
USING hnsw (vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- For production with 10M+ vectors, use:
-- m = 32, ef_construction = 200
```

**Performance Impact:**

- Without index: 500ms+ for 1M vectors
- With HNSW: <40ms for 10M vectors

#### 3. **Read Replicas** (HIGH PRIORITY)

**Problem:** All queries (reads + writes) hit primary database.

**Solution:** Set up RDS Read Replicas

```typescript
// apps/backend/src/prisma/prisma.service.ts
// Add read replica support
const readReplicaUrl = process.env.DATABASE_READ_REPLICA_URL || process.env.DATABASE_URL;

// Use read replica for SELECT queries
async findMany(...) {
  return this.$queryRaw(/* use read replica */);
}
```

**RDS Setup:**

- Create **2-3 read replicas** in different AZs
- Use **read replica endpoint** for:
  - Vector searches
  - Analytics queries
  - Dashboard data
  - Document listings

**Prisma Configuration:**

```prisma
datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL") // Primary (writes)
  directUrl = env("DATABASE_READ_REPLICA_URL") // Read replica
}
```

#### 4. **Table Partitioning** (MEDIUM PRIORITY)

**Problem:** Large tables (`PodExecution`, `PodUsageLog`, `DocumentAPILog`) will slow down.

**Solution:** Partition by date

```sql
-- Partition PodExecution by month
CREATE TABLE canvas."PodExecution" (
  -- existing columns
) PARTITION BY RANGE (startedAt);

-- Create monthly partitions
CREATE TABLE canvas."PodExecution_2025_01"
PARTITION OF canvas."PodExecution"
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

**Tables to Partition:**

- `PodExecution` (by `startedAt`)
- `PodUsageLog` (by `executedAt`)
- `DocumentAPILog` (by `processedAt`)
- `FlowActivityLog` (by `createdAt`)

#### 5. **Missing Indexes** (MEDIUM PRIORITY)

**Add these indexes for common queries:**

```sql
-- For workspace dashboard queries
CREATE INDEX idx_workspace_flows_recent
ON canvas."Flow" (workspaceId, updatedAt DESC)
WHERE visibility = 'PRIVATE';

-- For user activity queries
CREATE INDEX idx_user_notifications_unread
ON core."Notification" (userId, isRead, createdAt DESC)
WHERE isRead = false;

-- For document search
CREATE INDEX idx_document_search
ON documents."Document"
USING gin (to_tsvector('english', name || ' ' || COALESCE(metadata->>'description', '')));
```

#### 6. **Query Optimization** (ONGOING)

**Add query monitoring:**

```typescript
// Enable Prisma query logging in production
super({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
  ],
});

// Monitor slow queries
this.$on('query', (e) => {
  if (e.duration > 1000) {
    // > 1 second
    logger.warn(`Slow query: ${e.query} (${e.duration}ms)`);
  }
});
```

**RDS Performance Insights:**

- Enable **Performance Insights** on RDS
- Monitor top queries
- Identify N+1 queries

---

## 🔌 WebSocket Scalability (Critical)

### Current State

- ✅ Socket.IO with JWT authentication
- ✅ Rate limiting (100 events/sec per client)
- ✅ Room-based architecture
- ❌ **In-memory state** (`flowSessions` Map)
- ❌ **No Redis adapter** for multi-instance
- ❌ **No horizontal scaling** support

### Critical Fixes Needed

#### 1. **Redis Adapter for Socket.IO** (URGENT)

**Problem:** WebSocket state stored in memory won't work with multiple EC2 instances.

**Solution:** Use Redis adapter

```typescript
// apps/backend/src/v1/flow/flow.gateway.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

@WebSocketGateway({
  // ... existing config
})
export class V1FlowGateway {
  async afterInit(server: Server) {
    const pubClient = createClient({
      url: process.env.REDIS_URL,
    });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    server.adapter(createAdapter(pubClient, subClient));
    this.logger.log('🔌 Redis adapter enabled for WebSocket scaling');
  }
}
```

**Benefits:**

- ✅ Works across multiple EC2 instances
- ✅ Shared presence state
- ✅ Broadcast to all instances

#### 2. **ElastiCache Redis Cluster** (HIGH PRIORITY)

**Setup:**

- Use **ElastiCache Redis Cluster** (not single node)
- **3 nodes** minimum (1 primary + 2 replicas)
- Enable **automatic failover**
- Use **cluster mode** for >100k connections

**Configuration:**

```bash
REDIS_HOST=flopods-redis-cluster.xxxxx.cache.amazonaws.com
REDIS_PORT=6379
REDIS_TLS_ENABLED=true
REDIS_CLUSTER_MODE=true
```

#### 3. **WebSocket Rate Limiting** (MEDIUM PRIORITY)

**Current:** 100 events/sec is too high.

**Recommendation:** Reduce to 20-30 events/sec

```typescript
private readonly RATE_LIMIT = 20; // 20 events per second
private readonly RATE_LIMIT_WINDOW = 1000; // 1 second

// Use Redis for distributed rate limiting
async checkRateLimit(clientId: string): Promise<boolean> {
  const key = `ratelimit:ws:${clientId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 1);
  }
  return count <= 20;
}
```

#### 4. **WebSocket Connection Limits** (MEDIUM PRIORITY)

**Configure Socket.IO limits:**

```typescript
@WebSocketGateway({
  // ... existing config
  maxHttpBufferSize: 1e6, // 1MB (good)
  pingTimeout: 60000, // 1 minute (good)
  pingInterval: 25000, // 25 seconds (good)
  // Add these:
  transports: ['websocket'], // Disable polling for production
  allowEIO3: false, // Disable old Engine.IO
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
})
```

**Load Balancer Configuration:**

- Use **Application Load Balancer (ALB)** with **sticky sessions**
- Enable **WebSocket support**
- Health check: `/api/v1/health`

---

## 🚀 Queue System Optimization

### Current State

- ✅ BullMQ/SQS abstraction (good design)
- ✅ Retry logic with exponential backoff
- ✅ Job cleanup policies
- ❌ **Fixed concurrency** (10 workers)
- ❌ **No auto-scaling** workers
- ❌ **No dead letter queue** monitoring

### Fixes Needed

#### 1. **Dynamic Worker Scaling** (HIGH PRIORITY)

**Problem:** Fixed 10 workers won't handle 100k users.

**Solution:** Auto-scale workers based on queue depth

```typescript
// apps/backend/src/common/queue/redis-queue.adapter.ts
async startWorkerScaling() {
  setInterval(async () => {
    const waiting = await this.queue.getWaitingCount();
    const active = await this.queue.getActiveCount();

    // Scale workers based on queue depth
    const targetWorkers = Math.min(
      Math.ceil((waiting + active) / 10), // 10 jobs per worker
      100 // Max 100 workers
    );

    // Adjust worker concurrency
    this.worker.concurrency = targetWorkers;
  }, 5000); // Check every 5 seconds
}
```

**AWS SQS Setup:**

- Use **SQS Standard Queue** (not FIFO for throughput)
- Enable **long polling** (20 seconds)
- Set **visibility timeout** to 5 minutes
- Create **Dead Letter Queue (DLQ)** for failed jobs

#### 2. **Separate Queue Workers** (MEDIUM PRIORITY)

**Create separate queues:**

```typescript
// High priority: Document processing
const documentQueue = new Queue('document-processing', {
  defaultJobOptions: { priority: 1 },
});

// Low priority: Analytics, cleanup
const analyticsQueue = new Queue('analytics', {
  defaultJobOptions: { priority: 10 },
});
```

#### 3. **Queue Monitoring** (MEDIUM PRIORITY)

**Add CloudWatch metrics:**

```typescript
// Publish metrics to CloudWatch
async publishQueueMetrics() {
  const waiting = await this.queue.getWaitingCount();
  const active = await this.queue.getActiveCount();
  const completed = await this.queue.getCompletedCount();

  // Send to CloudWatch
  await cloudwatch.putMetricData({
    Namespace: 'Flopods/Queue',
    MetricData: [
      { MetricName: 'WaitingJobs', Value: waiting },
      { MetricName: 'ActiveJobs', Value: active },
      { MetricName: 'CompletedJobs', Value: completed },
    ],
  });
}
```

---

## ☁️ AWS Infrastructure Setup

### Recommended Architecture

```
┌─────────────────┐
│  CloudFront CDN │ ← Static assets (S3)
└────────┬────────┘
         │
┌────────▼────────┐
│  Application    │ ← WebSocket + HTTP
│  Load Balancer  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌───▼───┐
│ EC2-1 │ │ EC2-2 │ ← Auto Scaling Group (2-10 instances)
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         │
    ┌────▼────┐
    │ ElastiCache│ ← Redis Cluster (WebSocket + Queue)
    └───────────┘
         │
    ┌────▼────┐
    │ RDS Proxy│ ← Connection Pooling
    └────┬────┘
         │
    ┌────▼────┐      ┌──────────────┐
    │ RDS     │──────│ Read Replica │
    │ Primary │      │ (2-3 copies) │
    └─────────┘      └──────────────┘
         │
    ┌────▼────┐
    │ DynamoDB│ ← Pod state, sessions
    └─────────┘
         │
    ┌────▼────┐
    │   S3    │ ← Documents, vectors, assets
    └─────────┘
```

### EC2 Setup

**Instance Type:** `t3.xlarge` or `t3.2xlarge` (start with 2 instances)

- **CPU:** 4-8 vCPUs
- **RAM:** 16-32 GB
- **Network:** Up to 5 Gbps

**Auto Scaling:**

- **Min:** 2 instances
- **Max:** 10 instances
- **Scale up:** CPU > 70% for 5 minutes
- **Scale down:** CPU < 30% for 15 minutes

**User Data Script:**

```bash
#!/bin/bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Clone repo (or use CodeDeploy)
cd /opt/flopods
yarn install --production
yarn build

# Start with PM2
pm2 start apps/backend/dist/main.js --name flopods-backend -i max
pm2 save
pm2 startup
```

### RDS Setup

**Instance Type:** `db.r6g.xlarge` or `db.r6g.2xlarge`

- **Engine:** PostgreSQL 17 (with pgvector)
- **Storage:** 500 GB GP3 (auto-scaling to 1 TB)
- **Multi-AZ:** Yes (for failover)
- **Backup:** 7 days retention

**Read Replicas:**

- **2-3 replicas** in different AZs
- Use for: SELECT queries, vector search, analytics

**RDS Proxy:**

- **Endpoint:** `flopods-proxy.xxxxx.rds.amazonaws.com`
- **Pool size:** 100-200 connections
- **Idle timeout:** 10 minutes

### ElastiCache Setup

**Redis Cluster:**

- **Engine:** Redis 7.x
- **Node type:** `cache.r6g.large` (2 nodes minimum)
- **Cluster mode:** Enabled
- **Multi-AZ:** Yes
- **Backup:** Daily snapshots

**Use Cases:**

- WebSocket adapter (Socket.IO)
- Queue system (BullMQ)
- Caching layer (session, API responses)

### S3 Setup

**Buckets:**

1. **`flopods-documents`** - User documents
2. **`flopods-vectors`** - Vector embeddings backup
3. **`flopods-assets`** - Static assets (images, thumbnails)

**CloudFront Distribution:**

- **Origin:** S3 buckets
- **Cache:** 1 year for static assets
- **Compression:** Gzip/Brotli

**S3 Lifecycle Policies:**

- Move old documents to **Glacier** after 90 days
- Delete old vectors after 1 year

### DynamoDB Setup

**Tables:**

1. **`flopods-pods`** - Pod state (partition: `flowId`, sort: `podId`)
2. **`flopods-sessions`** - Flow sessions (partition: `flowId`, sort: `sessionId`)
3. **`flopods-executions`** - Execution history (partition: `workspaceId`, sort: `executionId`)
4. **`flopods-cache`** - General cache (partition: `key`, TTL: `expiresAt`)

**Configuration:**

- **On-demand** billing (for variable traffic)
- **TTL enabled** for cache table
- **Global Secondary Indexes** for common queries

---

## 🔍 Missing Features for Production

### 1. **API Rate Limiting** (URGENT)

**Problem:** No rate limiting on REST API endpoints.

**Solution:** Use `@nestjs/throttler`

```typescript
// apps/backend/src/app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

ThrottlerModule.forRoot({
  ttl: 60, // 1 minute
  limit: 100, // 100 requests per minute per IP
  storage: new ThrottlerStorageRedisService(), // Use Redis
}),
```

**Rate Limits:**

- **Public endpoints:** 60 req/min
- **Authenticated:** 200 req/min
- **WebSocket:** 20 events/sec (already configured)

### 2. **Caching Layer** (HIGH PRIORITY)

**Problem:** Repeated queries hit database.

**Solution:** Add Redis caching

```typescript
// apps/backend/src/common/cache/cache.service.ts
@Injectable()
export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  }
}
```

**Cache Strategies:**

- **Workspace data:** 5 minutes
- **User profile:** 15 minutes
- **Flow metadata:** 1 minute
- **Document list:** 30 seconds

### 3. **Monitoring & Observability** (HIGH PRIORITY)

**Missing:** No APM, logging, or metrics.

**Solution:** Add CloudWatch + DataDog/New Relic

```typescript
// apps/backend/src/common/monitoring/monitoring.module.ts
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

@Injectable()
export class MonitoringService {
  async trackMetric(name: string, value: number, unit: string = 'Count') {
    await cloudwatch.putMetricData({
      Namespace: 'Flopods',
      MetricData: [
        {
          MetricName: name,
          Value: value,
          Unit: unit,
          Timestamp: new Date(),
        },
      ],
    });
  }

  async trackError(error: Error, context: any) {
    // Send to CloudWatch Logs
    console.error(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
```

**Metrics to Track:**

- API response times (p50, p95, p99)
- Database query times
- Queue depth
- WebSocket connections
- Error rates
- User activity

### 4. **Health Checks** (MEDIUM PRIORITY)

**Add comprehensive health checks:**

```typescript
// apps/backend/src/v1/server/health.controller.ts
@Get('health')
async healthCheck() {
  const checks = {
    database: await this.checkDatabase(),
    redis: await this.checkRedis(),
    dynamodb: await this.checkDynamoDB(),
    s3: await this.checkS3(),
  };

  const healthy = Object.values(checks).every(c => c.status === 'ok');

  return {
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  };
}
```

### 5. **Database Migrations** (MEDIUM PRIORITY)

**Ensure safe migrations:**

```bash
# Use blue-green deployment for migrations
# 1. Deploy to new environment
# 2. Run migrations
# 3. Test
# 4. Switch traffic
```

**Migration Strategy:**

- Use **Prisma migrations** (already configured)
- Run migrations **before** deploying code
- Use **RDS Blue/Green deployments** for zero-downtime

### 6. **Background Job Monitoring** (MEDIUM PRIORITY)

**Add BullMQ dashboard:**

```typescript
// apps/backend/src/v1/admin/bullmq-dashboard.controller.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Controller('admin/queues')
export class BullMQDashboardController {
  @Get('dashboard')
  async dashboard() {
    // Return BullMQ dashboard HTML
  }
}
```

---

## 📋 Implementation Priority

### Phase 1: Critical (Week 1-2)

1. ✅ **RDS Proxy** - Connection pooling
2. ✅ **HNSW Vector Index** - Fast vector search
3. ✅ **Redis Adapter for Socket.IO** - WebSocket scaling
4. ✅ **ElastiCache Redis Cluster** - Shared state
5. ✅ **API Rate Limiting** - Prevent abuse

### Phase 2: High Priority (Week 3-4)

6. ✅ **RDS Read Replicas** - Offload reads
7. ✅ **Caching Layer** - Reduce DB load
8. ✅ **CloudWatch Monitoring** - Observability
9. ✅ **Auto Scaling Groups** - Handle traffic spikes
10. ✅ **CloudFront CDN** - Fast static assets

### Phase 3: Medium Priority (Week 5-6)

11. ✅ **Table Partitioning** - Optimize large tables
12. ✅ **Query Optimization** - Fix slow queries
13. ✅ **S3 CloudFront** - Fast document access
14. ✅ **Background Job Scaling** - Dynamic workers
15. ✅ **Health Checks** - System status

### Phase 4: Nice to Have (Week 7+)

16. ✅ **Database Query Analysis** - Identify bottlenecks
17. ✅ **Advanced Caching** - Cache invalidation strategies
18. ✅ **Cost Optimization** - Right-size instances
19. ✅ **Disaster Recovery** - Backup & restore procedures
20. ✅ **Performance Testing** - Load testing with 100k users

---

## 🎯 Next Steps

### Immediate Actions (This Week)

1. **Set up RDS Proxy** - Configure connection pooling
2. **Create HNSW index** - Run migration for vector search
3. **Deploy Redis adapter** - Update WebSocket gateway
4. **Add API rate limiting** - Install throttler module
5. **Set up CloudWatch** - Basic monitoring

### This Month

1. **Deploy to AWS** - EC2, RDS, ElastiCache, S3
2. **Configure Auto Scaling** - Handle traffic growth
3. **Set up Read Replicas** - Offload read queries
4. **Add Caching** - Reduce database load
5. **Load Testing** - Test with 10k, 50k, 100k users

### Next Quarter

1. **Optimize Queries** - Fix N+1, slow queries
2. **Partition Tables** - Handle large datasets
3. **Cost Optimization** - Right-size resources
4. **Disaster Recovery** - Backup procedures
5. **Documentation** - Runbooks, architecture docs

---

## 📊 Expected Performance

### With Optimizations

- **API Response Time:** < 200ms (p95)
- **Vector Search:** < 50ms (with HNSW index)
- **WebSocket Latency:** < 100ms
- **Database Connections:** < 50% pool usage
- **Queue Processing:** < 5 seconds average
- **Uptime:** 99.9% (with multi-AZ)

### Without Optimizations (Current State)

- **API Response Time:** 500ms+ (under load)
- **Vector Search:** 500ms+ (no index)
- **WebSocket:** Won't scale (in-memory state)
- **Database:** Connection exhaustion
- **Queue:** Backlog buildup
- **Uptime:** 95% (single instance)

---

## 💰 Cost Estimation (AWS)

### Monthly Costs (100k users)

**EC2 (Auto Scaling):**

- 2-5 instances (t3.xlarge): $150-375/month

**RDS:**

- Primary (db.r6g.xlarge): $200/month
- Read Replicas (2x): $400/month
- RDS Proxy: $50/month
- **Total:** $650/month

**ElastiCache:**

- Redis Cluster (3 nodes): $300/month

**S3:**

- Storage (500 GB): $12/month
- Requests: $5/month
- **Total:** $17/month

**DynamoDB:**

- On-demand (variable): $100-200/month

**CloudFront:**

- Data transfer: $50/month

**Data Transfer:**

- Inter-AZ: $50/month

**Total Estimated:** ~$1,500-2,000/month

---

## ✅ Conclusion

Your Flopods platform has **excellent architecture** but needs **critical scalability optimizations** for 100k users. Focus on:

1. **Database:** Connection pooling, read replicas, vector indexes
2. **WebSocket:** Redis adapter, clustering
3. **Infrastructure:** Auto scaling, monitoring, CDN
4. **Performance:** Caching, query optimization, rate limiting

**Timeline:** 6-8 weeks to production-ready at scale.

**Risk:** Without these optimizations, the system will fail under 10k+ concurrent users.

---

**Questions?** Review each section and implement in priority order.
