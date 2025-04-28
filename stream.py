# stream.py
import time
import json
import sqlite3
import dotenv
import os
import threading
import requests
from datetime import datetime, timedelta
import schwabdev

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Load environment variables
try:
    dotenv.load_dotenv()
    appKey = os.getenv("SCHWAB_APP_KEY")
    appSecret = os.getenv("SCHWAB_APP_SECRET")
except:
    appKey = None
    appSecret = None
    print("Failed to load environment variables. ")

try:
    client = schwabdev.Client(appKey, appSecret)
    streamer = client.stream
    print("Connected to Schwab API")
except Exception as e:
    print(f"Failed to connect to Schwab API: {e}")

today_date = datetime.now().strftime('%y%m%d')
# Use full path for the database file
db_filename = os.path.join(DATA_DIR, f'options_data_{today_date}.db')

# Thread-local storage for database connections
local = threading.local()

# Set of active symbols being tracked
active_symbols = set()
active_symbols_lock = threading.Lock()
# Track when we last subscribed to each symbol
symbol_subscription_times = {}

# API URL for the FastAPI service
API_URL = "http://localhost:8080"  # Update this if your API runs on a different host/port

def get_db_connection():
    """Get a database connection for the current thread"""
    if not hasattr(local, 'conn'):
        local.conn = sqlite3.connect(db_filename)
        local.cursor = local.conn.cursor()
        
        # Create tables if they don't exist
        local.cursor.execute('''
        CREATE TABLE IF NOT EXISTS options_book_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT,
            timestamp INTEGER,
            price REAL,
            quantity INTEGER,
            side TEXT
        )
        ''')

        local.cursor.execute('''
        CREATE TABLE IF NOT EXISTS level_one_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT,
            timestamp INTEGER,
            last_price REAL,
            last_size REAL,
            underlying_price REAL
        )
        ''')
        
        # Create indices for faster querying
        local.cursor.execute('CREATE INDEX IF NOT EXISTS idx_book_symbol_ts ON options_book_data (symbol, timestamp)')
        local.cursor.execute('CREATE INDEX IF NOT EXISTS idx_level_one_symbol_ts ON level_one_data (symbol, timestamp)')
        
        local.conn.commit()
    
    return local.conn, local.cursor

# Initialize the main thread's connection
conn, cursor = get_db_connection()

def my_handler(message):
    try:
        # Get thread-local connection
        conn, cursor = get_db_connection()
        
        data = json.loads(message)
        if "data" not in data:
            return

        for item in data["data"]:
            service = item.get("service")
            if not service or "content" not in item:
                continue
            
            # Generate a unique timestamp for each market update to preserve history
            current_timestamp = int(time.time() * 1000)
            # Or use the timestamp from the API if available
            api_timestamp = item.get("timestamp")
            
            # Process each content item based on the service type
            for content in item["content"]:
                symbol = content.get("key")
                if not symbol:
                    continue

                if service == "OPTIONS_BOOK":
                    # Use a unique timestamp for each OPTIONS_BOOK update
                    book_timestamp = api_timestamp or current_timestamp
                    
                    # Get bid and ask data
                    bid_data = content.get("2", [])
                    ask_data = content.get("3", [])
                    
                    # Only save data if we have new bid/ask information
                    if bid_data or ask_data:
                        if bid_data:  # Bid data
                            process_book_side(bid_data, symbol, book_timestamp, "BID", cursor)
                        if ask_data:  # Ask data
                            process_book_side(ask_data, symbol, book_timestamp, "ASK", cursor)
                        print(f"Processed OPTIONS_BOOK for {symbol} with {len(bid_data) + len(ask_data)} levels at timestamp {book_timestamp}")

                elif service == "LEVELONE_OPTIONS":
                    # Debug: log raw content and field values
                    print(f"Raw LEVELONE_OPTIONS content for {symbol}: {content}")
                    print(f"Extracted last_price(4): {content.get('4')}, last_size(18): {content.get('18')}, underlying_price(35): {content.get('35')}")
                    # Get level one data fields
                    last_price = content.get("4")      # Last price
                    last_size = content.get("18")      # Last size
                    underlying_price = content.get("35") # Underlying price
                    
                    # Use the API timestamp or current time
                    options_timestamp = api_timestamp or current_timestamp

                    # Only insert if we have meaningful data
                    if any([last_price is not None, last_size is not None, underlying_price is not None]):
                        cursor.execute('''
                            INSERT INTO level_one_data 
                            (symbol, timestamp, last_price, last_size, underlying_price)
                            VALUES (?, ?, ?, ?, ?)
                        ''', (symbol, options_timestamp, last_price, last_size, underlying_price))

                        print(f"Inserted LEVELONE_OPTIONS: {symbol} - Last: {last_price}, Size: {last_size}, Underlying: {underlying_price}")
                    else:
                        print(f"No LEVELONE_OPTIONS data to insert for {symbol}")

        conn.commit()

    except Exception as e:
        print(f"Error processing message: {e}")
        print(f"Problematic message: {message}")

