-- Example slow query with a full table scan
SELECT * FROM orders;

-- Example slow query with a NULL value equality check
SELECT 
    name 
FROM orders 
WHERE id = NULL;
