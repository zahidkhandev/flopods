Perfect! Let's **get tactical** and build this **bottom-up** starting with the foundational files. Here's the **exact order of work**:

---

# **🎯 IMPLEMENTATION ORDER (Bottom-Up Approach)**

---

## **PHASE 1: Foundation Layer** (No dependencies)

### **1. Types** ✅ (Already done)

- ✅ `document.types.ts` - Enums, interfaces
- ✅ `queue.types.ts` - Queue message structure
- ✅ `processor.types.ts` - Processing interfaces
- ✅ `embedding.types.ts` - Embedding configs

---

## **PHASE 2: Utilities** (Pure functions, no DI)

### **2. Text Chunker**

**File**: `utils/text-chunker.util.ts`

**Purpose**: Split document text into chunks (512 tokens, 50 overlap)

**Dependencies**: `tiktoken`

**Context Needed**:

- Token counting logic using `cl100k_base` encoding
- Paragraph-based splitting with overlap
- Sentence boundary preservation
- Return `TextChunk[]` array

---

### **3. Token Counter**

**File**: `utils/token-counter.util.ts`

**Purpose**: Count tokens in text using tiktoken

**Dependencies**: `tiktoken`

**Context Needed**:

- Simple wrapper around tiktoken
- Cache encoder instance
- Return token count as number

---

### **4. Cost Calculator**

**File**: `utils/cost-calculator.util.ts`

**Purpose**: Calculate embedding generation costs

**Dependencies**: None (pure math)

**Context Needed**:

- Take token count + provider pricing
- Return cost in USD
- Support Gemini ($0.01/1M) and OpenAI ($20/1M)

---

### **5. MIME Detector**

**File**: `utils/mime-detector.util.ts`

**Purpose**: Detect file MIME type from buffer

**Dependencies**: `file-type`, `mime-types`

**Context Needed**:

- Read file buffer
- Detect MIME type
- Map to document source type (PDF, image, etc.)

---

## **PHASE 3: Queue Infrastructure** (Abstract + Concrete)

### **6. Queue Interface**

**File**: `queues/queue.interface.ts`

**Purpose**: Abstract queue interface for both BullMQ and SQS

**Dependencies**: None

**Context Needed**:

```typescript
export interface IQueueService {
  sendMessage(message: DocumentQueueMessage): Promise<string>;
  sendBatch(messages: DocumentQueueMessage[]): Promise<string[]>;
  startConsumer(handler: Function): Promise<void>;
  stopConsumer(): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;
  getMetrics(): Promise<QueueMetrics>;
}
```

---

### **7. BullMQ Queue Service**

**File**: `queues/bullmq-queue.service.ts`

**Purpose**: Implement IQueueService using BullMQ + Redis

**Dependencies**: `@nestjs/bullmq`, `bullmq`, `ConfigService`

**Context Needed**:

- Connect to Redis (localhost:6379 in dev)
- Implement all IQueueService methods
- Job options: 3 retries, exponential backoff
- Priority support (HIGH/NORMAL/LOW)

---

### **8. SQS Queue Service**

**File**: `queues/sqs-queue.service.ts`

**Purpose**: Implement IQueueService using AWS SQS

**Dependencies**: `@aws-sdk/client-sqs`, `ConfigService`

**Context Needed**:

- Connect to SQS FIFO queue
- MessageGroupId = workspaceId (FIFO ordering)
- MessageDeduplicationId = documentId
- Long polling (20s)
- Batch support (max 10 messages)

---

### **9. Queue Factory**

**File**: `queues/queue.factory.ts`

**Purpose**: Factory to return BullMQ or SQS based on env

**Dependencies**: BullMQ, SQS services, ConfigService

**Context Needed**:

```typescript
@Injectable()
export class QueueFactory {
  createQueue(): IQueueService {
    const backend = this.config.get('QUEUE_BACKEND'); // 'redis' or 'sqs'
    return backend === 'sqs' ? new SqsQueueService() : new BullMqQueueService();
  }
}
```

---

### **10. Document Queue Producer**

**File**: `queues/document-queue.producer.ts`

**Purpose**: Send documents to queue (unified interface)

**Dependencies**: QueueFactory

**Context Needed**:

- Method: `sendProcessingJob(documentId, workspaceId, userId, metadata)`
- Method: `sendReprocessingJob(documentId)`
- Method: `sendBulkJobs(documents[])`
- Use factory to get queue service

---

### **11. Document Queue Consumer**

**File**: `queues/document-queue.consumer.ts`

**Purpose**: Consume queue messages and trigger processing

**Dependencies**: QueueFactory, OrchestratorService

**Context Needed**:

- Start on module init
- Poll queue continuously
- Call orchestrator for each message
- ACK on success, retry on failure

---

## **PHASE 4: Document Processors** (Business logic)

### **12. Base Processor (Abstract)**

**File**: `processors/base-processor.abstract.ts`

**Purpose**: Abstract base class for all processors

**Dependencies**: None

**Context Needed**:

```typescript
export abstract class BaseProcessor {
  abstract process(documentId: string): Promise<ExtractedContent>;
  abstract validate(file: Buffer): Promise<boolean>;
  abstract getMetadata(file: Buffer): Promise<Record<string, any>>;
}
```

---

### **13. PDF Processor**

**File**: `processors/pdf-processor.service.ts`

**Purpose**: Extract text from PDFs

**Dependencies**: `pdf-parse`, S3Service, BaseProcessor

**Context Needed**:

- Download PDF from S3
- Extract text using pdf-parse
- Handle scanned PDFs (OCR fallback with Tesseract)
- Return ExtractedContent

---

### **14. Image Processor**

**File**: `processors/image-processor.service.ts`

**Purpose**: OCR text extraction from images

