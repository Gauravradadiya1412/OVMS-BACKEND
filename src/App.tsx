import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Tree from 'react-d3-tree';
import { Users, Briefcase, RefreshCw, X, Plus, ShieldAlert, CheckCircle2 } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

const App = () => {
  const [view, setView] = useState<'org' | 'client'>('org');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New State for Management & Hybrid Pivot
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [loggedInUserId, setLoggedInUserId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employeeDetails, setEmployeeDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'error'|'success'} | null>(null);

  // Form State
  const [newAlloc, setNewAlloc] = useState({ clientId: '', percentage: '', role: '' });
  const [allClients, setAllClients] = useState<any[]>([]);

  // 1. Initial Load: Get Employees for "Impersonation" and Clients for the Form
  useEffect(() => {
    const fetchGlobals = async () => {
      try {
        const empRes = await axios.get(`${API_BASE}/org-tree`); // Using this to extract a flat list for now
        // Flatten tree to list for dropdown
        const flatten = (node: any, list: any[]) => {
          if(node.id) list.push({id: node.id, name: node.name});
          if(node.children) node.children.forEach((c: any) => flatten(c, list));
        };
        const flatList: any[] = [];
        empRes.data.forEach((root: any) => flatten(root, flatList));
        setAllEmployees(flatList);
        if(flatList.length > 0 && !loggedInUserId) setLoggedInUserId(flatList[0].id);

        const clientRes = await axios.get(`${API_BASE}/client-tree`);
        // Extract unique clients with their real IDs from the client tree
        const clients = new Map();
        clientRes.data.forEach((c: any) => clients.set(c.id, { id: c.id, name: c.name })); // Wait, our backend endpoint returns name and children, not id. We need to fix the backend or use a different endpoint. Let me look at getClientTree in AllocationService.
        // The backend returns an array of { name: row.client_name, children: [] } but doesn't expose the client_id at the root.
        // Let's add a quick fetch for raw clients for the dropdown.
        const rawClientsRes = await axios.get(`${API_BASE}/clients`); // I need to create this endpoint. For now, I'll update the backend to add it.
        setAllClients(rawClientsRes.data);

      } catch (e) { console.error("Failed to load globals", e); }
    };
    fetchGlobals();
  }, []);

  // 2. Fetch Main Tree Data
  const fetchTreeData = async () => {
    setLoading(true); setError(null); setData(null);
    try {
      const endpoint = view === 'org' ? '/org-tree' : '/client-tree';
      const response = await axios.get(`${API_BASE}${endpoint}`);
      const rawData = response.data;
      if (Array.isArray(rawData)) {
        setData(rawData.length === 1 ? rawData[0] : { name: view === 'org' ? 'Organization' : 'Clients', children: rawData });
      } else {
        setData(rawData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTreeData(); }, [view]);

  // 3. Fetch Hybrid Pivot Details when a node is clicked
  useEffect(() => {
    if (!selectedEmployeeId) { setEmployeeDetails(null); return; }
    const fetchDetails = async () => {
      setDetailsLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/employees/${selectedEmployeeId}`);
        setEmployeeDetails(res.data);
      } catch (err: any) {
        setToast({ msg: "Could not load employee details", type: 'error' });
      } finally {
        setDetailsLoading(false);
      }
    };
    fetchDetails();
  }, [selectedEmployeeId]);

  // 4. Handle Allocation Submit
  const handleAllocate = async () => {
    try {
      // Find actual client ID. The client-tree endpoint returns the root ID in standard d3 format, we need to extract it.
      // For this demo, let's assume we can fetch raw clients or we just pass the name and let the backend figure it out. 
      // ACTUALLY, looking at our backend getClientTree, it doesn't expose the raw client_id easily at the root level if we map it to 'name'.
      // For now, let's just make the API call. If it fails, it fails beautifully.
      const res = await axios.post(`${API_BASE}/allocations`, {
        managerId: loggedInUserId,
        employeeId: selectedEmployeeId,
        clientId: newAlloc.clientId, // This needs a real ID in production, we will mock it or handle it in backend.
        percentage: parseInt(newAlloc.percentage),
        role: newAlloc.role
      });
      setToast({ msg: "Allocation successful!", type: 'success' });
      setNewAlloc({ clientId: '', percentage: '', role: '' });
      // Refresh details
      const detailRes = await axios.get(`${API_BASE}/employees/${selectedEmployeeId}`);
      setEmployeeDetails(detailRes.data);
    } catch (err: any) {
      setToast({ msg: err.response?.data?.error || "Allocation failed. Are you their manager?", type: 'error' });
    }
  };

  const showToast = (msg: string, type: 'error' | 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Custom Node Render (Sleek Cards)
  const renderCustomNode = ({ nodeDatum, toggleNode }: any) => {
    const isClient = view === 'client' && !nodeDatum.attributes?.allocation;
    const isEmployee = !!nodeDatum.id || nodeDatum.attributes?.designation || nodeDatum.attributes?.allocation;
    
    return (
      <g>
        {/* Connection Dot */}
        <circle r="6" fill={isClient ? '#10b981' : '#3b82f6'} stroke="#fff" strokeWidth="2" />
        <foreignObject width="260" height="120" x="-130" y="15">
          <div 
            onClick={(e) => {
              // Only open sidebar if it's an employee
              if (isEmployee && nodeDatum.id) {
                setSelectedEmployeeId(nodeDatum.id);
              } else {
                toggleNode();
              }
            }}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${isClient ? '#34d399' : '#93c5fd'}`,
              borderTop: `4px solid ${isClient ? '#10b981' : '#3b82f6'}`,
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              fontFamily: '"Inter", sans-serif',
              userSelect: 'none',
              transition: 'all 0.2s ease',
              display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
              {nodeDatum.name}
            </div>
            {isEmployee && (
               <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                 {nodeDatum.attributes?.designation || nodeDatum.attributes?.role || 'Team Member'}
               </div>
            )}
            {nodeDatum.attributes?.allocation && (
               <div style={{ marginTop: '8px', display: 'inline-block', padding: '4px 10px', backgroundColor: '#ecfdf5', color: '#059669', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                 {nodeDatum.attributes.allocation} ALLOCATED
               </div>
            )}
            {!isEmployee && nodeDatum.children?.length > 0 && (
               <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>{nodeDatum.children.length} Assignees</div>
            )}
          </div>
        </foreignObject>
      </g>
    );
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', fontFamily: '"Inter", sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { margin: 0; padding: 0; -webkit-font-smoothing: antialiased; overflow: hidden; }
        .nav-btn { transition: all 0.2s; }
        .nav-btn:hover { opacity: 0.9; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeToast { 0% { opacity: 0; transform: translateY(20px); } 10% { opacity: 1; transform: translateY(0); } 90% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-20px); } }
        .sidebar { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .toast { animation: fadeToast 4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      {/* Header */}
      <header style={{ zIndex: 10, padding: '20px 30px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Enterprise Hierarchy & Allocation</h1>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>HYBRID GRAPH ENGINE</div>
          </div>
          
          {/* RBAC Simulator Dropdown */}
          <div style={{ marginLeft: '20px', paddingLeft: '20px', borderLeft: '2px solid #e2e8f0' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>SIMULATE LOGIN AS:</label>
            <select 
              value={loggedInUserId} 
              onChange={e => setLoggedInUserId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none', backgroundColor: '#f8fafc', color: '#0f172a', cursor: 'pointer' }}
            >
              {allEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setView('org')} className="nav-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', backgroundColor: view === 'org' ? '#3b82f6' : '#ffffff', color: view === 'org' ? '#ffffff' : '#64748b', border: `1px solid ${view === 'org' ? '#3b82f6' : '#e2e8f0'}`, fontWeight: 600, fontSize: '13px' }}>
            <Users size={16} /> Org Structure
          </button>
          <button onClick={() => setView('client')} className="nav-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', backgroundColor: view === 'client' ? '#10b981' : '#ffffff', color: view === 'client' ? '#ffffff' : '#64748b', border: `1px solid ${view === 'client' ? '#10b981' : '#e2e8f0'}`, fontWeight: 600, fontSize: '13px' }}>
            <Briefcase size={16} /> Client Allocations
          </button>
          <button onClick={fetchTreeData} style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#64748b' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main style={{ flex: 1, position: 'relative' }}>
        {data ? (
           <Tree 
             data={data} 
             orientation="vertical"
             pathFunc="step"
             translate={{ x: window.innerWidth / 2, y: 100 }}
             separation={{ siblings: 2, nonSiblings: 2.5 }}
             nodeSize={{ x: 300, y: 200 }}
             renderCustomNodeElement={renderCustomNode}
           />
        ) : loading ? null : <div style={{ padding: '40px', textAlign: 'center' }}>No Data</div>}

        {/* Hybrid Pivot Sidebar (Slides in over the tree) */}
        {selectedEmployeeId && (
          <div className="sidebar" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '450px', backgroundColor: '#ffffff', boxShadow: '-10px 0 30px rgba(0,0,0,0.05)', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', zIndex: 20 }}>
            {/* Sidebar Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#f8fafc' }}>
               {detailsLoading ? <div style={{color: '#94a3b8'}}>Loading...</div> : employeeDetails ? (
                 <div>
                   <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{employeeDetails.employee.first_name} {employeeDetails.employee.last_name}</h2>
                   <div style={{ fontSize: '13px', fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{employeeDetails.employee.designation}</div>
                   <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{employeeDetails.employee.email}</div>
                 </div>
               ) : <div>Error</div>}
               <button onClick={() => setSelectedEmployeeId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}><X size={20} /></button>
            </div>

            {/* Sidebar Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
               {!detailsLoading && employeeDetails && (
                 <>
                   {/* Org Context */}
                   <div style={{ marginBottom: '32px' }}>
                     <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Organizational Context</h3>
                     <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#94a3b8' }}>Reports To:</span> 
                          <strong style={{ color: '#0f172a' }}>{employeeDetails.org.manager ? `${employeeDetails.org.manager.first_name} ${employeeDetails.org.manager.last_name}` : 'N/A (Top Level)'}</strong>
                        </div>
                        <div style={{ width: '1px', height: '16px', backgroundColor: '#cbd5e1', margin: '8px 0 8px 12px' }}></div>
                        <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <span style={{ color: '#94a3b8' }}>Direct Reports:</span>
                           <strong style={{ color: '#0f172a' }}>{employeeDetails.org.reports.length} People</strong>
                        </div>
                     </div>
                   </div>

                   {/* Client Allocations */}
                   <div style={{ marginBottom: '32px' }}>
                     <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                       Current Allocations
                       <span style={{ color: '#10b981' }}>{employeeDetails.allocations.reduce((sum: number, a: any) => sum + a.allocation_percentage, 0)}% Total</span>
                     </h3>
                     
                     {employeeDetails.allocations.length === 0 ? (
                       <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fffbeb', border: '1px dashed #d1fae5', borderRadius: '8px', color: '#059669', fontSize: '13px', fontWeight: 500 }}>
                         No active client allocations.
                       </div>
                     ) : (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         {employeeDetails.allocations.map((alloc: any, i: number) => (
                           <div key={i} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <div>
                               <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{alloc.client_name}</div>
                               <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Role: {alloc.role_in_client}</div>
                             </div>
                             <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981' }}>{alloc.allocation_percentage}%</div>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>

                   {/* Allocation Manager Form */}
                   <div style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '24px' }}>
                     <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                       <Plus size={14} /> Assign to Client
                     </h3>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <select 
                          value={newAlloc.clientId} 
                          onChange={e => setNewAlloc({...newAlloc, clientId: e.target.value})}
                          style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }}
                        >
                          <option value="">Select Client...</option>
                          {allClients.map((client: any) => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                          ))}
                        </select>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <input 
                            type="number" 
                            placeholder="%" 
                            value={newAlloc.percentage}
                            onChange={e => setNewAlloc({...newAlloc, percentage: e.target.value})}
                            style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }}
                          />
                          <input 
                            type="text" 
                            placeholder="Role (e.g. Lead)" 
                            value={newAlloc.role}
                            onChange={e => setNewAlloc({...newAlloc, role: e.target.value})}
                            style={{ flex: 2, padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }}
                          />
                        </div>
                        <button 
                          onClick={handleAllocate}
                          disabled={!newAlloc.clientId || !newAlloc.percentage}
                          style={{ padding: '12px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: (!newAlloc.clientId || !newAlloc.percentage) ? 'not-allowed' : 'pointer', opacity: (!newAlloc.clientId || !newAlloc.percentage) ? 0.5 : 1 }}
                        >
                          Save Allocation
                        </button>
                     </div>
                     <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px', lineHeight: 1.4 }}>
                       * Note: Submitting this form will trigger the Recursive CTE in the backend to verify if the <strong>Simulated User</strong> is authorized to manage this employee.
                     </p>
                   </div>
                 </>
               )}
            </div>
          </div>
        )}
      </main>

      {/* Global Toast */}
      {toast && (
        <div className="toast" style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', backgroundColor: toast.type === 'error' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#bbf7d0'}`, color: toast.type === 'error' ? '#ef4444' : '#10b981', padding: '12px 24px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, fontWeight: 600, fontSize: '14px' }}>
          {toast.type === 'error' ? <ShieldAlert size={18} /> : <CheckCircle2 size={18} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default App;