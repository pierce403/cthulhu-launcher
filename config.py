import os
from urllib.parse import urlparse

# Set SQLite as the default database
DEFAULT_DATABASE_URL = 'sqlite:///app.db'

# Get the DATABASE_URL from environment variables, use SQLite as default
database_url = os.getenv('DATABASE_URL', DEFAULT_DATABASE_URL)

# If it's not SQLite, log a warning
if not database_url.startswith('sqlite:'):
    print("Warning: Non-SQLite database detected. This application is configured to work best with SQLite.")

SQLALCHEMY_DATABASE_URI = database_url
SQLALCHEMY_TRACK_MODIFICATIONS = False

# JSON serialization for SQLite
if database_url.startswith('sqlite:'):
    from sqlalchemy.engine import Engine
    from sqlalchemy import event

    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    # For non-SQLite databases, define an empty function
    def set_sqlite_pragma(dbapi_connection, connection_record):
        pass

# Ensure the SQLite database file exists
if database_url.startswith('sqlite:'):
    db_path = database_url.replace('sqlite:///', '')
    if not os.path.exists(db_path):
        open(db_path, 'a').close()
        print(f"Created SQLite database file: {db_path}")
