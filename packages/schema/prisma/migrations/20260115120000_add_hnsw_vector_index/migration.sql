-- Add HNSW index for fast vector similarity search on embeddings
CREATE INDEX IF NOT EXISTS embedding_vector_hnsw_idx
ON documents."Embedding"
USING hnsw (vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
