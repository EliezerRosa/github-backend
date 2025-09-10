const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Import services
const DatabaseService = require('./services/DatabaseService');
const TransactionService = require('./services/TransactionService');

// Import routes
const dataRoutes = require('./routes/dataRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize services
const databaseService = new DatabaseService();
const transactionService = new TransactionService(databaseService);

// Make services available to routes
app.locals.databaseService = databaseService;
app.locals.transactionService = transactionService;

// Routes
app.use('/api/data', dataRoutes);
app.use('/api/transactions', transactionRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint with API documentation
app.get('/', (req, res) => {
  res.json({
    message: 'GitHub Backend - JSON Database with Git Version Control',
    version: '1.0.0',
    endpoints: {
      '/health': 'GET - Health check',
      '/api/data': 'CRUD operations on JSON data',
      '/api/transactions': 'Transaction management (begin, commit, rollback)'
    },
    features: [
      'JSON file-based database',
      'Git commits for version control',
      'Transaction simulation with rollback support',
      'RESTful API'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GitHub Backend Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/`);
  
  // Initialize database directory
  databaseService.initialize().catch(console.error);
});

module.exports = app;