const { execSync } = require('child_process');
const path = require('path');

class TransactionService {
  constructor(databaseService) {
    this.databaseService = databaseService;
    this.activeTransactions = new Map();
  }

  /**
   * Begin a new transaction
   */
  async beginTransaction(transactionId = null) {
    const id = transactionId || this.generateTransactionId();
    
    if (this.activeTransactions.has(id)) {
      throw new Error(`Transaction ${id} is already active`);
    }

    try {
      // Create a checkpoint by getting current git commit hash
      const checkpointHash = this.getCurrentCommitHash();
      
      const transaction = {
        id,
        startTime: new Date().toISOString(),
        checkpointHash,
        operations: [],
        status: 'active'
      };

      this.activeTransactions.set(id, transaction);
      
      console.log(`🎬 Transaction ${id} started at checkpoint ${checkpointHash}`);
      return transaction;
    } catch (error) {
      console.error('❌ Error beginning transaction:', error.message);
      throw error;
    }
  }

  /**
   * Execute an operation within a transaction
   */
  async executeInTransaction(transactionId, operation, ...args) {
    const transaction = this.activeTransactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found or not active`);
    }

    if (transaction.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active (status: ${transaction.status})`);
    }

    try {
      let result;
      const operationRecord = {
        operation,
        args,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      // Execute the operation
      switch (operation) {
        case 'create':
          result = await this.databaseService.createRecord(...args);
          break;
        case 'update':
          result = await this.databaseService.updateRecord(...args);
          break;
        case 'delete':
          result = await this.databaseService.deleteRecord(...args);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      operationRecord.status = 'completed';
      operationRecord.result = result;
      transaction.operations.push(operationRecord);

      console.log(`📝 Operation ${operation} executed in transaction ${transactionId}`);
      return result;
    } catch (error) {
      console.error(`❌ Error executing operation in transaction ${transactionId}:`, error.message);
      
      // Mark operation as failed
      transaction.operations.push({
        operation,
        args,
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(transactionId) {
    const transaction = this.activeTransactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active (status: ${transaction.status})`);
    }

    try {
      // Mark transaction as committed
      transaction.status = 'committed';
      transaction.endTime = new Date().toISOString();
      transaction.finalCommitHash = this.getCurrentCommitHash();

      // Create a final commit with transaction information
      await this.databaseService.commitChanges(`Transaction ${transactionId} committed - ${transaction.operations.length} operations`);

      // Remove from active transactions
      this.activeTransactions.delete(transactionId);

      console.log(`✅ Transaction ${transactionId} committed successfully`);
      return transaction;
    } catch (error) {
      console.error(`❌ Error committing transaction ${transactionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(transactionId) {
    const transaction = this.activeTransactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active (status: ${transaction.status})`);
    }

    try {
      // Rollback to the checkpoint
      await this.databaseService.revertToCommit(transaction.checkpointHash);
      
      // Mark transaction as rolled back
      transaction.status = 'rolled_back';
      transaction.endTime = new Date().toISOString();

      // Remove from active transactions
      this.activeTransactions.delete(transactionId);

      console.log(`🔄 Transaction ${transactionId} rolled back to ${transaction.checkpointHash}`);
      return transaction;
    } catch (error) {
      console.error(`❌ Error rolling back transaction ${transactionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  getTransaction(transactionId) {
    return this.activeTransactions.get(transactionId);
  }

  /**
   * List all active transactions
   */
  getActiveTransactions() {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Abort all active transactions (emergency cleanup)
   */
  async abortAllTransactions() {
    const transactionIds = Array.from(this.activeTransactions.keys());
    const results = [];

    for (const id of transactionIds) {
      try {
        const result = await this.rollbackTransaction(id);
        results.push({ id, status: 'rolled_back', result });
      } catch (error) {
        results.push({ id, status: 'error', error: error.message });
      }
    }

    console.log(`🚨 Aborted ${transactionIds.length} active transactions`);
    return results;
  }

  /**
   * Auto-commit transactions that have been active for too long
   */
  async cleanupStaleTransactions(maxAgeMinutes = 30) {
    const now = new Date();
    const staleTransactions = [];

    for (const [id, transaction] of this.activeTransactions) {
      const startTime = new Date(transaction.startTime);
      const ageMinutes = (now - startTime) / (1000 * 60);

      if (ageMinutes > maxAgeMinutes) {
        staleTransactions.push(id);
      }
    }

    const results = [];
    for (const id of staleTransactions) {
      try {
        const result = await this.rollbackTransaction(id);
        results.push({ id, status: 'auto_rolled_back', result });
        console.log(`🧹 Auto-rolled back stale transaction ${id}`);
      } catch (error) {
        results.push({ id, status: 'cleanup_error', error: error.message });
      }
    }

    return results;
  }

  /**
   * Get current git commit hash
   */
  getCurrentCommitHash() {
    try {
      return execSync('git rev-parse HEAD', { 
        cwd: this.databaseService.databasePath,
        encoding: 'utf8'
      }).trim();
    } catch (error) {
      console.error('❌ Error getting current commit hash:', error.message);
      throw error;
    }
  }

  /**
   * Generate a unique transaction ID
   */
  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Get transaction statistics
   */
  getTransactionStats() {
    const activeCount = this.activeTransactions.size;
    const transactions = Array.from(this.activeTransactions.values());
    
    const stats = {
      activeTransactions: activeCount,
      oldestTransaction: null,
      averageOperationsPerTransaction: 0,
      totalOperations: 0
    };

    if (transactions.length > 0) {
      // Find oldest transaction
      stats.oldestTransaction = transactions.reduce((oldest, current) => {
        return new Date(current.startTime) < new Date(oldest.startTime) ? current : oldest;
      });

      // Calculate average operations per transaction
      stats.totalOperations = transactions.reduce((total, tx) => total + tx.operations.length, 0);
      stats.averageOperationsPerTransaction = stats.totalOperations / transactions.length;
    }

    return stats;
  }
}

module.exports = TransactionService;