**Dependencies**: `tesseract.js`, `sharp`, S3Service

**Context Needed**:

- Download image from S3
- Optimize with Sharp (resize if >10MB)
- Run Tesseract OCR
- Optional: Gemini Vision description
- Return ExtractedContent

---

### **15. YouTube Processor**

**File**: `processors/youtube-processor.service.ts`

**Purpose**: Fetch YouTube video transcripts

**Dependencies**: `youtube-transcript`, `@distube/ytdl-core`

**Context Needed**:

- Parse video ID from URL
- Fetch transcript (auto-generated or manual)
- Get metadata (title, duration, thumbnail)
- Return ExtractedContent

---

### **16. URL Processor**

**File**: `processors/url-processor.service.ts`

**Purpose**: Scrape and extract web content

**Dependencies**: `cheerio`, `axios`

**Context Needed**:

- Fetch webpage content
- Extract main content (Readability algorithm)
- Remove ads, navigation, footer
- Parse metadata
- Return ExtractedContent

---

### **17. Processor Orchestrator**

**File**: `processors/orchestrator.service.ts`

**Purpose**: Route documents to correct processor

**Dependencies**: All processors, PrismaService, EmbeddingsService

**Context Needed**:

- Fetch document from DB
- Route based on sourceType (INTERNAL, YOUTUBE, URL)
- Call appropriate processor
- Pass extracted text to EmbeddingsService
- Update document status

---

## **PHASE 5: Core Services** (Main business logic)

### **18. Embeddings Service**

**File**: `services/embeddings.service.ts`

**Purpose**: Generate and store embeddings

**Dependencies**: `@google/generative-ai`, TextChunker, PrismaService, S3Service

**Context Needed**:

- Check BYOK (user's Gemini key) or use platform key
- Chunk text (512 tokens, 50 overlap)
- Generate embeddings in batches (100 chunks)
- Store in pgvector + S3 backup
- Track costs

---

### **19. Vector Search Service**

**File**: `services/vector-search.service.ts`

**Purpose**: Semantic search across documents

**Dependencies**: PrismaService, EmbeddingsService

**Context Needed**:

- Generate query embedding
- Execute pgvector similarity search (cosine distance)
- Filter by workspace, document IDs, folder
- Return top K results with similarity scores

---

### **20. Cost Tracking Service**

**File**: `services/cost-tracking.service.ts`

**Purpose**: Track and deduct processing costs

**Dependencies**: PrismaService, CostCalculator

**Context Needed**:

- Calculate total cost (extraction + embeddings)
- Store in DocumentProcessingCost table
- Deduct credits from subscription
- Check sufficient balance before processing

---

### **21. Documents Service**

**File**: `services/documents.service.ts`

**Purpose**: Main document CRUD operations

**Dependencies**: PrismaService, S3Service, DocumentQueueProducer

**Context Needed**:

- Create document record
- Upload file to S3
- Queue processing job
- Get/update/delete documents
- List documents with pagination

---

### **22. Folders Service**

**File**: `services/folders.service.ts`

**Purpose**: Folder CRUD and tree operations

**Dependencies**: PrismaService

**Context Needed**:

- Create folder (with parent)
- List folders as tree structure
- Move documents/folders
- Delete folder (cascade)
- Update folder metadata

---

## **PHASE 6: DTOs** (Validation)

### **23-29. All DTOs** (Create these together)

- `upload-document.dto.ts` - Multipart file upload
- `link-external.dto.ts` - YouTube/URL linking
- `update-document.dto.ts` - Name, folder updates
- `search-documents.dto.ts` - Search query, filters
- `list-documents.dto.ts` - Pagination, filters
- `create-folder.dto.ts` - Folder name, parent, icon
- `move-items.dto.ts` - Move documents/folders

**Context**: Standard NestJS DTOs with class-validator decorators

---

## **PHASE 7: Guards & Interceptors**

### **30. Workspace Ownership Guard**

**File**: `guards/workspace-ownership.guard.ts`

**Purpose**: Verify user owns workspace

**Dependencies**: PrismaService

**Context**: Check WorkspaceUser membership

---

### **31. Document Access Guard**

**File**: `guards/document-access.guard.ts`

**Purpose**: Verify user can access document

**Dependencies**: PrismaService

**Context**: Check document.workspaceId matches user's workspace

---

### **32. File Size Limit Interceptor**

**File**: `interceptors/file-size-limit.interceptor.ts`

**Purpose**: Check file size based on subscription tier

**Dependencies**: PrismaService

**Context**: HOBBYIST=10MB, PRO=100MB, TEAM=500MB

---

### **33. File Type Validator Interceptor**

**File**: `interceptors/file-type-validator.interceptor.ts`

**Purpose**: Validate MIME type

**Context**: Only allow PDFs, images, text files

---

## **PHASE 8: Controllers** (API endpoints)

### **34. Documents Controller**

**File**: `controllers/documents.controller.ts`

**Purpose**: Document upload, list, CRUD endpoints

**Dependencies**: DocumentsService, Guards, Interceptors

**Context**: All document management endpoints

---

### **35. Folders Controller**

**File**: `controllers/folders.controller.ts`

**Purpose**: Folder CRUD, tree, move endpoints

**Dependencies**: FoldersService, Guards

**Context**: All folder endpoints

---

### **36. Embeddings Controller**

**File**: `controllers/embeddings.controller.ts`

**Purpose**: Vector search, embedding stats

**Dependencies**: VectorSearchService

**Context**: Search endpoint + stats

---

## **PHASE 9: Module Assembly**

### **37. Documents Module**

**File**: `documents.module.ts`

**Purpose**: Wire everything together

**Context**: Import all services, controllers, providers

---

**Ready to start with File #2 (Text Chunker)? That's our first implementation file!**
