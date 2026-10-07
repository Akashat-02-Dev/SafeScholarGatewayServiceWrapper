import urllib.parse
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import get_settings

settings = get_settings()

def _prepare_asyncpg_connection(raw_url: str):
    if raw_url.startswith("postgres://"):
        raw_url = "postgresql+asyncpg://" + raw_url[len("postgres://"):]
    elif raw_url.startswith("postgresql://") and not raw_url.startswith("postgresql+asyncpg://"):
        raw_url = "postgresql+asyncpg://" + raw_url[len("postgresql://"):]

    parsed = urllib.parse.urlparse(raw_url)
    query_params = urllib.parse.parse_qs(parsed.query)

    is_remote = parsed.hostname not in ("localhost", "127.0.0.1", "postgres", None)
    use_ssl = "sslmode" in query_params or "ssl" in query_params or is_remote

    query_params.pop("sslmode", None)
    query_params.pop("ssl", None)

    new_query = urllib.parse.urlencode({k: v[0] for k, v in query_params.items()})
    clean_url = urllib.parse.urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))

    connect_args = {}
    if use_ssl and is_remote:
        connect_args["ssl"] = "require"
        # statement_cache_size=0 ensures compatibility with Supabase PgBouncer (pooler) & direct connections
        connect_args["statement_cache_size"] = 0

    return clean_url, connect_args

db_url, db_connect_args = _prepare_asyncpg_connection(settings.get_database_url)

# Establishes connection pool to the database
engine = create_async_engine(
    db_url,
    echo=False,
    pool_size=10,
    max_overflow=20,
    connect_args=db_connect_args
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db_session() -> AsyncSession:
    """Dependency injection for FastAPI endpoints"""
    async with AsyncSessionLocal() as session:
        yield session
