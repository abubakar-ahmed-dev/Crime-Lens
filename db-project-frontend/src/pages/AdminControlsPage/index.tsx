import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import GreenButton from "../../components/GreenButton";
import WhiteButton from "../../components/WhiteButton";
import LocationPicker, { isValidLocation } from "../../components/LocationPicker";
import { API_BASE_URL } from "../../config/constants";
import { getJwtAuthHeaders } from "../../utils/authHeaders";

type Branch = {
  id: number;
  name: string;
  address: string;
  contactNumber: string;
  zoneId: number;
  zoneName: string;
  branchHeadUserId: number | null;
  branchHeadUsername: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  agentCount: number;
};

type PoliceAgent = {
  userId: number;
  username: string;
  agentRequestId: number;
  branchId: number;
  branchName: string;
  isBranchHead: boolean;
};

type Zone = {
  id: number;
  name: string;
};

const emptyBranchForm = {
  name: "",
  zoneId: "",
  address: "",
  contactNumber: "",
  latitude: "",
  longitude: "",
};

export default function AdminControlsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [agents, setAgents] = useState<PoliceAgent[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [branchForm, setBranchForm] = useState(emptyBranchForm);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingBranch, setSavingBranch] = useState(false);
  const [assigningHead, setAssigningHead] = useState(false);
  const [clearingHead, setClearingHead] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch.id) === selectedBranchId),
    [branches, selectedBranchId]
  );

  const assignedAgents = useMemo(
    () => agents.filter((agent) => String(agent.branchId) === selectedBranchId),
    [agents, selectedBranchId]
  );

  const isSelectedCurrentHead =
    !!selectedBranch?.branchHeadUserId &&
    String(selectedBranch.branchHeadUserId) === selectedAgentId;

  const hasExistingHead = !!selectedBranch?.branchHeadUserId;
  const assignButtonLabel = assigningHead
    ? hasExistingHead
      ? "Replacing..."
      : "Assigning..."
    : hasExistingHead
      ? "Replace Head"
      : "Assign Head";

  const availableZones = useMemo(() => {
    const occupiedZoneIds = new Set(branches.map((branch) => Number(branch.zoneId)));
    return zones.filter((zone) => !occupiedZoneIds.has(Number(zone.id)));
  }, [branches, zones]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [branchesResponse, agentsResponse, zonesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/branches`, { headers: getJwtAuthHeaders() }),
        fetch(`${API_BASE_URL}/admin/police-agents`, { headers: getJwtAuthHeaders() }),
        fetch(`${API_BASE_URL}/zones`),
      ]);

      const [branchesData, agentsData, zonesData] = await Promise.all([
        branchesResponse.json(),
        agentsResponse.json(),
        zonesResponse.json(),
      ]);

      if (!branchesResponse.ok || !branchesData.success) {
        throw new Error(branchesData.message || "Failed to load branches");
      }
      if (!agentsResponse.ok || !agentsData.success) {
        throw new Error(agentsData.message || "Failed to load police agents");
      }
      if (!zonesResponse.ok) {
        throw new Error("Failed to load zones");
      }

      setBranches(branchesData.data || []);
      setAgents(agentsData.data || []);
      setZones(Array.isArray(zonesData) ? zonesData : []);
    } catch (err: any) {
      setError(err.message || "Failed to load admin controls");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBranchChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setBranchForm((prev) => ({ ...prev, [name]: value }));
    setError("");
    setMessage("");
  };

  const createBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (
      !branchForm.name ||
      !branchForm.zoneId ||
      !branchForm.address ||
      !branchForm.contactNumber
    ) {
      setError("Please fill in all branch fields.");
      return;
    }

    if (!isValidLocation({ latitude: branchForm.latitude, longitude: branchForm.longitude })) {
      setError("Please provide a valid branch location.");
      return;
    }

    setSavingBranch(true);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/branches`, {
        method: "POST",
        headers: getJwtAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(branchForm),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create branch");
      }

      setMessage("Branch created successfully.");
      setBranchForm(emptyBranchForm);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create branch");
    } finally {
      setSavingBranch(false);
    }
  };

  const assignHead = async () => {
    setError("");
    setMessage("");

    if (!selectedBranchId || !selectedAgentId) {
      setError("Please select a branch and a police agent.");
      return;
    }

    setAssigningHead(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/branches/${selectedBranchId}/head`,
        {
          method: "PUT",
          headers: getJwtAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ userId: selectedAgentId }),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to assign branch head");
      }

      setMessage("Branch head assigned successfully.");
      setSelectedAgentId("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to assign branch head");
    } finally {
      setAssigningHead(false);
    }
  };

  const clearHead = async () => {
    setError("");
    setMessage("");

    if (!selectedBranchId) {
      setError("Please select a branch.");
      return;
    }

    setClearingHead(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/branches/${selectedBranchId}/head`,
        {
          method: "PUT",
          headers: getJwtAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ userId: null }),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to clear branch head");
      }

      setMessage("Branch head cleared.");
      setSelectedAgentId("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to clear branch head");
    } finally {
      setClearingHead(false);
    }
  };

  return (
    <section className="flex flex-row min-h-screen w-full">
      <div className="flex flex-col gap-y-4 p-4 w-full overflow-y-auto">
        <div className="bg-[#fefefe] p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] flex flex-col gap-y-2">
          <h1 className="font-outfit font-semibold text-2xl sm:text-4xl text-black">
            Admin Controls
          </h1>
          <p className="font-outfit text-sm sm:text-md text-[#A0A0A0]">
            Create police branches and assign approved police agents as branch heads.
          </p>
        </div>

        {(error || message) && (
          <div
            className={`p-3 rounded-lg border font-outfit text-sm ${
              error
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-green-50 border-green-200 text-[#145332]"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
          <form
            onSubmit={createBranch}
            className="bg-white rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] p-4 sm:p-6 font-outfit"
          >
            <div className="flex flex-col gap-1 mb-5">
              <h2 className="font-semibold text-xl text-gray-900">Create New Branch</h2>
              <p className="text-sm text-[#A0A0A0]">
                Add a branch for a zone that does not already have one.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="font-medium text-gray-700 mb-1">Branch Name</label>
                <input
                  name="name"
                  value={branchForm.name}
                  onChange={handleBranchChange}
                  disabled={savingBranch}
                  className="border border-[#d9d9d9] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter branch name"
                />
              </div>

              <div className="flex flex-col">
                <label className="font-medium text-gray-700 mb-1">Zone</label>
                <select
                  name="zoneId"
                  value={branchForm.zoneId}
                  onChange={handleBranchChange}
                  disabled={savingBranch}
                  className="border border-[#d9d9d9] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select a zone</option>
                  {availableZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.id} - {zone.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="font-medium text-gray-700 mb-1">Contact Number</label>
                <input
                  name="contactNumber"
                  value={branchForm.contactNumber}
                  onChange={handleBranchChange}
                  disabled={savingBranch}
                  className="border border-[#d9d9d9] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter branch contact"
                />
              </div>

              <div className="flex flex-col">
                <label className="font-medium text-gray-700 mb-1">Address</label>
                <input
                  name="address"
                  value={branchForm.address}
                  onChange={handleBranchChange}
                  disabled={savingBranch}
                  className="border border-[#d9d9d9] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter branch address"
                />
              </div>
            </div>

            <div className="mt-5">
              <label className="block font-medium text-gray-700 mb-2">Branch Location</label>
              <LocationPicker
                value={{
                  latitude: branchForm.latitude,
                  longitude: branchForm.longitude,
                }}
                onChange={(location) => {
                  setBranchForm((prev) => ({ ...prev, ...location }));
                  setError("");
                  setMessage("");
                }}
                disabled={savingBranch}
              />
            </div>

            <div className="flex justify-end mt-6">
              <GreenButton
                type="submit"
                label={savingBranch ? "Creating..." : "Create Branch"}
                width={180}
                height={42}
                disabled={savingBranch}
              />
            </div>
          </form>

          <div className="bg-white rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] p-4 sm:p-6 font-outfit">
            <div className="flex flex-col gap-1 mb-5">
              <h2 className="font-semibold text-xl text-gray-900">Assign Branch Head</h2>
              <p className="text-sm text-[#A0A0A0]">
                Choose from approved police agents assigned to the selected branch.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className="font-medium text-gray-700 mb-1">Branch</label>
                <select
                  value={selectedBranchId}
                  onChange={(event) => {
                    setSelectedBranchId(event.target.value);
                    setSelectedAgentId("");
                    setError("");
                    setMessage("");
                  }}
                  className="border border-[#d9d9d9] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select a branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.id} - {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-gray-50 border border-[#e8e8e8] rounded-lg p-3 text-sm">
                <div className="text-gray-500">Current Head</div>
                <div className="font-medium text-gray-900">
                  {selectedBranch?.branchHeadUsername || "No branch head assigned"}
                </div>
              </div>

              <div className="flex flex-col">
                <label className="font-medium text-gray-700 mb-1">Police Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={(event) => setSelectedAgentId(event.target.value)}
                  disabled={!selectedBranchId || assignedAgents.length === 0}
                  className="border border-[#d9d9d9] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                >
                  <option value="">
                    {!selectedBranchId
                      ? "Select a branch first"
                      : assignedAgents.length === 0
                        ? "No assigned agents available"
                        : "Select an agent"}
                  </option>
                  {assignedAgents.map((agent) => (
                    <option key={agent.userId} value={agent.userId}>
                      {agent.username}
                      {String(selectedBranch?.branchHeadUserId) === String(agent.userId)
                        ? " (Current Head)"
                        : ""}
                    </option>
                  ))}
                </select>
                {selectedBranchId && assignedAgents.length === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
                    This branch does not have any approved police agents assigned yet.
                    Approve or move an agent to this branch before assigning a branch head.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <GreenButton
                  label={assignButtonLabel}
                  width={160}
                  height={40}
                  onClick={assignHead}
                  disabled={
                    assigningHead ||
                    clearingHead ||
                    !selectedBranchId ||
                    !selectedAgentId ||
                    isSelectedCurrentHead
                  }
                />
                <WhiteButton
                  label={clearingHead ? "Removing head..." : "Clear Head"}
                  width={clearingHead ? 175 : 140}
                  height={40}
                  onClick={clearHead}
                  disabled={assigningHead || clearingHead || !selectedBranchId || !hasExistingHead}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] p-4 sm:p-6 font-outfit">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-xl text-gray-900">Existing Branches</h2>
              <p className="text-sm text-[#A0A0A0]">
                Review branch zones, heads, and agent counts.
              </p>
            </div>
            <WhiteButton label="Refresh" width={110} height={38} onClick={loadData} />
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading branches...</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#e8e8e8]">
              <table className="min-w-full text-left border-collapse text-sm">
                <thead className="bg-[#237E54] text-white whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 font-medium">Branch ID</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Zone</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Head</th>
                    <th className="px-4 py-3 font-medium">Agents</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.length > 0 ? (
                    branches.map((branch) => (
                      <tr key={branch.id} className="odd:bg-white even:bg-gray-50">
                        <td className="px-4 py-3 border-b">{branch.id}</td>
                        <td className="px-4 py-3 border-b">{branch.name}</td>
                        <td className="px-4 py-3 border-b">
                          {branch.zoneId} - {branch.zoneName}
                        </td>
                        <td className="px-4 py-3 border-b">{branch.contactNumber}</td>
                        <td className="px-4 py-3 border-b">
                          {branch.branchHeadUsername || "-"}
                        </td>
                        <td className="px-4 py-3 border-b">{branch.agentCount}</td>
                        <td className="px-4 py-3 border-b whitespace-nowrap">
                          {branch.latitude && branch.longitude
                            ? `${Number(branch.latitude).toFixed(5)}, ${Number(branch.longitude).toFixed(5)}`
                            : "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        No branches found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