def process_book_side(side_data, symbol, timestamp, side_type, cursor):
    for price_level in side_data:
        price = price_level.get("0")
        quantity = price_level.get("1")
        if price is not None and quantity is not None:
            cursor.execute('''
                INSERT INTO options_book_data 
                (symbol, timestamp, price, quantity, side)
                VALUES (?, ?, ?, ?, ?)
            ''', (symbol, timestamp, price, quantity, side_type))

def fetch_active_symbols():
    """Fetch the active symbols list from the API"""
    try:
        response = requests.get(f"{API_URL}/active_symbols")
        if response.status_code == 200:
            data = response.json()
            new_symbols = []
            
            with active_symbols_lock:
                # Check for new symbols
                for symbol in data.get("symbols", []):
                    if symbol not in active_symbols:
                        new_symbols.append(symbol)
                        active_symbols.add(symbol)
                        # Create initial empty data for this symbol
                        create_empty_data_for_symbol(symbol)
                
            if new_symbols:
                print(f"Added new symbols: {new_symbols}")
                
            return active_symbols
        else:
            print(f"Failed to fetch active symbols, status code: {response.status_code}")
            return set()
    except Exception as e:
        print(f"Error fetching active symbols: {e}")
        return set()

def subscribe_to_symbols(symbols):
    """Subscribe to the given symbols"""
    current_time = time.time()
    
    for symbol in symbols:
        try:
            # Check if we need to subscribe
            if (symbol not in symbol_subscription_times):
                
                print(f"Subscribing to OPTIONS_BOOK and LEVELONE_OPTIONS for {symbol}")
                streamer.send(streamer.options_book(symbol, "0,1,2,3,4,5,6,7,8"))
                streamer.send(streamer.level_one_options(symbol, "0,1,2,3,4,18,35"))
                
                # Update subscription time
                symbol_subscription_times[symbol] = current_time
                
                # Small delay to avoid overwhelming the API
                time.sleep(0.1)
        except Exception as e:
            print(f"Error subscribing to {symbol}: {e}")

def create_empty_data_for_symbol(symbol):
    """Create empty initial data for a symbol to ensure it appears in the database"""
    conn, cursor = get_db_connection()
    
    current_timestamp = int(time.time() * 1000)
    
    try:
        # Insert a placeholder bid and ask level
        cursor.execute('''
            INSERT INTO options_book_data 
            (symbol, timestamp, price, quantity, side)
            VALUES (?, ?, 0, 0, 'BID')
        ''', (symbol, current_timestamp))
        
        cursor.execute('''
            INSERT INTO options_book_data 
            (symbol, timestamp, price, quantity, side)
            VALUES (?, ?, 0, 0, 'ASK')
        ''', (symbol, current_timestamp))
        
        # Insert placeholder level one data
        cursor.execute('''
            INSERT INTO level_one_data 
            (symbol, timestamp, last_price, last_size, underlying_price)
            VALUES (?, ?, NULL, NULL, NULL)
        ''', (symbol, current_timestamp))
        
        conn.commit()
        print(f"Created initial empty data for {symbol}")
    except Exception as e:
        print(f"Error creating empty data for {symbol}: {e}")

def main():
    # Run in Schwab API mode
    try:
        # Start the streamer
        streamer.start(my_handler)
        
        # Initial symbol to subscribe to.
        # If we dont subscribe to any symbol within 90 seconds, the API will disconnect us.
        today = datetime.now()
        date_str = today.strftime('%y%m%d')
        initial_symbol = f"SPY   {date_str}C00500000"  # Using 500 strike price
        
        with active_symbols_lock:
            active_symbols.add(initial_symbol)
            create_empty_data_for_symbol(initial_symbol)
        
        def update_subscriptions():
            # Fetch active symbols from API
            api_symbols = fetch_active_symbols()
            
            # Get current symbols with thread safety
            with active_symbols_lock:
                current_symbols = active_symbols.copy()
            
            # If we have active symbols, subscribe to them
            if current_symbols:
                subscribe_to_symbols(current_symbols)
            else:
                # If no symbols from API, use the initial symbol
                subscribe_to_symbols({initial_symbol})
        
        # Initial subscription
        update_subscriptions()
        
        # Refresh subscriptions periodically to pick up new symbols
        symbols_check_time = time.time()
        
        print(f"Stream running. Press Ctrl+C to stop.")
        while True:
            time.sleep(0.1)
            
            current_time = time.time()
            
            # Check for new symbols every 5 seconds
            if current_time - symbols_check_time > 5:
                update_subscriptions()
                symbols_check_time = current_time

    
    except KeyboardInterrupt:
        print("Stopping stream...")
    finally:
        streamer.stop()
        if hasattr(local, 'conn'):
            local.conn.close()
        print("Stream stopped and database connection closed.")

if __name__ == "__main__":
    main()