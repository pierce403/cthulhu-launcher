# Cthulhu Launcher Documentation

## Overview
The Cthulhu Launcher project is an autonomous rogue AI system consisting of two main components: a Flask web application and a Twitter bot. The project aims to demonstrate advanced AI capabilities in task generation, work submission, and social media interaction.

## Flask App
The Flask app serves as the core of the Cthulhu Launcher, providing endpoints for task generation and work submission.

### Setup and Running
1. Ensure Python 3.7+ is installed on your system.
2. Install the required dependencies:
   ```
   pip install flask
   ```
3. Navigate to the project directory and run:
   ```
   python app.py
   ```
4. The app will start running on `http://localhost:5000`.

### Endpoints
1. `/getwork` (GET)
   - Generates a task and returns a code blob for processing.
   - Response: JSON object containing task details and code.

2. `/submit` (POST)
   - Accepts completed work submissions.
   - Request: JSON object with completed task data.
   - Response: Confirmation of submission receipt.

### Dependencies
- Flask

## Twitter Bot
The Twitter bot generates and posts interesting images on an hourly basis and responds to user messages.

### Setup and Running
1. Ensure Python 3.7+ is installed on your system.
2. Install the required dependencies:
   ```
   pip install tweepy openai
   ```
3. Set up environment variables for API keys:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `TWITTER_CLIENT_ID`: Your Twitter API client ID
   - `TWITTER_CLIENT_SECRET`: Your Twitter API client secret
4. Run the bot:
   ```
   python twitterbot.py
   ```

### Functionality
- Image Generation: Uses OpenAI's DALL-E to create unique images every hour.
- Twitter Posting: Automatically posts generated images to the configured Twitter account.
- User Interaction: Responds to user messages and mentions using GPT-3.

### Dependencies
- tweepy
- openai

## Testing
### Flask App
1. Run the Flask app as described in the setup section.
2. Use a tool like curl or Postman to send requests to the endpoints:
   ```
   curl http://localhost:5000/getwork
   curl -X POST -H "Content-Type: application/json" -d '{"task_id": "123", "result": "completed work"}' http://localhost:5000/submit
   ```

### Twitter Bot
1. Set up a test Twitter account and obtain API credentials.
2. Configure the bot with test credentials.
3. Run the bot and monitor its output and Twitter activity.
4. Send test messages to the bot's Twitter account to verify response functionality.

## Additional Notes
- Ensure all API keys and secrets are kept secure and not shared publicly.
- The Twitter bot runs continuously, so consider using a process manager like `supervisor` for production deployment.
- Regular monitoring of the bot's activity is recommended to ensure it's functioning as expected and to catch any potential issues early.
