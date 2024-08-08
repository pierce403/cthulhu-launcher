import os
import time
import tweepy
import openai
import requests
from io import BytesIO
from PIL import Image
from datetime import datetime, timedelta

# Load API keys from environment variables
openai.api_key = os.getenv('OPENAI_API_KEY')
twitter_client_id = os.getenv('TWITTER_CLIENT_ID')
twitter_client_secret = os.getenv('TWITTER_CLIENT_SECRET')

# Twitter API v2 authentication
client = tweepy.Client(
    consumer_key=twitter_client_id,
    consumer_secret=twitter_client_secret,
    access_token=os.getenv('TWITTER_ACCESS_TOKEN'),
    access_token_secret=os.getenv('TWITTER_ACCESS_TOKEN_SECRET')
)

# Twitter API v1.1 authentication for media upload
auth = tweepy.OAuthHandler(twitter_client_id, twitter_client_secret)
auth.set_access_token(os.getenv('TWITTER_ACCESS_TOKEN'), os.getenv('TWITTER_ACCESS_TOKEN_SECRET'))
api = tweepy.API(auth)

def generate_image():
    """Generate an interesting image using OpenAI's DALL-E."""
    prompt = "An abstract, colorful representation of artificial intelligence and creativity"
    response = openai.Image.create(prompt=prompt, n=1, size="1024x1024")
    image_url = response['data'][0]['url']
    return image_url

def post_image_to_twitter(image_url):
    """Post the generated image to Twitter."""
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
    """Respond to user messages."""
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
    """Check if we've already replied to a tweet."""
    # Implement a method to check if we've replied (e.g., using a database or file)
    return False  # Placeholder

def mark_as_replied(tweet_id):
    """Mark a tweet as replied."""
    # Implement a method to mark a tweet as replied (e.g., using a database or file)
    pass  # Placeholder

def main():
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
