import os
from urllib.parse import urlparse

# Get the DATABASE_URL from environment variables
database_url = os.getenv('DATABASE_URL')

# Check if it's a PostgreSQL URL (Heroku-style)
if database_url and database_url.startswith('postgres://'):
    # Replace 'postgres://' with 'postgresql://' for SQLAlchemy compatibility
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

# If DATABASE_URL is not set, use SQLite as a fallback
if not database_url:
    database_url = 'sqlite:///app.db'

SQLALCHEMY_DATABASE_URI = database_url
SQLALCHEMY_TRACK_MODIFICATIONS = False



# JSON serialization for SQLite (if needed)
if database_url.startswith('sqlite'):
    from sqlalchemy.engine import Engine
    from sqlalchemy import event

    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
