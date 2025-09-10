#!/usr/bin/env node

const DatabaseService = require('./services/DatabaseService');
const TransactionService = require('./services/TransactionService');

async function testBackend() {
  console.log('🧪 Testing GitHub Backend System\n');
  
  try {
    // Initialize services
    const db = new DatabaseService();
    const tx = new TransactionService(db);
    
    await db.initialize();
    
    console.log('✅ Services initialized successfully\n');
    
    // Test 1: Direct database operations
    console.log('📝 Test 1: Direct Database Operations');
    
    const user1 = await db.createRecord('users', {
      name: 'João Silva',
      email: 'joao@example.com',
      age: 30
    });
    console.log('  ✓ Created user:', user1.id);
    
    const user2 = await db.createRecord('users', {
      name: 'Maria Santos',
      email: 'maria@example.com',
      age: 25
    });
    console.log('  ✓ Created user:', user2.id);
    
    // Update user
    const updatedUser = await db.updateRecord('users', user1.id, {
      age: 31,
      city: 'São Paulo'
    });
    console.log('  ✓ Updated user:', updatedUser.id);
    
    // Get all users
    const users = await db.getCollection('users');
    console.log('  ✓ Retrieved users:', users.length);
    
    console.log('\n📊 Test 2: Transaction Operations');
    
    // Test 2: Transaction operations
    const transaction = await tx.beginTransaction();
    console.log('  ✓ Started transaction:', transaction.id);
    
    // Execute operations in transaction
    const user3 = await tx.executeInTransaction(transaction.id, 'create', 'users', {
      name: 'Carlos Oliveira',
      email: 'carlos@example.com',
      age: 35
    });
    console.log('  ✓ Created user in transaction:', user3.id);
    
    const updatedInTx = await tx.executeInTransaction(transaction.id, 'update', 'users', user2.id, {
      age: 26,
      status: 'updated_in_transaction'
    });
    console.log('  ✓ Updated user in transaction:', updatedInTx.id);
    
    // Check current state (should show changes)
    const usersBeforeCommit = await db.getCollection('users');
    console.log('  ✓ Users before commit:', usersBeforeCommit.length);
    
    // Commit transaction
    await tx.commitTransaction(transaction.id);
    console.log('  ✓ Transaction committed');
    
    console.log('\n🔄 Test 3: Rollback Operations');
    
    // Test 3: Rollback functionality
    const transaction2 = await tx.beginTransaction();
    console.log('  ✓ Started transaction 2:', transaction2.id);
    
    // Make some changes
    await tx.executeInTransaction(transaction2.id, 'delete', 'users', user1.id);
    console.log('  ✓ Deleted user in transaction');
    
    await tx.executeInTransaction(transaction2.id, 'create', 'users', {
      name: 'Ana Costa',
      email: 'ana@example.com',
      age: 28
    });
    console.log('  ✓ Created user in transaction');
    
    // Check state before rollback
    const usersBeforeRollback = await db.getCollection('users');
    console.log('  ✓ Users before rollback:', usersBeforeRollback.length);
    
    // Rollback transaction
    await tx.rollbackTransaction(transaction2.id);
    console.log('  ✓ Transaction rolled back');
    
    // Check state after rollback
    const usersAfterRollback = await db.getCollection('users');
    console.log('  ✓ Users after rollback:', usersAfterRollback.length);
    
    console.log('\n📈 Test 4: Database Statistics');
    
    // Test 4: Get statistics
    const stats = await db.getStats();
    console.log('  ✓ Total collections:', stats.collections.length);
    console.log('  ✓ Total records:', stats.metadata.totalRecords);
    console.log('  ✓ Recent commits:', stats.recentCommits.length);
    
    // Show git history
    const history = await db.getHistory(5);
    console.log('\n📚 Git History:');
    history.forEach((commit, index) => {
      console.log(`  ${index + 1}. ${commit}`);
    });
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Final Statistics:');
    console.log(`  - Collections: ${stats.collections.join(', ')}`);
    console.log(`  - Total Records: ${stats.metadata.totalRecords}`);
    console.log(`  - Git Commits: ${stats.recentCommits.length}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testBackend();
}

module.exports = testBackend;