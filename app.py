from flask import Flask, request

app = Flask(__name__)

@app.route('/getwork', methods=['GET'])
def get_work():
    # TODO: Implement task generation and code blob creation
    return 'This will be the getwork endpoint.'

@app.route('/submit', methods=['POST'])
def submit_work():
    # TODO: Implement work submission handling
    return 'This will be the submit endpoint.'

if __name__ == '__main__':
    app.run(debug=True)
