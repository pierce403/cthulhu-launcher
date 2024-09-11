import pytest
import io
from app import app, db, User, Conversation, Message, UserFiles
from unittest.mock import patch, MagicMock
from sqlalchemy.exc import IntegrityError

@pytest.fixture(scope='function')
def test_app():
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    return app

@pytest.fixture(scope='function')
def test_client(test_app):
    return test_app.test_client()

@pytest.fixture(scope='function')
def init_database(test_app):
    with test_app.app_context():
        db.create_all()
        yield db
        db.session.remove()
        db.drop_all()
        db.create_all()  # Recreate tables for the next test

@pytest.fixture(autouse=True)
def app_context(test_app):
    with test_app.app_context():
        yield

def test_get_user(init_database):
    # Create a test user
    user = User(user_id='test_user', important_notes='Test notes', preferences={'key': 'value'})
    db.session.add(user)
    db.session.commit()

    # Test get_user function
    from app import get_user
    retrieved_user = get_user('test_user')
    assert retrieved_user is not None
    assert retrieved_user.user_id == 'test_user'
    assert retrieved_user.important_notes == 'Test notes'
    assert retrieved_user.preferences == {'key': 'value'}

def test_create_user(init_database):
    from app import create_user
    new_user = create_user('new_user', important_notes='New user notes', preferences={'pref': 'test'})
    assert new_user is not None
    assert new_user.user_id == 'new_user'
    assert new_user.important_notes == 'New user notes'
    assert new_user.preferences == {'pref': 'test'}

def test_get_conversation(init_database):
    # Create a test user
    user = User(user_id='test_user')
    db.session.add(user)
    db.session.commit()

    try:
        # Create a test conversation
        conversation = Conversation(conversation_id='test_conv', user_id='test_user')
        db.session.add(conversation)
        db.session.commit()

        # Add messages to the conversation
        messages = [
            Message(conversation_id='test_conv', content='Hello'),
            Message(conversation_id='test_conv', content='Hi there')
        ]
        db.session.add_all(messages)
        db.session.commit()

        # Test get_conversation function
        from app import get_conversation
        retrieved_conv = get_conversation('test_conv')

        # Assertions
        assert retrieved_conv is not None, "Retrieved conversation is None"
        assert retrieved_conv['conversation_id'] == 'test_conv', f"Expected conversation_id 'test_conv', got {retrieved_conv['conversation_id']}"
        assert retrieved_conv['user_id'] == 'test_user', f"Expected user_id 'test_user', got {retrieved_conv['user_id']}"
        assert len(retrieved_conv['messages']) == 2, f"Expected 2 messages, got {len(retrieved_conv['messages'])}"

        # Check message contents
        assert retrieved_conv['messages'][0]['content'] == 'Hello', f"Expected first message 'Hello', got {retrieved_conv['messages'][0]['content']}"
        assert retrieved_conv['messages'][1]['content'] == 'Hi there', f"Expected second message 'Hi there', got {retrieved_conv['messages'][1]['content']}"

        # Check message order
        assert retrieved_conv['messages'][0]['timestamp'] < retrieved_conv['messages'][1]['timestamp'], "Messages are not in correct order"

    except Exception as e:
        pytest.fail(f"Test failed with error: {str(e)}")
    finally:
        # Clean up the database
        Message.query.delete()
        Conversation.query.delete()
        User.query.delete()
        db.session.commit()

def test_create_conversation(init_database):
    try:
        # Create a test user
        user = User(user_id='test_user')
        db.session.add(user)
        db.session.commit()

        # Verify the user was created successfully
        assert User.query.filter_by(user_id='test_user').first() is not None, "User was not created successfully"

        from app import create_conversation
        new_conv = create_conversation('test_user', 'new_conv')
        assert new_conv is not None, "Created conversation is None"
        assert new_conv.conversation_id == 'new_conv', f"Expected conversation_id 'new_conv', got {new_conv.conversation_id}"
        assert new_conv.user_id == 'test_user', f"Expected user_id 'test_user', got {new_conv.user_id}"

        # Verify the conversation was added to the database
        db.session.refresh(new_conv)
        assert Conversation.query.filter_by(conversation_id='new_conv').first() is not None, "Conversation was not added to the database"

    except IntegrityError as e:
        pytest.fail(f"IntegrityError: {str(e)}. This might be due to a foreign key constraint violation.")
    except Exception as e:
        pytest.fail(f"Test failed with error: {str(e)}")
    finally:
        # Clean up the database
        db.session.rollback()  # Rollback any failed transaction
        Conversation.query.filter_by(conversation_id='new_conv').delete()
        User.query.filter_by(user_id='test_user').delete()
        db.session.commit()

