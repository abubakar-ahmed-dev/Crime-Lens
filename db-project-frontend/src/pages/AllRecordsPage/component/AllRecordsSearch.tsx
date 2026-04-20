import { useState } from "react";

interface AllRecordsSearchProps {
  version: "admin" | "police" | "user" | null;
  onSearchChange: (searchBy: string, value: string) => void;
}

export default function AllRecordsSearch({ version, onSearchChange }: AllRecordsSearchProps) {
  const [searchBy, setSearchBy] = useState("all"); // default to "all"
  const [value, setValue] = useState("");

  const handleSearch = () => {
    if (searchBy === "all" || value.trim() === "") {
      onSearchChange("", ""); // show all records
      return;
    }

    // For date fields, value is already in YYYY-MM-DD format
    const formattedValue = searchBy === "incidentDate" || searchBy === "createdAt" ? value : value.trim();

    onSearchChange(searchBy, formattedValue);
  };

  // Define dropdown options based on version
  const dropdownOptions =
    version === "admin"
      ? [
          { value: "agentId", label: "Agent ID" },
          { value: "branchId", label: "Branch ID" },
          { value: "username", label: "Username" },
          { value: "password", label: "Password" },
          { value: "branchContact", label: "Branch Contact #" },
          { value: "createdAt", label: "Date of Creation" },
        ]
      : [
          { value: "id", label: "Crime ID" },
          { value: "incidentDate", label: "Date" },
          { value: "zoneName", label: "Zone Name" },
          { value: "crimeTypeName", label: "Crime Type" },
          { value: "submitterCnic", label: "Submitter CNIC" },
          { value: "registeredBranchId", label: "Branch ID" },
        ];

  // Dynamic placeholder
  const placeholderText =
    searchBy === "incidentDate" || searchBy === "createdAt"
      ? "" // no placeholder for date
      : "Enter search value...";

  return (
    <div className="bg-white p-4 rounded-xl shadow mb-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-x-4 w-full">
      {/* Label */}
      <span className="text-gray-700 font-outfit text-sm shrink-0">Search by</span>

      {/* Dropdown */}
      <select
        className="border-2 border-[#ababab] cursor-pointer rounded-[5px] px-3 py-2 text-sm bg-gray-50 w-full sm:w-auto min-w-0"
        value={searchBy}
        onChange={(e) => {
          setSearchBy(e.target.value);
          setValue("");
        }}
      >
        <option value="all">-- All --</option>
        {dropdownOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Input field */}
      {(searchBy === "incidentDate" || searchBy === "createdAt") ? (
        <input
          type="date"
          className="border-2 border-[#ababab] cursor-text rounded-[5px] px-3 py-2 w-full sm:w-64 text-sm min-w-0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className="border-2 border-[#ababab] cursor-text rounded-[5px] px-3 py-2 w-full sm:w-64 text-sm min-w-0"
          placeholder={placeholderText}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={searchBy === "all"}
        />
      )}

      {/* Search Button */}
      <button
        onClick={handleSearch}
        className="bg-[#237E54] w-full sm:w-[125px] border-2 border-[#268b5e] cursor-pointer text-white px-4 py-2 rounded-[5px] font-outfit text-sm hover:bg-[#1d6b48] shrink-0"
      >
        Search
      </button>
    </div>
  );
}
