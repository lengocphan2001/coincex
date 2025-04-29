const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Proxy endpoint for Coincex API
app.post('/api/proxy/login', async (req, res) => {
  try {

    const response = await axios.post('https://api.coincex.io/api/v1/login', req.body, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (response.data && typeof response.data === 'object') {
      res.json(response.data);
    } else {
      res.status(500).json({
        error: 1,
        message: 'Invalid response from Coincex API'
      });
    }
  } catch (error) {

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      res.status(error.response.status).json({
        error: 1,
        message: error.response.data?.message || 'Error from Coincex API',
        details: error.response.data
      });
    } else if (error.request) {
      // The request was made but no response was received
      res.status(500).json({
        error: 1,
        message: 'No response received from Coincex API'
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      res.status(500).json({
        error: 1,
        message: 'Error setting up request to Coincex API'
      });
    }
  }
});

// Proxy endpoint for user info
app.get('/api/proxy/user-info', async (req, res) => {
  try {

    const response = await axios.get('https://api.coincex.io/api/v1/user-info', {
      headers: {
        'Authorization': req.headers.authorization,
        'Accept': 'application/json'
      }
    });

    if (response.data && typeof response.data === 'object') {
      res.json(response.data);
    } else {
      res.status(500).json({
        error: 1,
        message: 'Invalid response from Coincex API'
      });
    }
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json({
        error: 1,
        message: error.response.data?.message || 'Error from Coincex API',
        details: error.response.data
      });
    } else if (error.request) {
      res.status(500).json({
        error: 1,
        message: 'No response received from Coincex API'
      });
    } else {
      res.status(500).json({
        error: 1,
        message: 'Error setting up request to Coincex API'
      });
    }
  }
});

// Proxy endpoint for trading history
app.get('/api/proxy/history-bo', async (req, res) => {
  try {
    const { status = 'pending', offset = 0, limit = 10 } = req.query;
    const response = await axios.get(`https://api.coincex.io/api/v1/history-bo`, {
      params: {
        status,
        offset,
        limit
      },
      headers: {
        'Authorization': req.headers.authorization,
        'Accept': 'application/json'
      }
    });

    if (response.data) {
      res.json(response.data);
    } else {
      res.status(500).json({
        error: 1,
        message: 'Empty response from Coincex API'
      });
    }
  } catch (error) {


    if (error.response) {
      res.status(error.response.status).json({
        error: 1,
        message: error.response.data?.message || 'Error from Coincex API',
        details: error.response.data
      });
    } else if (error.request) {
      res.status(500).json({
        error: 1,
        message: 'No response received from Coincex API'
      });
    } else {
      res.status(500).json({
        error: 1,
        message: 'Error setting up request to Coincex API'
      });
    }
  }
});


app.post('/api/proxy/trading-bo', async (req, res) => {
  try {

    const response = await axios.post('https://api.coincex.io/api/v1/trading-bo', 
      req.body,
      {
        headers: {
          'Authorization': req.headers.authorization,
          'Accept': 'application/json',
        }
      }
    );

    if (response.data) {
      res.json(response.data);
    } else {
      res.status(500).json({
        error: 1,
        message: 'Invalid response from Coincex API'
      });
    }
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 1,
      message: error.response?.data?.message || 'Error processing request'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
}); 