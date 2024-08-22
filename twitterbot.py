import os
import time
import tweepy
from openai import OpenAI
import requests
from io import BytesIO
from PIL import Image
from datetime import datetime, timedelta

# Load API keys from environment variables
# These keys are essential for authenticating with the OpenAI and Twitter APIs
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
twitter_client_id = os.getenv('TWITTER_CLIENT_ID')
twitter_client_secret = os.getenv('TWITTER_CLIENT_SECRET')

# Twitter API v2 authentication
# This client is used for most Twitter operations like tweeting and reading mentions
client = tweepy.Client(
    consumer_key=twitter_client_id,
    consumer_secret=twitter_client_secret,
    access_token=os.getenv('TWITTER_ACCESS_TOKEN'),
    access_token_secret=os.getenv('TWITTER_ACCESS_TOKEN_SECRET')
)

# Twitter API v1.1 authentication for media upload
# This is necessary because media upload is not yet supported in the v2 API
auth = tweepy.OAuthHandler(twitter_client_id, twitter_client_secret)
auth.set_access_token(os.getenv('TWITTER_ACCESS_TOKEN'), os.getenv('TWITTER_ACCESS_TOKEN_SECRET'))
api = tweepy.API(auth)

def generate_image():
    """
    Generate an interesting image using OpenAI's DALL-E.

    This function sends a prompt to the DALL-E API and retrieves a URL
    for the generated image using the new threads API.

    Returns:
        str: URL of the generated image
    """
    prompt = "An abstract, colorful representation of artificial intelligence and creativity"

    # Create a new thread
    thread = client.beta.threads.create()

    # Add a message to the thread
    client.beta.threads.messages.create(
        thread_id=thread.id,
        role="user",
        content=f"Generate an image with the following prompt: {prompt}"
    )

    # Run the assistant
    run = client.beta.threads.runs.create(
        thread_id=thread.id,
        assistant_id="asst_your_image_assistant_id_here",  # Replace with your actual image generation assistant ID
        instructions="Generate an image based on the given prompt."
    )

    # Wait for the run to complete
    while run.status != "completed":
        run = client.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)

    # Retrieve the assistant's messages
    messages = client.beta.threads.messages.list(thread_id=thread.id)

    # Extract the image URL from the assistant's reply
    image_url = next((msg.content[0].image_file.file_id for msg in messages if msg.role == "assistant" and msg.content[0].type == "image_file"), None)

    if image_url is None:
        raise Exception("No image was generated")

    return image_url

def post_image_to_twitter(image_url):
    """
    Post the generated image to Twitter.

    This function downloads the image from the provided URL,
    saves it temporarily, uploads it to Twitter, creates a tweet
    with the image, and then removes the temporary file.

    Args:
        image_url (str): URL of the image to be posted

    Returns:
        tweepy.Response: The response from the create_tweet API call
    """
    # Download the image
    response = requests.get(image_url)
    img = Image.open(BytesIO(response.content))

    # Save the image temporarily
    img.save("temp_image.png")

    # Upload the image and post the tweet
    media = api.media_upload("temp_image.png")
    tweet = client.create_tweet(text="Here's an AI-generated image for your viewing pleasure!", media_ids=[media.media_id])

    # Remove the temporary image file
    os.remove("temp_image.png")

    return tweet

def respond_to_messages():
    """
    Respond to user messages (mentions) on Twitter.

    This function retrieves recent mentions, checks if we've already
    replied to them, generates a response using the OpenAI assistant if we haven't,
    and posts the reply.
    """
    # Get recent messages (mentions)
    mentions = client.get_users_mentions(id=client.get_me().data.id)

    for mention in mentions.data:
        # Check if we've already replied to this mention
        if not has_replied(mention.id):
            # Create a new thread
            thread = client.beta.threads.create()

            # Add the mention to the thread
            client.beta.threads.messages.create(
                thread_id=thread.id,
                role="user",
                content=f"Respond to this tweet: {mention.text}"
            )

            # Run the assistant
            run = client.beta.threads.runs.create(
                thread_id=thread.id,
                assistant_id="asst_your_assistant_id_here",  # Replace with your actual assistant ID
                instructions="Please provide a concise and engaging response to the tweet."
            )

            # Wait for the run to complete
            while run.status != "completed":
                run = client.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)

            # Retrieve the assistant's messages
            messages = client.beta.threads.messages.list(thread_id=thread.id)

            # Extract the assistant's reply
            ai_reply = next((msg.content[0].text.value for msg in messages if msg.role == "assistant"), None)

            if ai_reply:
                # Reply to the mention
                client.create_tweet(
                    text=ai_reply[:280],  # Truncate to Twitter's character limit
                    in_reply_to_tweet_id=mention.id
                )

                # Mark as replied
                mark_as_replied(mention.id)

def has_replied(tweet_id):
    """
    Check if we've already replied to a tweet.

    Args:
        tweet_id (int): The ID of the tweet to check

    Returns:
        bool: True if we've replied, False otherwise

    Note: This is a placeholder implementation. In a real-world scenario,
    you would implement this using a database or file to keep track of
    replied tweets.
    """
    # Implement a method to check if we've replied (e.g., using a database or file)
    return False  # Placeholder

def mark_as_replied(tweet_id):
    """
    Mark a tweet as replied.

    Args:
        tweet_id (int): The ID of the tweet to mark as replied

    Note: This is a placeholder implementation. In a real-world scenario,
    you would implement this using a database or file to keep track of
    replied tweets.
    """
    # Implement a method to mark a tweet as replied (e.g., using a database or file)
    pass  # Placeholder

def main():
    """
    Main function to run the Twitter bot.

    This function runs in an infinite loop, generating and posting
    an image every hour, and responding to messages. It includes
    error handling to ensure the bot continues running even if an
    error occurs.
    """
    while True:
        try:
            # Generate and post an image
            image_url = generate_image()
            post_image_to_twitter(image_url)

            # Respond to messages
            respond_to_messages()

            # Wait for an hour before the next post
            time.sleep(3600)
        except Exception as e:
            print(f"An error occurred: {e}")
            time.sleep(300)  # Wait for 5 minutes before retrying

if __name__ == "__main__":
    main()
