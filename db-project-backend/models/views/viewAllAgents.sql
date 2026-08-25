CREATE OR REPLACE VIEW public."viewAllAgents" with (security_invoker = on) AS
SELECT 
    par.id AS "agentId",
    u.username AS "username",
    z.name AS "zoneName",
    par."branchId" AS "branchId",
    pb."contactNumber" AS "branchContact",
    par."createdAt" AS "createdAt"
FROM "PoliceAgentRequest" par
LEFT JOIN "User" u ON u.id = par."userId"
LEFT JOIN "PoliceBranch" pb ON pb.id = par."branchId"
LEFT JOIN "Zone" z ON z.id = pb."zoneId"
WHERE par.status = 'approved'
ORDER BY par.id ASC;
