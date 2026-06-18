"""add pgvector hnsw index when available

Revision ID: 0002_pgvector_hnsw_index
Revises: 0001_initial_schema
Create Date: 2026-05-25
"""
from alembic import op

revision = "0002_pgvector_hnsw_index"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
               AND to_regclass('document_chunks') IS NOT NULL
               AND EXISTS (
                   SELECT 1
                   FROM information_schema.columns
                   WHERE table_name = 'document_chunks'
                     AND column_name = 'embedding_vector'
               ) THEN
                BEGIN
                    EXECUTE '
                        CREATE INDEX IF NOT EXISTS ix_document_chunks_embedding_vector_hnsw
                        ON document_chunks
                        USING hnsw (embedding_vector vector_cosine_ops)
                        WHERE is_active = true AND embedding_vector IS NOT NULL
                    ';
                EXCEPTION
                    WHEN undefined_object OR feature_not_supported OR datatype_mismatch THEN
                        RAISE NOTICE 'Skipping pgvector HNSW index; vector index support is unavailable or incompatible.';
                END;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_document_chunks_embedding_vector_hnsw")
