export const downloadCSV = (
    version: "admin" | "police" | "user" | null,
    records: any[]
  ) => {
  
    if (version !== "admin" && version !== "police") {
      alert("CSV download is only available for admin or police.");
      return;
    }
  
    if (!records || records.length === 0) {
      alert("No records available to download.");
      return;
    }
  
    let headers: string[] = [];
    let rows: string[][] = [];
  
    if (version === "admin") {
      headers = ["Agent ID", "Branch ID", "Username", "Password", "Branch Contact #", "Date of Creation"];
  
      rows = records.map((r: any) => [
        String(r.agentId ?? ""),
        String(r.branchId ?? ""),
        String(r.username ?? ""),
        String(r.password ?? ""),
        String(r.branchContact ?? ""),
        String(new Date(r.createdAt).toLocaleDateString()),
      ]);
  
    } else {
      headers = ["Crime ID", "Zone Name", "Reg. Branch ID", "Reporter CNIC", "Crime Type", "Date"];
  
      rows = records.map((r: any) => [
        String(r.id ?? ""),
        String(r.zoneName ?? ""),
        String(r.registeredBranchId ?? ""),
        String(r.submitterCnic ?? ""),
        String(r.crimeTypeName ?? ""),
        String(new Date(r.incidentDate).toLocaleDateString()),
      ]);
    }
  
    const csvContent =
      [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(","))
        .join("\n");
  
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
  
    const link = document.createElement("a");
    link.href = url;
    link.download = version === "admin"
      ? "All_Agent_Records.csv"
      : "All_Crime_Records.csv";
  
    link.click();
    URL.revokeObjectURL(url);
  };
  
