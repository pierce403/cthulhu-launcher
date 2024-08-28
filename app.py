# Import necessary modules from Flask and other libraries
from flask import Flask, request, jsonify, send_from_directory
import os
from openai import OpenAI

# Initialize the Flask application
#app = Flask(__name__)
#app = Flask(__name__, static_folder='frontend/build')
app = Flask(__name__, static_folder='static')

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
        # Get the message from the request
        data = request.json
        message = data.get('message')

        if not message:
            return jsonify({'error': 'No message provided'}), 400

        # Create a new thread
        thread = client.beta.threads.create()

        # Add a message to the thread
        client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content=message
        )

        # Run the assistant
        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id="asst_C1QfXGVcUf2Vb36DZjqU1Ayb",  # Replace with your actual assistant ID
            #instructions="Please provide a helpful response."
        )

        # Wait for the run to complete
        while run.status != "completed":
            run = client.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)

        # Retrieve the assistant's messages
        messages = client.beta.threads.messages.list(thread_id=thread.id)

        # Extract the assistant's reply
        ai_reply = next((msg.content[0].text.value for msg in messages if msg.role == "assistant"), None)

        if ai_reply is None:
            return jsonify({'error': 'No response from assistant'}), 500

        return jsonify({'message': ai_reply})

    except Exception as e:
        #return jsonify({'error': str(e)}), 500
        # print the error to the console
        print('Error: ' + str(e))
        return jsonify({'message': 'Error: ' + str(e)})

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
