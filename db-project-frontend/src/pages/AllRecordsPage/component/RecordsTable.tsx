// AllRecordsPage/components/RecordsTable.tsx
interface RecordsTableProps {
  version: "admin" | "police" | "user" | null;
  records?: any[];
  selectedRecords?: number[];
  onCheckboxChange?: (id: number, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
}

function RecordsTable({
  version,
  records = [],
  selectedRecords = [],
  onCheckboxChange,
  onSelectAll,
}: RecordsTableProps) {
  const headers =
    version === "admin"
      ? ["Agent ID", "Branch ID", "Username", "Password", "Branch Contact #", "Date of Creation"]
      : ["Crime ID", "Zone Name", "Reg. Branch ID", "Reporter CNIC", "Crime Type", "Date"];

  const allSelected = selectedRecords.length === records.length && records.length > 0;

  return (
    <div className="w-full bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto overflow-y-auto max-h-[500px] rounded-b-lg">
        <table className="min-w-full text-left border-collapse text-xs sm:text-sm">
          <thead className="sticky top-0 bg-[#237E54] text-white text-sm whitespace-nowrap">
            <tr>
              {/* Checkbox for select all */}
              <th className="px-2 sm:px-4 py-3 border-b">
                {onSelectAll && (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                  />
                )}
              </th>
              {headers.map((header) => (
                <th key={header} className="px-2 sm:px-4 py-3 font-medium border-b">
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {records.length > 0 ? (
              records.map((record) => {
                const isChecked = selectedRecords.includes(record.id || record.agentId);

                if (version === "admin") {
                  return (
                    <tr
                      key={record.agentId}
                      className={`text-sm hover:bg-gray-100 ${
                        record.agentId % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">
                        {onCheckboxChange && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) =>
                              onCheckboxChange?.(record.agentId, e.target.checked)
                            }
                          />
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">{record.agentId}</td>
                      <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">{record.branchId}</td>
                      <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">{record.username}</td>
                      <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">{record.password}</td>
                      <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">{record.branchContact ?? "-"}</td>
                      <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                }

                // Police/crime version
                return (
                  <tr
                    key={record.id}
                    className={`text-sm hover:bg-gray-100 ${
                      record.id % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                    <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">
                      {onCheckboxChange && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            onCheckboxChange?.(record.id, e.target.checked)
                          }
                        />
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">{record.id}</td>
                    <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">{record.zoneName}</td>
                    <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">{record.registeredBranchId ?? "-"}</td>
                    <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">{record.submitterCnic ?? "-"}</td>
                    <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">{record.crimeTypeName}</td>
                    <td className="px-2 sm:px-4 py-3 border-b whitespace-nowrap">
                      {new Date(record.incidentDate).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={headers.length + 1} className="text-center py-6 text-gray-500">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RecordsTable;
