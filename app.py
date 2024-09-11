# Import necessary modules from Flask and other libraries
from flask import Flask, request, jsonify, send_from_directory
import os
from openai import OpenAI
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from config import SQLALCHEMY_DATABASE_URI, SQLALCHEMY_TRACK_MODIFICATIONS
from datetime import datetime
import boto3
from werkzeug.utils import secure_filename

# Initialize the Flask application
#app = Flask(__name__)
#app = Flask(__name__, static_folder='frontend/build')
app = Flask(__name__, static_folder='static')

# Configure the app with SQLAlchemy settings
app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = SQLALCHEMY_TRACK_MODIFICATIONS

# Initialize SQLAlchemy
db = SQLAlchemy(app)

# Initialize Flask-Migrate
migrate = Migrate(app, db)

# Define User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, unique=True, nullable=False)
    important_notes = db.Column(db.Text)
    preferences = db.Column(db.JSON)

# Define Conversation model
class Conversation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.String, unique=True, nullable=False)
    user_id = db.Column(db.String, db.ForeignKey('user.user_id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Define Message model
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.String, db.ForeignKey('conversation.conversation_id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# Define UserFiles model
class UserFiles(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('user.user_id'), nullable=False)
    filename = db.Column(db.String, nullable=False)
    s3_key = db.Column(db.String, nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)

# Helper functions for user operations
def get_user(user_id):
    """
    Retrieve a user by user_id.
    """
    return User.query.filter_by(user_id=user_id).first()

def create_user(user_id, important_notes="", preferences=None):
    """
    Create a new user.
    """
    user = User(user_id=user_id, important_notes=important_notes, preferences=preferences or {})
    db.session.add(user)
    db.session.commit()
    return user

# Helper functions for conversation operations
def get_conversation(conversation_id):
    """
    Retrieve a full conversation by conversation_id, sorting messages by timestamp.
    """
    conversation = Conversation.query.filter_by(conversation_id=conversation_id).first()
    if not conversation:
        return None
    messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.timestamp).all()
    return {
        'conversation_id': conversation.conversation_id,
        'user_id': conversation.user_id,
        'created_at': conversation.created_at,
        'messages': [{'content': msg.content, 'timestamp': msg.timestamp} for msg in messages]
    }

def create_conversation(user_id, conversation_id):
    """
    Create a new conversation.
    """
    conversation = Conversation(conversation_id=conversation_id, user_id=user_id)
    db.session.add(conversation)
    db.session.commit()
    return conversation

# Helper functions for message operations
def add_message(conversation_id, content):
    """
    Add a new message to a conversation.
    """
    message = Message(conversation_id=conversation_id, content=content)
    db.session.add(message)
    db.session.commit()
    return message

# Set up OpenAI client
client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

# Define the route for the 'getwork' endpoint
@app.route('/getwork', methods=['GET'])
def get_work():
    """
    Endpoint to generate and return a task for processing.

    TODO:
    - Implement task generation logic
    - Create code blob for the generated task
    - Return task details and code as JSON

    Returns:
        str: Placeholder message (to be replaced with actual implementation)
    """
    return 'This will be the getwork endpoint.'

# Define the route for the 'submit' endpoint
@app.route('/submit', methods=['POST'])
def submit_work():
    """
    Endpoint to handle work submissions from clients.

    TODO:
    - Implement logic to receive and process submitted work
    - Validate the submitted data
    - Store or further process the results
    - Return appropriate response to the client

    Returns:
        str: Placeholder message (to be replaced with actual implementation)
    """
    return 'This will be the submit endpoint.'

# Define the route for the chat endpoint
@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Endpoint to handle chat messages using the OpenAI API.

    Returns:
        JSON: The response from the OpenAI API
    """
    try:
        # Get the message, user_id, and conversation_id from the request
        data = request.json
        message = data.get('message')
        user_id = data.get('user_id')
        conversation_id = data.get('conversation_id')

        if not message or not user_id:
            return jsonify({'error': 'No message or user_id provided'}), 400

        # Get user data
        user = get_user(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Prepare user context
        user_context = prepare_user_context(user)

        # Retrieve previous conversation context if conversation_id is provided
        conversation_context = get_conversation_context(conversation_id) if conversation_id else ""

        # Create or retrieve OpenAI thread
        thread = create_or_retrieve_thread(conversation_id)

        # Add message to OpenAI thread
        add_message_to_thread(thread.id, user_context, conversation_context, message)

        # Run the assistant and get reply
        ai_reply = run_assistant(thread.id)

        if ai_reply is None:
            return jsonify({'error': 'No response from assistant'}), 500

        # Save or update the conversation and messages in the database
        conversation_id = save_conversation_and_messages(user_id, conversation_id, message, ai_reply, thread.id)

        return jsonify({'message': ai_reply, 'conversation_id': conversation_id})

    except Exception as e:
        print('Error: ' + str(e))
        return jsonify({'message': 'Error: ' + str(e)})

def get_user(user_id):
    return User.query.filter_by(user_id=user_id).first()

def prepare_user_context(user):
    return f"Important notes: {user.important_notes}\nPreferences: {user.preferences}"

def get_conversation_context(conversation_id):
    previous_messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.timestamp).all()
    return "\n".join([f"{'User' if i%2==0 else 'AI'}: {msg.content}" for i, msg in enumerate(previous_messages)])

def create_or_retrieve_thread(conversation_id):
    return client.beta.threads.create() if not conversation_id else client.beta.threads.retrieve(conversation_id)

def add_message_to_thread(thread_id, user_context, conversation_context, message):
    client.beta.threads.messages.create(
        thread_id=thread_id,
        role="user",
        content=f"{user_context}\n\nPrevious conversation:\n{conversation_context}\n\nUser message: {message}"
    )

def run_assistant(thread_id):
    run = client.beta.threads.runs.create(
        thread_id=thread_id,
        assistant_id="asst_C1QfXGVcUf2Vb36DZjqU1Ayb",  # Replace with your actual assistant ID
        instructions="Consider the user's important notes, preferences, and previous conversation when responding."
    )

    while run.status != "completed":
        run = client.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)

    messages = client.beta.threads.messages.list(thread_id=thread_id)
    return next((msg.content[0].text.value for msg in messages if msg.role == "assistant"), None)

def save_conversation_and_messages(user_id, conversation_id, user_message, ai_reply, thread_id):
    if not conversation_id:
        new_conversation = Conversation(conversation_id=str(thread_id), user_id=user_id)
        db.session.add(new_conversation)
        db.session.flush()  # Flush to get the new conversation ID
        conversation_id = new_conversation.conversation_id

    new_message = Message(conversation_id=conversation_id, content=user_message)
    db.session.add(new_message)

    ai_message = Message(conversation_id=conversation_id, content=ai_reply)
    db.session.add(ai_message)

    db.session.commit()
    return conversation_id

# Serve React App
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# Run the Flask application if this script is executed directly
if __name__ == '__main__':
    # Start the Flask development server with debug mode enabled
    app.run(debug=True)

# Initialize S3 client
s3 = boto3.client('s3',
    aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
    region_name=os.environ.get('AWS_REGION')
)

# File upload route
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        filename = secure_filename(file.filename)
        user_id = request.form.get('user_id')
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400

        # Generate a unique S3 key
        s3_key = f"user_files/{user_id}/{filename}"

        try:
            # Upload file to S3
            s3.upload_fileobj(file, os.environ.get('S3_BUCKET_NAME'), s3_key)

            # Save file metadata to database
            new_file = UserFiles(user_id=user_id, filename=filename, s3_key=s3_key)
            db.session.add(new_file)
            db.session.commit()

            return jsonify({'message': 'File uploaded successfully', 'filename': filename}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
