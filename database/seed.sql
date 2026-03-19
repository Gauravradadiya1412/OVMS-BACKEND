

-- 1. Insert Clients
INSERT INTO clients (id, zoho_id, name) VALUES 
('c126ebe6-c6fa-4434-894f-591d3d98c9b1', '306416000000306001', 'Wickes'),
('66eebdc9-b513-404c-b6e4-65cbb2703f34', '306416000000318001', 'FW Webb')
ON CONFLICT (zoho_id) DO NOTHING;


INSERT INTO employees (id, zoho_id, first_name, last_name, email, designation, manager_id) VALUES 
('c48ec48c-c692-49df-8730-a9cb57b77cfc', '306416000000294005', 'Gaurav Radadiya', '', 'gauravradadiya223@gmail.com', 'CEO', NULL),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '306416000000300051', 'Bunty', '', 'christopherbrown@zylker.com', 'Administration', 'c48ec48c-c692-49df-8730-a9cb57b77cfc'),
('b2c3d4e5-f6a7-8901-bcde-f12345678901', '306416000000300049', 'Vaibhav', '', 'michaeljohnson@zylker.com', 'Administration', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
('c3d4e5f6-a7b8-9012-cdef-123456789012', '306416000000300017', 'Rahul', 'Sharma', 'clarksonwalter@zylker.com', 'Administration', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
('d4e5f6a7-b8c9-0123-defg-123456789012', '306416000000300015', 'Sneha', 'Reddy', 'lillywilliams@zylker.com', 'Administration', 'c48ec48c-c692-49df-8730-a9cb57b77cfc')
ON CONFLICT (zoho_id) DO NOTHING;


INSERT INTO client_allocations (employee_id, client_id, allocation_percentage, role_in_client, assigned_by_id) VALUES 
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'c126ebe6-c6fa-4434-894f-591d3d98c9b1', 50, 'Account Lead', 'c48ec48c-c692-49df-8730-a9cb57b77cfc'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '66eebdc9-b513-404c-b6e4-65cbb2703f34', 50, 'Project Advisor', 'c48ec48c-c692-49df-8730-a9cb57b77cfc')
ON CONFLICT DO NOTHING;
