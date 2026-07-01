create view public."viewAllAgents" with (security_invoker = on)  AS
SELECT 
    par.id AS "agentId",
    par."branchId" AS "branchId",
    u.username AS "username",
    u."passwordHash" AS "password",
    pb."contactNumber" AS "branchContact",
    par."createdAt" AS "createdAt"
FROM "PoliceAgentRequest" par
LEFT JOIN "User" u ON u.id = par."userId"
LEFT JOIN "PoliceBranch" pb ON pb.id = par."branchId"
WHERE par.status = 'approved'
ORDER BY par.id ASC;