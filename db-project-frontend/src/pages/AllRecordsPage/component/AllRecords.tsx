import { useEffect, useState } from "react";
import RecordsTable from "./RecordsTable";
import GreenButton from "../../../components/GreenButton";
import AllRecordsSearch from "./AllRecordsSearch";
import DetailsPopup from "./DetailsPopup"
import { downloadCSV } from "./downloadCSV";
import { API_BASE_URL } from "../../../config/constants";

interface AllRecordsProps {
  version: "admin" | "police" | "user" | null;
}

// Admin agent record interface
export interface AgentRecord {
  agentId: number;
  branchId: number | null;
  username: string;
  password: string;
  branchContact: string | null;
  createdAt: string; // YYYY-MM-DD
}
export interface CrimeRecord {
  id: number;
  zoneName: string;
  registeredBranchId: number | null;
  submitterCnic: string | null;
  crimeTypeName: string;
  incidentDate: string; // YYYY-MM-DD
}

export default function AllRecords({ version }: AllRecordsProps) {

  const [records, setRecords] = useState<CrimeRecord[]>([]);
  const [backupRecords, setBackupRecords] = useState<CrimeRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<number[]>([]);

  // Modal state
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  // const [updateRecord, setUpdateRecord] = useState<CrimeRecord | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentRecord | null>(null);
  // For full crime details
  interface FullCrimeDetails {
    id: number;
    title: string;
    description: string;
    address: string;
    zoneId: number;
    latitude: number;
    longitude: number;
  }

  const [fullCrime, setFullCrime] = useState<FullCrimeDetails | null>(null);
  // ---------------------------
  // FETCH DATA
  // ---------------------------
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        let res, data;

        if (version === "police") {
          res = await fetch(`${API_BASE_URL}/crimes/all`);
          if (!res.ok) throw new Error("Network response was not ok");
          data = await res.json();
          if (!mounted) return;

          if (data.success) {
            setRecords(data.data);
            setBackupRecords(data.data);
          } else {
            console.error("Error fetching crimes:", data.message);
          }
        } else if (version === "admin") {
          res = await fetch(`${API_BASE_URL}/agent/all`);
          if (!res.ok) throw new Error("Network response was not ok");
          data = await res.json();
          if (!mounted) return;

          if (data.success) {
            setRecords(data.data);
            setBackupRecords(data.data);
          } else {
            console.error("Error fetching agents:", data.message);
          }
        }
      } catch (err) {
        console.error("Fetch Request Error:", err);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [version]);

  // ---------------------------
  // SEARCH HANDLER
  // ---------------------------
  const handleSearch = (searchBy: string, value: string) => {
    if (!value.trim() || searchBy === "") {
      setRecords(backupRecords);
      setSelectedRecords([]);
      return;
    }

    const filtered = backupRecords.filter((item: any) => {
      const fieldValue = item[searchBy];
      if (fieldValue === null || fieldValue === undefined) return false;

      // DATE SEARCH
      if (searchBy === "incidentDate" || searchBy === "createdAt") {
        const itemDate = new Date(fieldValue);
        const searchDate = new Date(value);
        return (
          itemDate.getFullYear() === searchDate.getFullYear() &&
          itemDate.getMonth() === searchDate.getMonth() &&
          itemDate.getDate() === searchDate.getDate()
        );
      }

      // NUMBER SEARCH
      if (typeof fieldValue === "number") return String(fieldValue) === value;

      // STRING SEARCH (exact match, case-insensitive)
      return String(fieldValue).toLowerCase() === value.toLowerCase();
    });

    setRecords(filtered);
    setSelectedRecords([]);
  };

  // ---------------------------
  // HANDLE ROW SELECTION
  // ---------------------------
  const handleCheckboxChange = (id: number, checked: boolean) => {
    setSelectedRecords((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };
  const handleSelectAll = (checked: boolean) => {
    setSelectedRecords(checked ? records.map((r: any) => r.id ?? r.agentId) : []);
  };

  const handleBulkDelete = async () => {
    if (!selectedRecords.length) return;
    if (!confirm(`Are you sure you want to delete ${selectedRecords.length} record(s)?`))
      return;

    try {
      await Promise.all(
        selectedRecords.map((id) => {
          const url =
            version === "admin"
              ? `${API_BASE_URL}/agent/delete/${id}`
              : `${API_BASE_URL}/crimes/delete/${id}`;
          return fetch(url, { method: "DELETE" });
        })
      );

      const newRecords = records.filter(
        (r: any) => !(selectedRecords.includes(r.id ?? r.agentId))
      );
      setRecords(newRecords);
      setBackupRecords(newRecords);
      setSelectedRecords([]);
    } catch (err) {
      console.error("Error deleting records:", err);
    }
  };


  // ---------------------------
  // OPEN UPDATE MODAL
  // ---------------------------
  const handleBulkUpdate = async () => {
    if (selectedRecords.length !== 1) {
      alert("Please select exactly one record to update.");
      return;
    }

    const recordId = selectedRecords[0];

    if (version === "admin") {
      const agent = (records as unknown as AgentRecord[]).find(
        (r) => r.agentId === recordId
      );

      if (!agent) return;
      setSelectedAgent(agent);
      setIsUpdateModalOpen(true);
    } else {
      try {
        const res = await fetch(`${API_BASE_URL}/crimes/get-crime/${recordId}`);
        const data = await res.json();
        if (!data.success) {
          alert("Failed to load crime details.");
          return;
        }
        const c = data.data;
        setFullCrime({
          id: c.id,
          title: c.title,
          description: c.description,
          address: c.address,
          zoneId: c.zoneId,
          latitude: c.location?.coordinates?.[1] ?? 0,
          longitude: c.location?.coordinates?.[0] ?? 0,
        });
        setIsUpdateModalOpen(true);
      } catch (err) {
        console.error("Error fetching crime details:", err);
        alert("Error fetching crime details.");
      }
    }
  };

  // ---------------------------
  // HANDLE UPDATE SUBMIT
  // ---------------------------
  const handleUpdateSubmit = async (updatedData: any) => {
    try {
      if (version === "admin" && selectedAgent) {
        const res = await fetch(
          `${API_BASE_URL}/agent/update/${selectedAgent.agentId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedData),
          }
        );
        const data = await res.json();
        if (!data.success) {
          alert("Update failed: " + data.message);
          return;
        }
        const newList = records.map((r: any) =>
          r.agentId === selectedAgent.agentId ? updatedData : r
        );
        setRecords(newList);
        setBackupRecords(newList);
        setSelectedRecords([]);
        setSelectedAgent(null);
      } else if (version === "police" && fullCrime) {
        const res = await fetch(`${API_BASE_URL}/crimes/update/${fullCrime.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedData),
        });
        const data = await res.json();
        if (!data.success) {
          alert("Update failed: " + data.message);
          return;
        }
        const newList = records.map((r: any) =>
          r.id === fullCrime.id ? { ...r, zoneId: fullCrime.zoneId } : r
        );
        setRecords(newList);
        setBackupRecords(newList);
        setSelectedRecords([]);
        setFullCrime(null);
      }
      setIsUpdateModalOpen(false);
    } catch (err) {
      console.error("Update error:", err);
      alert("Error updating entry.");
    }
  };

  return (
    <section className="flex flex-row min-h-screen w-full">
      <div className="flex flex-col gap-y-4 p-4 w-full overflow-y-auto">
        <div className="bg-[#fefefe] p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] flex flex-col gap-y-4 min-h-screen">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 w-full">
            <div className="flex flex-col gap-y-2 min-w-0">
              {version === "admin" ? (
                <>
                  <div className="font-outfit font-semibold text-2xl sm:text-4xl text-black">
                    All Agents Records
                  </div>
                  <div className="font-outfit text-sm sm:text-md text-[#A0A0A0]">
                    A complete list of all agents and their credentials stored in the system database.
                  </div>
                </>
              ) : (
                <>
                  <div className="font-outfit font-semibold text-2xl sm:text-4xl text-black">
                    All Crime Records
                  </div>
                  <div className="font-outfit text-sm sm:text-md text-[#A0A0A0]">
                    A complete list of all crime reports stored in the system database.
                  </div>
                </>
              )}
            </div>

            <div className="shrink-0">
              <GreenButton label="Download CSV" width={200} height={40} rounded="full" onClick={() => downloadCSV(version, records)}/>
            </div>
          </div>

          {/* 🔍 SEARCH BAR + BULK ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <AllRecordsSearch version={version} onSearchChange={handleSearch} />

            {selectedRecords.length > 0 && (
              <div className="bg-white p-4 rounded-xl shadow-[0_0_5px_rgba(0,0,0,0.15)] mb-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={handleBulkDelete}
                  className="bg-[#b80404] cursor-pointer text-white px-4 py-2 min-w-[100px] sm:w-[125px] rounded-[5px] font-outfit text-sm hover:bg-red-900"
                >
                  Delete
                </button>
                <button
                  onClick={handleBulkUpdate}
                  className="bg-[#237E54] cursor-pointer text-white px-4 py-2 min-w-[100px] sm:w-[125px] rounded-[5px] font-outfit text-sm hover:bg-[#1d6b48]"
                >
                  Update
                </button>
              </div>
            )}
          </div>

          {/* 📄 RECORDS TABLE */}
          <div>
            <RecordsTable
              version={version}
              records={records}
              selectedRecords={selectedRecords}
              onCheckboxChange={handleCheckboxChange}
              onSelectAll={handleSelectAll}
            />
          </div>
        </div>
      </div>

      {/* ------------------- UPDATE MODAL ------------------- */}
      <DetailsPopup
        version={version === "admin" ? "admin" : "police"}
        isOpen={isUpdateModalOpen}
        data={version === "admin" ? selectedAgent : fullCrime}
        onClose={() => {
          setIsUpdateModalOpen(false);
          setFullCrime(null);
          setSelectedAgent(null);
        }}
        onSubmit={handleUpdateSubmit}
      />
    </section>
  );
}
