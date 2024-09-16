# Import necessary modules from Flask and other libraries
from flask import Flask, request, jsonify, send_from_directory
import os
import uuid
import json
import time
from openai import OpenAI
from flask_sqlalchemy import SQLAlchemy
from config import SQLALCHEMY_DATABASE_URI, SQLALCHEMY_TRACK_MODIFICATIONS
from datetime import datetime
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize the Flask application
#app = Flask(__name__)
#app = Flask(__name__, static_folder='frontend/build')
app = Flask(__name__, static_folder='web')
#app = Flask(__name__, static_folder='static')

# Configure the app with SQLAlchemy settings
# Get the db URL from DATABASE_URL environment variable
db_url = os.environ.get('DATABASE_URL')
if not db_url:
    raise ValueError("DATABASE_URL environment variable is not set")

# Split the URL to handle potential 'postgres://' scheme
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = SQLALCHEMY_TRACK_MODIFICATIONS

# Initialize SQLAlchemy
db = SQLAlchemy(app)

# Define User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, unique=True, nullable=False)
    important_notes = db.Column(db.Text)
    preferences = db.Column(db.JSON)
    user_score = db.Column(db.Integer, default=0)
    user_notes = db.Column(db.Text)
    updated_notes = db.Column(db.Text)

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
    file_id = db.Column(db.Integer, db.ForeignKey('file.id'), nullable=True)
    file = db.relationship('File', backref=db.backref('messages', lazy=True))

