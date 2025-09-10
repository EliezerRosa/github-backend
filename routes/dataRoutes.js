const express = require('express');
const router = express.Router();

// GET /api/data - Get database statistics and collections
router.get('/', async (req, res) => {
  try {
    const databaseService = req.app.locals.databaseService;
    const stats = await databaseService.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/data/collections - Get all collections
router.get('/collections', async (req, res) => {
  try {
    const databaseService = req.app.locals.databaseService;
    const collections = await databaseService.getCollections();
    res.json({
      success: true,
      data: collections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/data/:collection - Get all records from a collection
router.get('/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const { limit, offset, search } = req.query;
    const databaseService = req.app.locals.databaseService;
    
    let records = await databaseService.getCollection(collection);
    
    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      records = records.filter(record => 
        JSON.stringify(record).toLowerCase().includes(searchLower)
      );
    }
    
    // Apply pagination
    const total = records.length;
    const startIndex = parseInt(offset) || 0;
    const limitNum = parseInt(limit) || total;
    
    if (limit || offset) {
      records = records.slice(startIndex, startIndex + limitNum);
    }
    
    res.json({
      success: true,
      data: {
        records,
        pagination: {
          total,
          offset: startIndex,
          limit: limitNum,
          hasMore: startIndex + limitNum < total
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/data/:collection/:id - Get a specific record
router.get('/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    const databaseService = req.app.locals.databaseService;
    
    const record = await databaseService.getRecord(collection, id);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: `Record with ID ${id} not found in collection ${collection}`
      });
    }
    
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/data/:collection - Create a new record
router.post('/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const { transactionId } = req.query;
    const data = req.body;
    
    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Request body must be a valid JSON object'
      });
    }
    
    let record;
    
    if (transactionId) {
      // Execute within transaction
      const transactionService = req.app.locals.transactionService;
      record = await transactionService.executeInTransaction(
        transactionId, 
        'create', 
        collection, 
        data
      );
    } else {
      // Execute directly
      const databaseService = req.app.locals.databaseService;
      record = await databaseService.createRecord(collection, data);
    }
    
    res.status(201).json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/data/:collection/:id - Update a record
router.put('/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    const { transactionId } = req.query;
    const data = req.body;
    
    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Request body must be a valid JSON object'
      });
    }
    
    let record;
    
    if (transactionId) {
      // Execute within transaction
      const transactionService = req.app.locals.transactionService;
      record = await transactionService.executeInTransaction(
        transactionId, 
        'update', 
        collection, 
        id, 
        data
      );
    } else {
      // Execute directly
      const databaseService = req.app.locals.databaseService;
      record = await databaseService.updateRecord(collection, id, data);
    }
    
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    if (error.message.includes('not found')) {
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

// DELETE /api/data/:collection/:id - Delete a record
router.delete('/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    const { transactionId } = req.query;
    
    let record;
    
    if (transactionId) {
      // Execute within transaction
      const transactionService = req.app.locals.transactionService;
      record = await transactionService.executeInTransaction(
        transactionId, 
        'delete', 
        collection, 
        id
      );
    } else {
      // Execute directly
      const databaseService = req.app.locals.databaseService;
      record = await databaseService.deleteRecord(collection, id);
    }
    
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    if (error.message.includes('not found')) {
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

// GET /api/data/history/commits - Get git commit history
router.get('/history/commits', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const databaseService = req.app.locals.databaseService;
    
    const history = await databaseService.getHistory(parseInt(limit));
    
    res.json({
      success: true,
      data: {
        commits: history,
        total: history.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/data/history/revert - Revert to a specific commit
router.post('/history/revert', async (req, res) => {
  try {
    const { commitHash } = req.body;
    
    if (!commitHash) {
      return res.status(400).json({
        success: false,
        error: 'commitHash is required'
      });
    }
    
    const databaseService = req.app.locals.databaseService;
    await databaseService.revertToCommit(commitHash);
    
    res.json({
      success: true,
      message: `Successfully reverted to commit ${commitHash}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;