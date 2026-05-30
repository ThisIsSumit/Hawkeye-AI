-- HawkEye AI — PostgreSQL initialization
-- This runs once when the container first starts.
-- Prisma migrations handle the actual schema via: npm run db:push

-- Enable pgvector extension for Phase 5 RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Confirm DB is ready
SELECT 'HawkEye AI database initialized' AS status;
