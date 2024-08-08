import os
import time
import tweepy
import openai
import requests
from io import BytesIO
from PIL import Image
from datetime import datetime, timedelta

# Load API keys from environment variables
# These keys are essential for authenticating with the OpenAI and Twitter APIs
openai.api_key = os.getenv('OPENAI_API_KEY')
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
    for the generated image.

    Returns:
        str: URL of the generated image
    """
    prompt = "An abstract, colorful representation of artificial intelligence and creativity"
    response = openai.Image.create(prompt=prompt, n=1, size="1024x1024")
    image_url = response['data'][0]['url']
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
    replied to them, generates a response using GPT-3 if we haven't,
    and posts the reply.
    """
    # Get recent messages (mentions)
    mentions = client.get_users_mentions(id=client.get_me().data.id)

    for mention in mentions.data:
        # Check if we've already replied to this mention
        if not has_replied(mention.id):
            # Generate a response using OpenAI's GPT
            response = openai.Completion.create(
                engine="text-davinci-002",
                prompt=f"Respond to this tweet: {mention.text}",
                max_tokens=60
            )

            # Reply to the mention
            client.create_tweet(
                text=response.choices[0].text.strip(),
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