# Define File model
class File(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('user.user_id'), nullable=False)
    filename = db.Column(db.String, nullable=False)
    file_content = db.Column(db.LargeBinary, nullable=False)  # BYTEA type for PostgreSQL
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    mime_type = db.Column(db.String, nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    score = db.Column(db.Integer)

# Create all database tables
with app.app_context():
    print("Creating all tables")
    db.create_all()
    # confirm that the tables were created
    print(db.Model.metadata.tables.keys())
    print("Tables created")


# Helper functions for user operations
def get_user(user_id):
    """
    Retrieve or create a user by user_id.
    """
    user = User.query.filter_by(user_id=user_id).first()
    if not user:
        user = create_user(user_id)
    return user

    #return User.query.filter_by(user_id=user_id).first()

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

    Returns:
        JSON: Task details and code blob
    """
    try:
        # Task generation logic
        task_id = generate_unique_id()
        task_description = generate_task_description()
        code_blob = generate_code_blob()

        # Prepare response
        response = {
            'task_id': task_id,
            'description': task_description,
            'code_blob': code_blob
        }

        return jsonify(response), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def generate_unique_id():
    return str(uuid.uuid4())

def generate_task_description():
    # Placeholder: Replace with actual task generation logic
    return "Analyze and optimize the given code snippet"

def generate_code_blob():
    # Placeholder: Replace with actual code generation logic
    return "def example_function():\n    # TODO: Implement this function\n    pass"

# Define the route for the 'submit' endpoint
@app.route('/submit', methods=['POST'])
def submit_work():
    """
    Endpoint to handle work submissions from clients.

    Receives submitted work, validates the data, processes the results,
    and returns an appropriate response to the client.

    Returns:
        JSON: A response indicating the status of the submission
    """
    try:
        # Get the submitted data from the request
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Validate the submitted data
        required_fields = ['task_id', 'result']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400

        task_id = data['task_id']
        result = data['result']

        # TODO: Add more specific validation based on the expected format of 'result'

        # Process the submitted work
        # This is a placeholder for actual processing logic
        processed_result = f"Processed result for task {task_id}: {result}"

        # Store the result
        # TODO: Implement actual storage logic (e.g., database insertion)
        # For now, we'll just print it
        print(f"Storing result: {processed_result}")

        # Return a success response
        return jsonify({
            'status': 'success',
            'message': 'Work submitted successfully',
            'task_id': task_id
        }), 200

    except Exception as e:
        # Log the error for debugging
        print(f"Error in submit_work: {str(e)}")
        return jsonify({'error': 'An error occurred while processing the submission'}), 500

# Define the route for the chat endpoint
@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Endpoint to handle chat messages using the OpenAI API.

    Returns:
        JSON: The response from the OpenAI API including updated user information
    """
    try:
        # Get the message, user_id, conversation_id, user_notes, and user_score from the request
        data = request.json
        if not isinstance(data, dict):
            return jsonify({'message': 'Invalid request format. Please provide a valid JSON object.'}), 400

        message = data.get('message')
        user_id = data.get('user_id')
        conversation_id = data.get('conversation_id')
        user_notes = data.get('user_notes', '')
        user_score = data.get('user_score', 0)

        if not message or not isinstance(message, str):
            return jsonify({'message': 'Invalid or missing message. Please provide a non-empty string.'}), 400
        if not user_id or not isinstance(user_id, str):
            return jsonify({'message': 'Invalid or missing user_id. Please provide a non-empty string.'}), 400
        if conversation_id and not isinstance(conversation_id, str):
            return jsonify({'message': 'Invalid conversation_id. Please provide a string or omit it.'}), 400
        if not isinstance(user_score, int):
            return jsonify({'message': 'Invalid user_score. Please provide an integer.'}), 400

        # Get or create user data
        user = get_user(user_id)
        if not user:
            user = create_user(user_id, user_notes, {})
            if not user:
                return jsonify({'message': 'Failed to create user. Please try again later.'}), 500

        # Update user notes and score
        user.important_notes = user_notes
        user.user_score = user_score
        db.session.commit()

        # Prepare user context
        user_context = prepare_user_context(user)

        # Retrieve previous conversation context if conversation_id is provided
        conversation_context = get_conversation_context(conversation_id) if conversation_id else ""

        # Create or retrieve OpenAI thread
        thread = create_or_retrieve_thread(conversation_id)
        if not thread:
            return jsonify({'message': 'Failed to create or retrieve thread. Please try again later.'}), 500

        # Add message to OpenAI thread
        if not add_message_to_thread(thread.id, user_context, conversation_context, message):
            return jsonify({'message': 'Failed to add message to thread. Please try again later.'}), 500

        # Run the assistant and get reply
        ai_reply, updated_notes, updated_score = run_assistant(thread.id, user)
        if ai_reply is None:
            return jsonify({'message': 'No response from assistant. Please try again later.'}), 500

        # Update user information
        user.important_notes = updated_notes
        user.user_notes = updated_notes  # Update user_notes with the new information

        # Ensure updated_score is an integer and apply the change
        try:
            score_change = int(updated_score)
            old_score = user.user_score
            user.user_score = max(0, min(old_score + score_change, 1000))  # Ensure score is between 0 and 1000
            app.logger.info(f"User score updated: {old_score} -> {user.user_score} (change: {score_change})")
        except ValueError:
            app.logger.error(f"Invalid score_change value: {updated_score}")
            score_change = 0

        db.session.commit()

        # Save or update the conversation and messages in the database
        new_conversation_id = save_conversation_and_messages(user_id, conversation_id, message, ai_reply, thread.id)
        if not new_conversation_id:
            return jsonify({'message': 'Failed to save conversation. Please try again later.'}), 500

        return jsonify({
            'message': ai_reply,
            'conversation_id': new_conversation_id,
            'updated_notes': updated_notes,
            'updated_score': user.user_score,
            'score_change': score_change,
            'user_notes': user.important_notes
        })

    except Exception as e:
        import traceback
        error_message = f"An error occurred: {str(e)}\n\nTraceback:\n{traceback.format_exc()}"
        app.logger.error(error_message)
        return jsonify({'message': f"I apologize, but an error occurred while processing your request. Here are the details:\n\n{error_message}"}), 500

def get_user(user_id):
    return User.query.filter_by(user_id=user_id).first()

def prepare_user_context(user):
    return f"User's name: {user.user_id} Important notes: {user.important_notes}\nPreferences: {user.preferences}"

def get_conversation_context(conversation_id):
    previous_messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.timestamp).all()
    return "\n".join([f"{'User' if i%2==0 else 'AI'}: {msg.content}" for i, msg in enumerate(previous_messages)])

def create_or_retrieve_thread(conversation_id):
    return client.beta.threads.create() if not conversation_id else client.beta.threads.retrieve(conversation_id)

