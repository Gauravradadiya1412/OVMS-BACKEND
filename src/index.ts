import express from 'express';
import cors from 'cors';
import { SyncService } from './services/SyncService';
import { AllocationService } from './services/AllocationService';
import { pool } from './database';

const app = express();
const port = process.env.PORT || 3001;

const syncService = new SyncService();
const allocationService = new AllocationService();

app.use(cors());
app.use(express.json());


const startServer = async (retries = 5) => {
  while (retries) {
    try {
      const client = await pool.connect();
      console.log('[DATABASE] ✅ Connection verified successfully.');
      client.release();
      
      app.listen(port, () => {
        console.log(`[SERVER] 🚀 Running at http://localhost:${port}`);
      });
      return; 
    } catch (err: any) {
      retries -= 1;
      console.error(`[DATABASE] ❌ Connection failed. Retries left: ${retries}`);
      console.error(`Error: ${err.message}`);
      if (retries === 0) {
        console.error('[SERVER] 💀 Critical Error: Could not connect to DB. Exiting...');
        process.exit(1);
      }
      // Wait 5 seconds before next retry
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};


app.post('/api/sync', async (req, res) => {
  try {
    await syncService.syncAll();
    res.json({ message: 'Sync successful' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clients', async (req, res) => {
  try {
    const clients = await allocationService.getClients();
    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/org-tree', async (req, res) => {
  try {
    const orgTree = await allocationService.getOrgTree();
    res.json(orgTree);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/client-tree', async (req, res) => {
  try {
    const clientTree = await allocationService.getClientTree();
    res.json(clientTree);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/employees/:id', async (req, res) => {
  try {
    const details = await allocationService.getEmployeeDetails(req.params.id);
    res.json(details);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/allocations', async (req, res) => {
  try {
    const { managerId, employeeId, clientId, percentage, role } = req.body;
    const result = await allocationService.updateAllocation(managerId, employeeId, clientId, percentage, role);
    res.json(result);
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: 'connected' });
});

startServer();
