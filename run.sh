#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  set -a
  source <(grep -v '^#' .env | sed -e '/^$/d')
  set +a
else
  echo ".env file not found. Please create one with your OpenAI API key."
  exit 1
fi

# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate

# Install the required dependencies
pip install -r requirements.txt

# Run the Flask app
export FLASK_APP=app.py
flask run