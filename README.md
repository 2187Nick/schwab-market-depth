# Market Depth Visualization

This project visualizes level 2 data from the Schwab streaming API using a bookmap style visualization.

This is a rough v1. Improvements coming.

https://github.com/user-attachments/assets/a97abe19-d64d-4ef9-9ce8-2ab3edcae2fb

## Historical View
![grid_historical](https://github.com/user-attachments/assets/5ef78eb2-4c98-4749-9bc5-b271b75a0d9b)


## To create a new chart
```
1. Enter a stock symbol
2. Select date
3. Select Call or Put
4. Enter a strike 
5. Click "Create Chart"
```

![](https://github.com/user-attachments/assets/eaf79313-131c-4cf4-ac24-fd23c6a65cb0)

## Add more charts
Click the "+" to add more charts

## Features

- Real-time visualization of order book data
- Historical view of price levels over time
- Heatmap showing order density
- Futures and Index options coming soon....

## Requirements

- Python 3.11+
- Node.js 14+
- Schwab API credentials

## Setup

1. Clone this repository
2. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Create a `.env` file with your Schwab API credentials:
   ```
   SCHWAB_APP_KEY=your_app_key
   SCHWAB_APP_SECRET=your_app_secret
   ```
4. Install frontend dependencies:
   ```
   cd frontend
   npm install
   ```

## Running the Application

1. Start the API and data stream:
   ```
   python api.py
   ```

3. Start the frontend development server:
   ```
   cd frontend
   
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:8081
   ```

## API Endpoints

- `localhost:8080/symbols` - Get all available symbols
- `localhost:8080/depth/{symbol}` - Get the latest market depth for a symbol
- `localhost:8080/historical_full/{symbol}` - Get historical market depth snapshots 

## Credit

[@2187Nick](https://x.com/2187Nick) 

[Discord](https://discord.com/invite/vxKepZ6XNC) Come checkout the other builders and projects.


Schwab API wrapper: https://github.com/tylerebowers/Schwabdev