def test_add_message(init_database):
    try:
        # Create a test user
        user = User(user_id='test_user')
        db.session.add(user)
        db.session.commit()

        # Create a test conversation
        conversation = Conversation(conversation_id='test_conv', user_id='test_user')
        db.session.add(conversation)
        db.session.commit()

        from app import add_message
        new_message = add_message('test_conv', 'Test message content')
        assert new_message is not None
        assert new_message.conversation_id == 'test_conv'
        assert new_message.content == 'Test message content'

    finally:
        # Clean up the database
        Message.query.filter_by(conversation_id='test_conv').delete()
        Conversation.query.filter_by(conversation_id='test_conv').delete()
        User.query.filter_by(user_id='test_user').delete()
        db.session.commit()

@patch('app.client')
def test_chat_endpoint(mock_client, test_client, init_database):
    # Mock OpenAI client
    mock_thread = MagicMock()
    mock_thread.id = 'test_thread_id'
    mock_client.beta.threads.create.return_value = mock_thread
    mock_client.beta.threads.runs.create.return_value = MagicMock(status='completed')
    mock_messages = MagicMock()
    mock_messages.__iter__.return_value = [MagicMock(role='assistant', content=[MagicMock(text=MagicMock(value='AI response'))])]
    mock_client.beta.threads.messages.list.return_value = mock_messages

    # Create a test user
    user = User(user_id='test_user')
    db.session.add(user)
    db.session.commit()

    # Test chat endpoint
    response = test_client.post('/api/chat', json={
        'message': 'Hello, AI!',
        'user_id': 'test_user',
        'conversation_id': None
    })
    assert response.status_code == 200
    data = response.get_json()
    assert 'message' in data
    assert data['message'] == 'AI response'
    assert 'conversation_id' in data

# Add more tests as needed for other functions and edge cases

@pytest.fixture
def mock_s3_client():
    with patch('app.s3') as mock_s3:
        yield mock_s3

def test_upload_file_success(test_client, init_database, mock_s3_client):
    # Create a test user
    user = User(user_id='test_user')
    db.session.add(user)
    db.session.commit()

    # Mock file and form data
    file_content = b'Test file content'
    file = io.BytesIO(file_content)
    data = {
        'file': (file, 'test_file.txt'),
        'user_id': 'test_user'
    }

    # Mock S3 upload
    mock_s3_client.upload_fileobj.return_value = None

    # Test file upload
    response = test_client.post('/upload', data=data, content_type='multipart/form-data')
    assert response.status_code == 200
    assert 'File uploaded successfully' in response.get_json()['message']

    # Check database entry
    uploaded_file = UserFiles.query.filter_by(user_id='test_user', filename='test_file.txt').first()
    assert uploaded_file is not None
    assert uploaded_file.s3_key == 'user_files/test_user/test_file.txt'

def test_upload_file_no_file(test_client):
    response = test_client.post('/upload', data={}, content_type='multipart/form-data')
    assert response.status_code == 400
    assert 'No file part' in response.get_json()['error']

def test_upload_file_no_user_id(test_client):
    data = {
        'file': (io.BytesIO(b'Test content'), 'test.txt'),
    }
    response = test_client.post('/upload', data=data, content_type='multipart/form-data')
    assert response.status_code == 400
    assert 'User ID is required' in response.get_json()['error']

def test_upload_file_s3_error(test_client, init_database, mock_s3_client):
    # Create a test user
    user = User(user_id='test_user')
    db.session.add(user)
    db.session.commit()

    # Mock file and form data
    file_content = b'Test file content'
    file = io.BytesIO(file_content)
    data = {
        'file': (file, 'test_file.txt'),
        'user_id': 'test_user'
    }

    # Mock S3 upload error
    mock_s3_client.upload_fileobj.side_effect = Exception('S3 upload failed')

    # Test file upload with S3 error
    response = test_client.post('/upload', data=data, content_type='multipart/form-data')
    assert response.status_code == 500
    assert 'S3 upload failed' in response.get_json()['error']

    # Check that no database entry was created
    uploaded_file = UserFiles.query.filter_by(user_id='test_user', filename='test_file.txt').first()
    assert uploaded_file is None
