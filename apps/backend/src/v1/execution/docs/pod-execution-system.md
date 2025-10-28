# Pod Execution System - Complete Architecture Documentation

## 📚 Table of Contents

1. [System Overview](#system-overview)
2. [Why We Need These Components](#why-we-need-these-components)
3. [Component Deep Dive](#component-deep-dive)
4. [Execution Flow](#execution-flow)
5. [Context Resolution](#context-resolution)
6. [Queue System (BullMQ ↔ SQS)](#queue-system)
7. [One-Click Queue Migration](#one-click-queue-migration)
8. [Example Usage](#example-usage)

---

## System Overview

The Pod Execution System is the **heart of Flopods's AI workflow engine**. It orchestrates the execution of LLM (Large Language Model) pods in a flow, managing:

- **Context Resolution** - Building context from upstream pod outputs
- **Variable Interpolation** - Replacing `{{pod_id}}` references with actual outputs
- **Queue Management** - Async execution with BullMQ (dev) or SQS (prod)
- **Real-time Updates** - WebSocket notifications for execution status
- **Cost Tracking** - Token usage and cost calculation per execution

---

## Why We Need These Components

### 1. **Context Resolution Service** (`context-resolution.service.ts`)

**Problem:** Pods in a flow are connected (Pod A → Pod B → Pod C). When executing Pod B, it needs Pod A's output as context.

**Solution:** The context resolution service:

- Finds all upstream connected pods (those that feed into current pod)
- Retrieves their latest execution outputs
- Builds a variable map (`pod_a_id` → `"Pod A's actual output"`)
- Enables variable interpolation in prompts

**Example:**

```
Pod A: "What is quantum computing?"
Output: "Quantum computing uses qubits to process information..."

Pod B System Prompt: "Summarize this: {{pod_a_id}}"
After interpolation: "Summarize this: Quantum computing uses qubits to process information..."
```

**Why Critical:**

- Without it, pods can't reference each other's outputs
- No way to build complex multi-step AI workflows
- Users would have to manually copy-paste outputs between pods

---

### 2. **Execution Queue Service** (`execution-queue.service.ts`)

**Problem:** LLM API calls can take 5-30 seconds. Blocking the HTTP request thread causes:

- Timeout errors for long-running executions
- Poor user experience (stuck waiting)
- Server resource exhaustion under load

**Solution:** Queue-based async execution:

- User clicks "Execute" → Returns immediately with `executionId`
- Execution job queued in background (BullMQ/SQS)
- Worker processes job asynchronously
- Real-time status updates via WebSocket

**Why Critical:**

- **Scalability** - Handle 1000s of concurrent executions
- **Reliability** - Retry failed executions automatically
- **User Experience** - Non-blocking, responsive UI
- **Resource Efficiency** - Controlled concurrency (max 10 workers)

---

### 3. **Execution Service** (`execution.service.ts`)

**Problem:** Need a central orchestrator that:

- Validates pod access (workspace permissions)
- Fetches pod configuration from DynamoDB
- Resolves context from upstream pods
- Calls the correct LLM provider (OpenAI/Claude/Gemini)
- Tracks costs and usage
- Updates pod status in real-time

**Solution:** The execution service is the **main coordinator** that:

1. Validates the request
2. Resolves context using `ContextResolutionService`
3. Interpolates variables in prompts
4. Calls LLM provider
5. Calculates costs
6. Saves execution results
7. Updates pod status

**Why Critical:**

- Single source of truth for execution logic
- Ensures consistent behavior across sync/async modes
- Handles all error cases gracefully
- Tracks every execution for audit and billing

---

## Component Deep Dive

### Context Resolution Service

**File:** `context-resolution.service.ts`

**Key Methods:**

```typescript
// 1. Resolve all upstream pod outputs
async resolveContext(podId: string, flowId: string): Promise<ContextChain>

// 2. Interpolate variables in text
interpolateVariables(text: string, variables: Record<string, string>): string

// 3. Get topological execution order
async getExecutionOrder(flowId: string): Promise<string[]>
```

**Data Structures:**

```typescript
interface ContextChain {
  pod: { id: string; type: PodType };
  context: ResolvedContext[]; // Upstream pod outputs
  variables: Record<string, string>; // pod_id → output mapping
}

interface ResolvedContext {
  podId: string;
  output: string; // Actual LLM response
  executionId?: string;
  timestamp: Date;
}
```

**Algorithm:**

1. **Find Upstream Pods:**

   ```sql
   SELECT sourcePodId FROM edges
   WHERE flowId = ? AND targetPodId = ?
   ```

2. **Get Latest Execution for Each:**

   ```sql
   SELECT responseMetadata FROM podExecution
   WHERE podId = ? AND status = 'COMPLETED'
   ORDER BY finishedAt DESC LIMIT 1
   ```

3. **Extract Output:**
   - OpenAI: `response.choices[0].message.content`
   - Anthropic: `response.content[0].text`
   - Gemini: `response.candidates[0].content.parts[0].text`

4. **Build Variable Map:**

   ```typescript
   variables['pod_abc123'] = 'Quantum computing uses qubits...';
   ```

5. **Interpolate in Prompts:**
   ```typescript
   text.replace(/\{\{([a-zA-Z0-9_-]+)(?:\.output)?\}\}/g, (match, podId) => {
     return variables[podId] || match;
   });
   ```

---

### Execution Queue Service

**File:** `execution-queue.service.ts`

**Key Features:**

1. **Queue Creation:**

   ```typescript
   this.executionQueue = this.queueFactory.createQueue('pod-executions', 10);
   // 10 = max concurrent workers
   ```

2. **Job Enqueueing:**

   ```typescript
   async queueExecution(data: ExecutionJobData): Promise<string> {
     const jobId = await this.executionQueue.add('execute-pod', data, {
       jobId: data.executionId, // Use execution ID as job ID for idempotency
     });

     // Emit WebSocket event
     this.flowGateway.broadcastToFlow(data.flowId, 'execution:queued', {...});

     return jobId;
   }
   ```

3. **Job Processing:**

   ```typescript
   private async processExecution(job: any) {
     const { executionId, podId, workspaceId, userId, flowId, ...params } = job.data;

     // Update status to RUNNING
     await this.updateExecutionStatus(executionId, PodExecutionStatus.RUNNING);
     this.flowGateway.broadcastToFlow(flowId, 'execution:running', {...});

     try {
       // Execute the pod
       const result = await this.executionService.executePodInternal({
         executionId, podId, workspaceId, userId, ...params
       });

       // Emit success
       this.flowGateway.broadcastToFlow(flowId, 'execution:completed', {result});

       return result;
     } catch (error) {
       // Emit error
       this.flowGateway.broadcastToFlow(flowId, 'execution:error', {error});
       throw error;
     }
   }
   ```

4. **Real-time Status Updates:**
   - `execution:queued` - Job added to queue
   - `execution:running` - Worker started processing
   - `execution:completed` - Success
   - `execution:error` - Failure

---

### Execution Service

**File:** `execution.service.ts`

**Execution Pipeline:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. VALIDATE POD                                             │
│    - Check workspace access                                 │
│    - Verify pod type (must be LLM_PROMPT)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. FETCH POD CONFIG FROM DYNAMODB                           │
│    - Provider (OpenAI/Claude/Gemini)                        │
│    - Model (gpt-4o, claude-3-5-sonnet, etc.)                │
│    - System prompt, temperature, maxTokens                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. RESOLVE CONTEXT                                          │
│    - Find upstream pods (edges pointing TO this pod)        │
│    - Get their latest outputs                               │
│    - Build variable map: {pod_id: "output"}                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. INTERPOLATE VARIABLES                                    │
│    - Replace {{pod_a_id}} in system prompt                  │
│    - Replace {{pod_b_id}} in user messages                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. GET WORKSPACE API KEY                                    │
│    - Fetch encrypted key from database                      │
│    - Decrypt using AES-256-GCM                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. EXECUTE LLM REQUEST                                      │
│    - Call provider (OpenAI/Claude/Gemini)                   │
│    - Stream or wait for response                            │
│    - Extract response content                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. CALCULATE COSTS                                          │
│    - Fetch model pricing from database                      │
│    - inputCost = (promptTokens / 1M) * pricing.inputCost    │
│    - outputCost = (completionTokens / 1M) * pricing.output  │
│    - reasoningCost = (reasoningTokens / 1M) * pricing.reas  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. SAVE RESULTS                                             │
│    - Update podExecution (status, tokens, cost, response)   │
│    - Track API key usage                                    │
│    - Update pod status (lastExecutionId)                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. RETURN RESULT                                            │
│    - executionId, content, usage, cost                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Execution Flow

### Synchronous Execution (Immediate Response)

```
USER REQUEST
    ↓
POST /api/workspaces/:id/executions
{
  "podId": "pod_abc123",
  "messages": [{"role": "user", "content": "Explain {{pod_previous}}"}],
  "async": false
}
    ↓
ExecutionService.executePod()
    ↓
[Pipeline executes - see diagram above]
    ↓
RESPONSE (5-30 seconds later)
{
  "executionId": "exec_xyz789",
  "content": "Quantum computing is...",
  "usage": {...},
  "cost": {...}
}
```

### Asynchronous Execution (Queue-Based)

```
USER REQUEST
    ↓
POST /api/workspaces/:id/executions
{
  "podId": "pod_abc123",
  "messages": [...],
  "async": true  ← KEY DIFFERENCE
}
    ↓
ExecutionController.executePod()
    ↓
ExecutionQueueService.queueExecution()
    ↓
Job added to queue (BullMQ/SQS)
    ↓
IMMEDIATE RESPONSE (< 100ms)
{
  "executionId": "exec_xyz789",
  "status": "queued"
}
    ↓
WebSocket Event → Frontend
{
  "type": "execution:queued",
  "executionId": "exec_xyz789",
  "podId": "pod_abc123",
  "status": "QUEUED"
}

    ⏱️ MEANWHILE (background worker)

Queue Worker picks up job
    ↓
ExecutionQueueService.processExecution()
    ↓
WebSocket Event → "execution:running"
    ↓
ExecutionService.executePodInternal()
    ↓
[Pipeline executes]
    ↓
WebSocket Event → "execution:completed"
{
  "type": "execution:completed",
  "executionId": "exec_xyz789",
  "result": {...}
}
```

**Frontend receives 3 WebSocket events:**

1. `execution:queued` - Job added to queue
2. `execution:running` - Worker started
3. `execution:completed` - Result ready

---

## Context Resolution

### Example Flow with 3 Connected Pods

**Setup:**

```
┌──────────────┐
│   Pod A      │  Research Pod
│  (RESEARCH)  │  Prompt: "What is quantum computing?"
└──────┬───────┘
       │
       ↓ (edge)
┌──────────────┐
│   Pod B      │  Summary Pod
│  (SUMMARY)   │  System: "Summarize this: {{pod_a}}"
└──────┬───────┘  User: "Make it 3 sentences"
       │
       ↓ (edge)
┌──────────────┐
│   Pod C      │  Action Pod
│  (ACTIONS)   │  System: "Extract action items from: {{pod_b}}"
└──────────────┘
```

**Execution Sequence:**

**1. Execute Pod A:**

```typescript
// No upstream pods → No context
contextChain = {
  pod: { id: 'pod_a', type: 'LLM_PROMPT' },
  context: [],
  variables: {},
};

// Final prompt to LLM
messages = [
  { role: 'system', content: 'You are a helpful AI assistant' },
  { role: 'user', content: 'What is quantum computing?' },
];

// Response saved
response = 'Quantum computing uses qubits to process information. Unlike classical bits...';
```

**2. Execute Pod B:**

```typescript
// Find upstream pods
upstreamEdges = [{ sourcePodId: 'pod_a', targetPodId: 'pod_b' }]

// Get Pod A's latest execution
podA_output = "Quantum computing uses qubits to process information. Unlike classical bits..."

// Build context
contextChain = {
  pod: { id: 'pod_b', type: 'LLM_PROMPT' },
  context: [
    {
      podId: 'pod_a',
      output: "Quantum computing uses qubits...",
      executionId: 'exec_123',
      timestamp: Date()
    }
  ],
  variables: {
    'pod_a': "Quantum computing uses qubits..."
  }
}

// Interpolate system prompt
systemPrompt = "Summarize this: {{pod_a}}"
↓
systemPrompt = "Summarize this: Quantum computing uses qubits to process information..."

// Final prompt to LLM
messages = [
  { role: 'system', content: 'Summarize this: Quantum computing uses qubits...' },
  { role: 'user', content: 'Make it 3 sentences' }
]

// Response saved
response = "Quantum computing leverages qubits. It processes information differently. This enables exponential speedup."
```

**3. Execute Pod C:**

```typescript
// Find upstream pods
upstreamEdges = [{ sourcePodId: 'pod_b', targetPodId: 'pod_c' }]

// Get Pod B's latest execution
podB_output = "Quantum computing leverages qubits. It processes information differently. This enables exponential speedup."

// Build context
contextChain = {
  pod: { id: 'pod_c', type: 'LLM_PROMPT' },
  context: [
    {
      podId: 'pod_b',
      output: "Quantum computing leverages qubits...",
      executionId: 'exec_456',
      timestamp: Date()
    }
  ],
  variables: {
    'pod_b': "Quantum computing leverages qubits..."
  }
}

// Interpolate system prompt
systemPrompt = "Extract action items from: {{pod_b}}"
↓
systemPrompt = "Extract action items from: Quantum computing leverages qubits. It processes information differently..."

// Final prompt to LLM
messages = [
  { role: 'system', content: 'Extract action items from: Quantum computing leverages qubits...' },
  { role: 'user', content: '' }  // No additional user message
]

// Response saved
response = "1. Research qubits\n2. Study quantum information processing\n3. Learn about quantum speedup"
```

---

## Queue System

### Why We Need a Queue

**Without Queue (Synchronous Only):**

```
User clicks Execute
  ↓
HTTP Request starts
  ↓
Wait 5-30 seconds (LLM API call)
  ↓
Response returns
```

**Problems:**

- ❌ Browser timeout after 30s
- ❌ Server thread blocked (can't handle other requests)
- ❌ No retry on failure
- ❌ No concurrency control (can overwhelm LLM API)
- ❌ Poor UX (user stuck waiting)

**With Queue (Asynchronous):**

```
User clicks Execute
  ↓
HTTP Request returns immediately (< 100ms)
  ↓
Job queued for background processing
  ↓
Worker picks up job when available
  ↓
WebSocket updates frontend in real-time
```

**Benefits:**

- ✅ Instant response (< 100ms)
- ✅ Automatic retries (3 attempts with exponential backoff)
- ✅ Concurrency control (max 10 workers)
- ✅ Graceful degradation (queue persists across restarts)
- ✅ Better UX (real-time progress updates)

---

### Queue Architecture

**Development (BullMQ + Redis):**

```
┌─────────────────┐
│   Controller    │
└────────┬────────┘
         │ queueExecution()
         ↓
┌─────────────────┐
│  QueueFactory   │ ← creates adapter
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ RedisQueueAdapter│ ← BullMQ wrapper
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Redis (local) │ ← Job storage
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Worker Pool   │ ← 10 concurrent workers
└────────┬────────┘
         │ processExecution()
         ↓
┌─────────────────┐
│ ExecutionService│
└─────────────────┘
```

**Production (AWS SQS):**

```
┌─────────────────┐
│   Controller    │
└────────┬────────┘
         │ queueExecution()
         ↓
┌─────────────────┐
│  QueueFactory   │ ← creates adapter
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  SqsQueueAdapter │ ← SQS wrapper
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   AWS SQS       │ ← Job storage (managed)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Worker Pool   │ ← Auto-scaled workers (Fargate/Lambda)
└────────┬────────┘
         │ processExecution()
         ↓
┌─────────────────┐
│ ExecutionService│
└─────────────────┘
```

---

## One-Click Queue Migration

### Current Setup (Already Done!)

**File:** `apps/backend/src/common/queue/queue.factory.ts`

```typescript
@Injectable()
export class QueueFactory {
  constructor(private readonly config: ConfigService) {}

  createQueue(queueName: string, maxConcurrency: number): QueueAdapter {
    const backend = this.config.get<string>('QUEUE_BACKEND') || 'redis';

    if (backend === 'sqs') {
      return new SqsQueueAdapter(queueName, maxConcurrency, this.config);
    } else {
      return new RedisQueueAdapter(queueName, maxConcurrency, this.config);
    }
  }
}
```

### Migration Steps (Literally 1 Change)

**From BullMQ to SQS:**

**Step 1:** Update `.env` file

```bash
# Change this ONE line:
QUEUE_BACKEND=redis  # ← From this
QUEUE_BACKEND=sqs    # ← To this

# Add SQS config (if not already present):
AWS_SQS_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/715841334028/flopods-executions
AWS_SQS_REGION=ap-south-1
```

**Step 2:** Restart backend

```bash
yarn dev:backend
```

**That's it!** The system now uses SQS instead of Redis.

---

### How It Works

**Queue Adapter Interface:**

```typescript
export interface QueueAdapter {
  add(jobName: string, data: any, options?: any): Promise<string>;
  process(handler: (job: any) => Promise<any>): void;
  close(): Promise<void>;
  cancel(jobId: string): Promise<boolean>;
  getMetrics(): Promise<any>;
  getJobStatus(jobId: string): Promise<any>;
}
```

**Both adapters implement the same interface:**

**RedisQueueAdapter (BullMQ):**

```typescript
class RedisQueueAdapter implements QueueAdapter {
  private queue: Queue;

  async add(jobName: string, data: any, options?: any): Promise<string> {
    const job = await this.queue.add(jobName, data, options);
    return job.id;
  }

  process(handler: (job: any) => Promise<any>): void {
    new Worker(this.queueName, handler, {...});
  }

  // ... other methods
}
```

**SqsQueueAdapter (AWS SQS):**

```typescript
class SqsQueueAdapter implements QueueAdapter {
  private sqsClient: SQSClient;

  async add(jobName: string, data: any, options?: any): Promise<string> {
    const response = await this.sqsClient.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ jobName, data }),
      }),
    );
    return response.MessageId;
  }

  process(handler: (job: any) => Promise<any>): void {
    this.pollMessages(handler); // Long polling SQS
  }

  // ... other methods
}
```

**ExecutionQueueService doesn't care which implementation:**

```typescript
// This code works with BOTH BullMQ and SQS:
this.executionQueue = this.queueFactory.createQueue('pod-executions', 10);

await this.executionQueue.add('execute-pod', data, { jobId });
```

---

### Environment Variables

**`.env` file:**

```bash
# ==========================================
# QUEUE CONFIGURATION
# ==========================================

# Queue Backend: 'redis' (dev) or 'sqs' (prod)
QUEUE_BACKEND=redis

# Redis (Development - BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS_ENABLED=false

# AWS SQS (Production)
AWS_SQS_ACCESS_KEY_ID=AKIA...
AWS_SQS_SECRET_ACCESS_KEY=...
AWS_SQS_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/715841334028/flopods-executions
AWS_SQS_REGION=ap-south-1
```

**To switch:** Just change `QUEUE_BACKEND=redis` to `QUEUE_BACKEND=sqs`

---

## Example Usage

### Execute Pod Synchronously

**Request:**

```http
POST /api/v1/workspaces/cm2abc123/executions
Authorization: Bearer <token>
Content-Type: application/json

{
  "podId": "pod_xyz789",
  "messages": [
    {
      "role": "user",
      "content": "Explain quantum computing"
    }
  ],
  "provider": "OPENAI",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 2000,
  "async": false
}
```

**Response (after 5-10 seconds):**

```json
{
  "executionId": "exec_cm2def456",
  "content": "Quantum computing is a revolutionary approach to computation...",
  "usage": {
    "promptTokens": 42,
    "completionTokens": 357,
    "totalTokens": 399,
    "reasoningTokens": 0,
    "cachedTokens": 0
  },
  "cost": {
    "inputCost": 0.000105,
    "outputCost": 0.001785,
    "reasoningCost": 0,
    "totalCost": 0.00189
  }
}
```

---

### Execute Pod Asynchronously (Queue)

**Request:**

```http
POST /api/v1/workspaces/cm2abc123/executions
Authorization: Bearer <token>
Content-Type: application/json

{
  "podId": "pod_xyz789",
  "messages": [
    {
      "role": "user",
      "content": "Explain quantum computing in detail with {{pod_previous}} context"
    }
  ],
  "async": true  ← KEY DIFFERENCE
}
```

**Immediate Response (< 100ms):**

```json
{
  "executionId": "exec_cm2def456",
  "status": "queued"
}
```

**WebSocket Events (received over time):**

**Event 1 (immediately):**

```json
{
  "type": "execution:queued",
  "executionId": "exec_cm2def456",
  "podId": "pod_xyz789",
  "status": "QUEUED"
}
```

**Event 2 (when worker picks up job):**

```json
{
  "type": "execution:running",
  "executionId": "exec_cm2def456",
  "podId": "pod_xyz789",
  "status": "RUNNING"
}
```

**Event 3 (when completed):**

```json
{
  "type": "execution:completed",
  "executionId": "exec_cm2def456",
  "podId": "pod_xyz789",
  "status": "COMPLETED",
  "result": {
    "executionId": "exec_cm2def456",
    "content": "Quantum computing is a revolutionary approach...",
    "usage": {...},
    "cost": {...}
  }
}
```

---

### Get Execution History

**Request:**

```http
GET /api/v1/workspaces/cm2abc123/executions/pod/pod_xyz789?limit=10
Authorization: Bearer <token>
```

**Response:**

```json
[
  {
    "id": "exec_cm2def456",
    "podId": "pod_xyz789",
    "status": "COMPLETED",
    "provider": "OPENAI",
    "modelId": "gpt-4o",
    "modelName": "gpt-4o-2024-05-13",
    "inputTokens": 42,
    "outputTokens": 357,
    "reasoningTokens": 0,
    "costInUsd": "0.001890",
    "startedAt": "2025-10-24T18:00:00.000Z",
    "finishedAt": "2025-10-24T18:00:05.432Z",
    "runtimeInMs": 5432,
    "errorMessage": null,
    "errorCode": null
  },
  ...
]
```

---

### Cancel Queued Execution

**Request:**

```http
DELETE /api/v1/workspaces/cm2abc123/executions/exec_cm2def456
Authorization: Bearer <token>
```

**Response:**

```http
HTTP/1.1 204 No Content
```

---

## Summary

### What We Built

1. **Context Resolution Service** - Enables pods to reference each other's outputs
2. **Execution Queue Service** - Async execution with BullMQ/SQS
3. **Execution Service** - Main orchestrator for pod execution
4. **Queue Factory** - Abstraction for easy BullMQ ↔ SQS migration

### Why It Matters

- **Scalability** - Queue handles 1000s of concurrent executions
- **Reliability** - Automatic retries, graceful degradation
- **User Experience** - Real-time updates, instant responses
- **Flexibility** - One-line change to switch queue backends
- **Context-Aware** - Pods can build on each other's outputs

### Migration Path

**Development:** BullMQ + Redis (local, fast, easy to debug)
**Production:** AWS SQS (managed, scalable, no infrastructure)

**To switch:** Change ONE environment variable (`QUEUE_BACKEND=sqs`)

---

**🎉 That's the complete Pod Execution System!**
