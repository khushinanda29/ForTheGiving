from flask import Flask, jsonify, request
import mysql.connector
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Connect to MySQL
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password=os.getenv("MYSQL_PASSWORD", "rainbow29"),
    database="forthegiving_db"
)

# --- Default route ---
@app.route("/")
def home():
    return "ForTheGiving Flask Backend connected to MySQL successfully!"

# --- Route 1: get all hospitals ---
@app.route("/hospitals", methods=["GET"])
def get_hospitals():
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM Hospital")
    hospitals = cursor.fetchall()
    cursor.close()
    return jsonify(hospitals)

# --- Route 2: get all donors ---
@app.route("/donors", methods=["GET"])
def get_donors():
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM Donor")
    donors = cursor.fetchall()
    cursor.close()
    return jsonify(donors)

# --- Route 3: add a new donor (POST) ---
@app.route("/donors", methods=["POST"])
def add_donor():
    data = request.get_json()
    cursor = db.cursor()
    query = """
        INSERT INTO Donor (name, gender, age, phone, email, address)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    values = (
        data["name"],
        data["gender"],
        data["age"],
        data["phone"],
        data["email"],
        data["address"]
    )
    cursor.execute(query, values)
    db.commit()
    cursor.close()
    return jsonify({"message": "Donor added successfully!"}), 201

if __name__ == "__main__":
    app.run(debug=True)



