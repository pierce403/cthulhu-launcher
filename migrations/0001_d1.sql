CREATE TABLE "user" (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT UNIQUE NOT NULL,
 user_score INTEGER DEFAULT 0,
 user_notes TEXT
);
CREATE TABLE conversation (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 conversation_id TEXT UNIQUE NOT NULL,
 user_id TEXT NOT NULL REFERENCES "user"(user_id),
 created_at TEXT
);
CREATE TABLE file (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL REFERENCES "user"(user_id),
 filename TEXT NOT NULL,
 file_key TEXT UNIQUE NOT NULL,
 upload_date TEXT,
 mime_type TEXT NOT NULL,
 file_size INTEGER NOT NULL,
 score INTEGER,
 openai_file_id TEXT
);
CREATE TABLE message (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 conversation_id TEXT NOT NULL REFERENCES conversation(conversation_id),
 content TEXT NOT NULL,
 timestamp TEXT,
 file_id INTEGER REFERENCES file(id)
);
