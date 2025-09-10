const fs = require('fs').promises;
const path = require('path');
const { execSync, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class DatabaseService {
  constructor(databasePath = './database') {
    this.databasePath = path.resolve(databasePath);
    this.dataPath = path.join(this.databasePath, 'data');
    this.metadataPath = path.join(this.databasePath, 'metadata.json');
  }

  /**
   * Initialize the database directory and git repository
   */
  async initialize() {
    try {
      // Create database directories
      await fs.mkdir(this.databasePath, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });

      // Initialize metadata if it doesn't exist
      await this.initializeMetadata();

      // Initialize git repository if not exists
      await this.initializeGitRepo();

      console.log('📂 Database initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing database:', error.message);
      throw error;
    }
  }

  /**
   * Initialize metadata file
   */
  async initializeMetadata() {
    try {
      await fs.access(this.metadataPath);
    } catch (error) {
      // Metadata doesn't exist, create it
      const metadata = {
        version: '1.0.0',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        totalRecords: 0,
        collections: {}
      };
      await fs.writeFile(this.metadataPath, JSON.stringify(metadata, null, 2));
    }
  }

  /**
   * Initialize git repository in database directory
   */
  async initializeGitRepo() {
    try {
      const gitPath = path.join(this.databasePath, '.git');
      try {
        await fs.access(gitPath);
        console.log('📁 Git repository already exists');
      } catch (error) {
        // Git repo doesn't exist, initialize it
        execSync('git init', { cwd: this.databasePath });
        execSync('git config user.name "GitHub Backend"', { cwd: this.databasePath });
        execSync('git config user.email "backend@github-backend.local"', { cwd: this.databasePath });
        
        // Create initial commit
        execSync('git add .', { cwd: this.databasePath });
        execSync('git commit -m "Initial database setup"', { cwd: this.databasePath });
        
        console.log('🎯 Git repository initialized');
      }
    } catch (error) {
      console.error('❌ Error initializing git repository:', error.message);
      throw error;
    }
  }

  /**
   * Get all collections
   */
  async getCollections() {
    try {
      const files = await fs.readdir(this.dataPath);
      const collections = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
      return collections;
    } catch (error) {
      console.error('❌ Error reading collections:', error.message);
      return [];
    }
  }

  /**
   * Get all records from a collection
   */
  async getCollection(collection) {
    const filePath = path.join(this.dataPath, `${collection}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get a specific record by ID
   */
  async getRecord(collection, id) {
    const records = await this.getCollection(collection);
    return records.find(record => record.id === id);
  }

  /**
   * Create a new record
   */
  async createRecord(collection, data) {
    const records = await this.getCollection(collection);
    
    // Generate ID if not provided
    const id = data.id || this.generateId();
    const timestamp = new Date().toISOString();
    
    const newRecord = {
      ...data,
      id,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    records.push(newRecord);
    await this.saveCollection(collection, records);
    await this.commitChanges(`Create record ${id} in ${collection}`);
    
    return newRecord;
  }

  /**
   * Update an existing record
   */
  async updateRecord(collection, id, data) {
    const records = await this.getCollection(collection);
    const index = records.findIndex(record => record.id === id);
    
    if (index === -1) {
      throw new Error(`Record with ID ${id} not found in collection ${collection}`);
    }

    const timestamp = new Date().toISOString();
    records[index] = {
      ...records[index],
      ...data,
      id, // Ensure ID doesn't change
      updatedAt: timestamp
    };

    await this.saveCollection(collection, records);
    await this.commitChanges(`Update record ${id} in ${collection}`);
    
    return records[index];
  }

  /**
   * Delete a record
   */
  async deleteRecord(collection, id) {
    const records = await this.getCollection(collection);
    const index = records.findIndex(record => record.id === id);
    
    if (index === -1) {
      throw new Error(`Record with ID ${id} not found in collection ${collection}`);
    }

    const deletedRecord = records[index];
    records.splice(index, 1);
    
    await this.saveCollection(collection, records);
    await this.commitChanges(`Delete record ${id} from ${collection}`);
    
    return deletedRecord;
  }

  /**
   * Save collection to file
   */
  async saveCollection(collection, records) {
    const filePath = path.join(this.dataPath, `${collection}.json`);
    await fs.writeFile(filePath, JSON.stringify(records, null, 2));
    await this.updateMetadata(collection, records.length);
  }

  /**
   * Update metadata
   */
  async updateMetadata(collection, recordCount) {
    try {
      const metadata = JSON.parse(await fs.readFile(this.metadataPath, 'utf8'));
      metadata.lastModified = new Date().toISOString();
      metadata.collections[collection] = {
        recordCount,
        lastModified: new Date().toISOString()
      };
      
      // Calculate total records
      metadata.totalRecords = Object.values(metadata.collections)
        .reduce((total, col) => total + col.recordCount, 0);
      
      await fs.writeFile(this.metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error('❌ Error updating metadata:', error.message);
    }
  }

  /**
   * Commit changes to git
   */
  async commitChanges(message) {
    try {
      execSync('git add .', { cwd: this.databasePath });
      execSync(`git commit -m "${message}"`, { cwd: this.databasePath });
      console.log(`✅ Committed: ${message}`);
    } catch (error) {
      // Ignore errors if there are no changes to commit
      if (!error.message.includes('nothing to commit')) {
        console.error('❌ Error committing changes:', error.message);
      }
    }
  }

  /**
   * Get git history
   */
  async getHistory(limit = 10) {
    try {
      const { stdout } = await execAsync(`git log --oneline -${limit}`, { cwd: this.databasePath });
      return stdout.trim().split('\n').filter(line => line.length > 0);
    } catch (error) {
      console.error('❌ Error getting git history:', error.message);
      return [];
    }
  }

  /**
   * Get current git status
   */
  async getStatus() {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.databasePath });
      return stdout.trim().split('\n').filter(line => line.length > 0);
    } catch (error) {
      console.error('❌ Error getting git status:', error.message);
      return [];
    }
  }

  /**
   * Revert to a specific commit
   */
  async revertToCommit(commitHash) {
    try {
      execSync(`git reset --hard ${commitHash}`, { cwd: this.databasePath });
      console.log(`🔄 Reverted to commit: ${commitHash}`);
      return true;
    } catch (error) {
      console.error('❌ Error reverting to commit:', error.message);
      throw error;
    }
  }

  /**
   * Generate a unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const metadata = JSON.parse(await fs.readFile(this.metadataPath, 'utf8'));
      const history = await this.getHistory(5);
      const status = await this.getStatus();
      
      return {
        metadata,
        recentCommits: history,
        pendingChanges: status,
        collections: await this.getCollections()
      };
    } catch (error) {
      console.error('❌ Error getting database stats:', error.message);
      return null;
    }
  }
}

module.exports = DatabaseService;