import { pool } from '../database';

export class AllocationService {
  
  async getClients() {
    const res = await pool.query('SELECT id, name FROM clients ORDER BY name');
    return res.rows;
  }

  async getOrgTree() {
    // We can fetch the whole table and build the tree in memory for simplicity
    const res = await pool.query(`
      SELECT id, zoho_id, first_name, last_name, designation, manager_id 
      FROM employees WHERE is_active = true
    `);
    
    const employees = res.rows;
    const map = new Map();
    employees.forEach(emp => {
      map.set(emp.id, { 
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`.trim(), 
        attributes: { designation: emp.designation },
        children: [] 
      });
    });

    const roots: any[] = [];
    employees.forEach(emp => {
      const node = map.get(emp.id);
      if (emp.manager_id && map.has(emp.manager_id)) {
        map.get(emp.manager_id).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  async getClientTree() {
    const res = await pool.query(`
      SELECT c.id as client_id, c.name as client_name, 
             e.id as employee_id, e.first_name, e.last_name, 
             ca.allocation_percentage, ca.role_in_client
      FROM clients c
      LEFT JOIN client_allocations ca ON c.id = ca.client_id
      LEFT JOIN employees e ON ca.employee_id = e.id
      ORDER BY c.name
    `);

    const clientsMap = new Map();
    res.rows.forEach(row => {
      if (!clientsMap.has(row.client_id)) {
        clientsMap.set(row.client_id, { name: row.client_name, children: [] });
      }
      if (row.employee_id) {
        clientsMap.get(row.client_id).children.push({
          name: `${row.first_name} ${row.last_name}`.trim(),
          attributes: { 
            allocation: `${row.allocation_percentage}%`,
            role: row.role_in_client 
          }
        });
      }
    });

    return Array.from(clientsMap.values());
  }

  async getEmployeeDetails(employeeId: string) {
    // 1. Basic Info
    const empRes = await pool.query('SELECT * FROM employees WHERE id = $1', [employeeId]);
    console.log("empRes",empRes)
    if (empRes.rows.length === 0) throw new Error('Employee not found');
    const employee = empRes.rows[0];

    const managerRes = await pool.query('SELECT id, first_name, last_name FROM employees WHERE id = $1', [employee.manager_id]);
    const reportsRes = await pool.query('SELECT id, first_name, last_name FROM employees WHERE manager_id = $1', [employeeId]);

    // 3. Client Allocations
    const allocRes = await pool.query(`
      SELECT c.name as client_name, ca.allocation_percentage, ca.role_in_client
      FROM client_allocations ca
      JOIN clients c ON ca.client_id = c.id
      WHERE ca.employee_id = $1
    `, [employeeId]);

    return {
      employee,
      org: {
        manager: managerRes.rows[0] || null,
        reports: reportsRes.rows
      },
      allocations: allocRes.rows
    };
  }

  async updateAllocation(managerId: string, employeeId: string, clientId: string, percentage: number, role: string) {
 
    const rbacRes = await pool.query(`
      WITH RECURSIVE subordinates AS (
        SELECT id FROM employees WHERE manager_id = $1
        UNION
        SELECT e.id FROM employees e
        INNER JOIN subordinates s ON s.id = e.manager_id
      )
      SELECT id FROM subordinates WHERE id = $2
    `, [managerId, employeeId]);

   
    if (rbacRes.rows.length === 0 && managerId !== employeeId) {
   
       throw new Error('Unauthorized: You can only manage your direct or indirect reports.');
    }

    await pool.query(`
      INSERT INTO client_allocations (employee_id, client_id, allocation_percentage, role_in_client, assigned_by_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (employee_id, client_id) DO UPDATE SET
        allocation_percentage = EXCLUDED.allocation_percentage,
        role_in_client = EXCLUDED.role_in_client,
        assigned_by_id = EXCLUDED.assigned_by_id,
        updated_at = CURRENT_TIMESTAMP
    `, [employeeId, clientId, percentage, role, managerId]);

    return { success: true };
  }
}