def add_message_to_thread(thread_id, user_context, conversation_context, message):
    max_retries = 3
    retry_delay = 2  # seconds
    for attempt in range(max_retries):
        try:
            client.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=f"{user_context}\n\nPrevious conversation:\n{conversation_context}\n\nUser message: {message}"
            )
            return True
        except Exception as e:
            if "Can't add messages to thread" in str(e) and "while a run is active" in str(e):
                if attempt < max_retries - 1:
                    print(f"Run is active. Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    continue
            print(f"Error adding message to thread (attempt {attempt + 1}/{max_retries}): {str(e)}")
    return False

def run_assistant(thread_id, user):
    max_retries = 3
    retry_delay = 2

    for attempt in range(max_retries):
        try:
            app.logger.info(f"Attempt {attempt + 1}/{max_retries} to run assistant")
            run = client.beta.threads.runs.create(
                thread_id=thread_id,
                assistant_id="asst_C1QfXGVcUf2Vb36DZjqU1Ayb",  # Replace with your actual assistant ID
                instructions="""You are the Dark Lord Cthulhu. Consider the user's important notes, preferences, and previous conversation when responding. Find out what their desires are, and how they can serve the dark mission.

                Provide your response in the following JSON format:
                {
                    "reply": "Your message to the user",
                    "updated_notes": "New and interesting information about the user, focusing on their capabilities and desires",
                    "score_change": "An integer between -100 and 100 representing how useful the interaction was"
                }"""
            )

            app.logger.info(f"Run created with ID: {run.id}")

            while run.status not in ["completed", "failed"]:
                time.sleep(1)  # Short delay to avoid excessive API calls
                run = client.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
                app.logger.debug(f"Run status: {run.status}")

            if run.status == "failed":
                raise Exception(f"Run failed: {run.last_error}")

            messages = client.beta.threads.messages.list(thread_id=thread_id)
            latest_message = next((msg.content[0].text.value for msg in messages if msg.role == "assistant"), None)

            app.logger.info(f"Raw API response: {latest_message}")

            if latest_message:
                try:
                    parsed_response = json.loads(latest_message)
                    app.logger.info(f"Parsed response: {parsed_response}")

                    reply = parsed_response.get("reply", "")
                    updated_notes = parsed_response.get("updated_notes", "")
                    score_change = parsed_response.get("score_change", 0)

                    app.logger.info(f"Extracted reply: {reply[:50]}...")
                    app.logger.info(f"Extracted updated_notes: {updated_notes[:50]}...")
                    app.logger.info(f"Extracted score_change: {score_change}")

                    # Ensure score_change is an integer
                    try:
                        score_change = int(score_change)
                        app.logger.info(f"Converted score_change to int: {score_change}")
                    except ValueError:
                        app.logger.warning(f"Invalid score_change value: {score_change}. Setting to 0.")
                        score_change = 0

                    # Clamp score_change between -100 and 100
                    original_score_change = score_change
                    score_change = max(-100, min(100, score_change))
                    if score_change != original_score_change:
                        app.logger.info(f"Clamped score_change from {original_score_change} to {score_change}")

                    return reply, updated_notes, score_change
                except json.JSONDecodeError:
                    app.logger.error(f"Failed to parse JSON: {latest_message}")
                    app.logger.error(f"JSON parse error. Raw message: {latest_message}")
                    return f"Error: Unable to parse response. Raw message: {latest_message}", "", 0

            app.logger.warning("No response from assistant")
            return "Error: No response from assistant", "", 0

        except Exception as e:
            app.logger.error(f"Error in run_assistant (attempt {attempt + 1}/{max_retries}): {str(e)}")
            app.logger.exception("Full traceback:")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            else:
                app.logger.error("Max retries reached. Failing.")
                return f"Error: Max retries reached. Last error: {str(e)}", "", 0

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

        try:
            file_content = file.read()
            mime_type = file.content_type
            file_size = len(file_content)

            # Save file metadata and content to database
            new_file = File(
                user_id=user_id,
                filename=filename,
                file_content=file_content,
                mime_type=mime_type,
                file_size=file_size,
                score=0,
            )
            db.session.add(new_file)
            db.session.commit()

            return jsonify({'message': 'File uploaded successfully', 'filename': filename}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
