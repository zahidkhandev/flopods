/**
 * Document Vector Search Service
 *
 * @description Semantic search across document embeddings using pgvector.
 * Implements cosine similarity search with filters and ranking.
 *
 * @module v1/documents/services/vector-search
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { DocumentVectorSearchResult, GEMINI_EMBEDDING_PROVIDER } from '../types';

/**
 * Document vector search service
 */
@Injectable()
export class V1DocumentVectorSearchService {
  private readonly logger = new Logger(V1DocumentVectorSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Search documents using semantic similarity
   *
   * @param query - Search query text
   * @param workspaceId - Workspace ID to search within
   * @param options - Search options
   * @returns Array of search results with similarity scores
   */
  async searchDocuments(
    query: string,
    workspaceId: string,
    options: {
      documentIds?: string[];
      folderId?: string;
      topK?: number;
      minSimilarity?: number;
    } = {},
  ): Promise<DocumentVectorSearchResult[]> {
    const { documentIds, folderId, topK = 5, minSimilarity = 0.7 } = options;

    this.logger.log(`[Vector Search] Query: "${query}" (workspace: ${workspaceId})`);

    // Generate query embedding
    const queryEmbedding = await this.generateQueryEmbedding(query, workspaceId);

    // Build SQL query with filters
    const documentFilter = documentIds?.length
      ? this.prisma.$queryRaw`AND d.id = ANY(${documentIds}::text[])`
      : this.prisma.$queryRaw``;

    const folderFilter = folderId
      ? this.prisma.$queryRaw`AND d."folderId" = ${folderId}`
      : this.prisma.$queryRaw``;

    // Perform vector similarity search using pgvector
    const results = await this.prisma.$queryRaw<
      Array<{
        embedding_id: string;
        document_id: string;
        document_name: string;
        chunk_index: number;
        chunk_text: string;
        similarity: number;
        document_metadata: any;
      }>
    >`
      SELECT
        e.id as embedding_id,
        d.id as document_id,
        d.name as document_name,
        e."chunkIndex" as chunk_index,
        e."chunkText" as chunk_text,
        1 - (e.vector <=> ${`[${queryEmbedding.join(',')}]`}::vector(768)) as similarity,
        d.metadata as document_metadata
      FROM documents."Embedding" e
      INNER JOIN documents."Document" d ON e."documentId" = d.id
      WHERE d."workspaceId" = ${workspaceId}
        AND d.status = 'READY'
        ${documentFilter}
        ${folderFilter}
        AND 1 - (e.vector <=> ${`[${queryEmbedding.join(',')}]`}::vector(768)) >= ${minSimilarity}
      ORDER BY e.vector <=> ${`[${queryEmbedding.join(',')}]`}::vector(768)
      LIMIT ${topK}
    `;

    const searchResults: DocumentVectorSearchResult[] = results.map((row) => ({
      embeddingId: row.embedding_id,
      documentId: row.document_id,
      documentName: row.document_name,
      chunkIndex: row.chunk_index,
      chunkText: row.chunk_text,
      similarity: Number(row.similarity.toFixed(4)),
      documentMetadata: row.document_metadata || {},
    }));

    this.logger.log(
      `[Vector Search] Found ${searchResults.length} results (min similarity: ${minSimilarity})`,
    );

    return searchResults;
  }

  /**
   * Generate embedding for search query
   */
  private async generateQueryEmbedding(query: string, workspaceId: string): Promise<number[]> {
    // Check for workspace's own Gemini key
    const workspaceApiKey = await this.prisma.providerAPIKey.findFirst({
      where: {
        workspaceId,
        provider: 'GOOGLE_GEMINI',
        isActive: true,
      },
    });

    const apiKey = workspaceApiKey?.keyHash
      ? this.configService.get<string>('GEMINI_API_KEY')! // Use decryption in prod
      : this.configService.get<string>('GEMINI_API_KEY')!;

    if (!apiKey) {
      throw new BadRequestException('Gemini API key not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_EMBEDDING_PROVIDER.model });

    const result = await model.embedContent(query);
    return result.embedding.values;
  }
}
