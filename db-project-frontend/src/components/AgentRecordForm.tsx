export type AgentRecordFormValue = {
  username: string;
  branchId: string | number;
};

export type AgentBranchOption = {
  id: number;
  name?: string;
  zoneName?: string;
};

type AgentRecordFormProps = {
  value: AgentRecordFormValue;
  branches: AgentBranchOption[];
  onChange: (field: keyof AgentRecordFormValue, value: string | number) => void;
};

const formatBranchLabel = (branch: AgentBranchOption) =>
  branch.zoneName ? `${branch.id} - ${branch.zoneName}` : `${branch.id}`;

export default function AgentRecordForm({
  value,
  branches,
  onChange,
}: AgentRecordFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <label className="text-sm font-medium text-gray-700">Username</label>
        <input
          type="text"
          value={value.username}
          onChange={(e) => onChange("username", e.target.value)}
          className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border"
        />
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <label className="text-sm font-medium text-gray-700">Branch</label>
        <select
          value={value.branchId}
          onChange={(e) => onChange("branchId", Number(e.target.value))}
          className="w-full text-sm bg-gray-100 mt-1 p-2 rounded border"
        >
          <option value="">Select branch</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {formatBranchLabel(branch)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
