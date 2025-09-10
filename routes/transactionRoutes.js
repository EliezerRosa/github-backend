const express = require('express');
const router = express.Router();

// GET /api/transactions - Get all active transactions and statistics
router.get('/', async (req, res) => {
  try {
    const transactionService = req.app.locals.transactionService;
    
    const activeTransactions = transactionService.getActiveTransactions();
    const stats = transactionService.getTransactionStats();
    
    res.json({
      success: true,
      data: {
        activeTransactions,
        statistics: stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/transactions/begin - Begin a new transaction
router.post('/begin', async (req, res) => {
  try {
    const { transactionId } = req.body;
    const transactionService = req.app.locals.transactionService;
    
    const transaction = await transactionService.beginTransaction(transactionId);
    
    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/transactions/:id - Get transaction details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const transactionService = req.app.locals.transactionService;
    
    const transaction = transactionService.getTransaction(id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: `Transaction ${id} not found`
      });
    }
    
    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/transactions/:id/commit - Commit a transaction
router.post('/:id/commit', async (req, res) => {
  try {
    const { id } = req.params;
    const transactionService = req.app.locals.transactionService;
    
    const transaction = await transactionService.commitTransaction(id);
    
    res.json({
      success: true,
      data: transaction,
      message: `Transaction ${id} committed successfully`
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('not active')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

// POST /api/transactions/:id/rollback - Rollback a transaction
router.post('/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params;
    const transactionService = req.app.locals.transactionService;
    
    const transaction = await transactionService.rollbackTransaction(id);
    
    res.json({
      success: true,
      data: transaction,
      message: `Transaction ${id} rolled back successfully`
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('not active')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

// POST /api/transactions/cleanup - Cleanup stale transactions
router.post('/cleanup', async (req, res) => {
  try {
    const { maxAgeMinutes = 30 } = req.body;
    const transactionService = req.app.locals.transactionService;
    
    const results = await transactionService.cleanupStaleTransactions(maxAgeMinutes);
    
    res.json({
      success: true,
      data: results,
      message: `Cleaned up ${results.length} stale transactions`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/transactions/abort-all - Emergency abort all active transactions
router.post('/abort-all', async (req, res) => {
  try {
    const transactionService = req.app.locals.transactionService;
    
    const results = await transactionService.abortAllTransactions();
    
    res.json({
      success: true,
      data: results,
      message: `Aborted ${results.length} active transactions`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/transactions/:id/execute - Execute an operation within a transaction
router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const { operation, collection, recordId, data } = req.body;
    
    if (!operation || !collection) {
      return res.status(400).json({
        success: false,
        error: 'operation and collection are required'
      });
    }
    
    const transactionService = req.app.locals.transactionService;
    let result;
    
    switch (operation) {
      case 'create':
        if (!data) {
          return res.status(400).json({
            success: false,
            error: 'data is required for create operation'
          });
        }
        result = await transactionService.executeInTransaction(id, 'create', collection, data);
        break;
        
      case 'update':
        if (!recordId || !data) {
          return res.status(400).json({
            success: false,
            error: 'recordId and data are required for update operation'
          });
        }
        result = await transactionService.executeInTransaction(id, 'update', collection, recordId, data);
        break;
        
      case 'delete':
        if (!recordId) {
          return res.status(400).json({
            success: false,
            error: 'recordId is required for delete operation'
          });
        }
        result = await transactionService.executeInTransaction(id, 'delete', collection, recordId);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported operation: ${operation}`
        });
    }
    
    res.json({
      success: true,
      data: result,
      message: `Operation ${operation} executed successfully in transaction ${id}`
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('not active')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

module.exports = router;