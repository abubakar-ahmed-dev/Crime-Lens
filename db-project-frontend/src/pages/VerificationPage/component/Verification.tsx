////VerificationPage/components/Verification.tsx
import { useState, useEffect } from "react";
import VerificationCard from "./VerificationCard";
import { API_BASE_URL } from "../../../config/constants";

interface AllRecordsProps {
  version: "admin" | "police" | "user" | null;
}

export default function AllRecords({ version }: AllRecordsProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch pending records on mount
  useEffect(() => {
    fetchRecords();
  }, [version]);

  const fetchRecords = async () => {
    setLoading(true);
    setError("");

    try {
      let endpoint = "";

      if (version === "admin") {
        endpoint = `${API_BASE_URL}/agent/pending`;
      } else {
        endpoint = `${API_BASE_URL}/user/pending`;
      }

      const response = await fetch(endpoint);
      const data = await response.json();

      if (data.success) {
        setRecords(data.data || []);
      } else {
        setError(data.message || "Failed to fetch records");
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle successful approval/rejection
  const handleRecordProcessed = () => {
    fetchRecords(); // Refresh the list
  };

  return (
    <section className="flex flex-row min-h-screen w-full">
      <div className="flex flex-col gap-y-4 p-4 w-full overflow-y-auto">
        {/* Top section with title */}
        <div className="bg-[#fefefe] p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] flex flex-col gap-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start w-full">
            <div className="flex flex-col gap-y-2">
              {version === "admin" ? (
                <>
                  <div className="font-outfit font-semibold text-2xl sm:text-4xl text-black">
                    Verify New Agent
                  </div>
                  <div className="font-outfit text-sm sm:text-md text-[#A0A0A0]">
                    Review and authorize a new agent registration requests
                    submitted by police branches.
                  </div>
                </>
              ) : (
                <>
                  <div className="font-outfit font-semibold text-2xl sm:text-4xl text-black">
                    Verify Report
                  </div>
                  <div className="font-outfit text-sm sm:text-md text-[#A0A0A0]">
                    Review newly submitted crime reports and verify their
                    authenticity before approval.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Records Section */}
        <div className="p-4 sm:p-6 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] flex justify-stretch">
          {loading ? (
            <div className="w-full flex items-center justify-center py-12">
              <p className="text-lg text-gray-600 font-outfit">Loading records...</p>
            </div>
          ) : error ? (
            <div className="w-full flex items-center justify-center py-12">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 font-outfit">{error}</p>
                <button
                  onClick={fetchRecords}
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : records.length === 0 ? (
            <div className="w-full flex items-center justify-center py-12">
              <p className="text-lg text-gray-400 font-outfit">
                No pending records to review.
              </p>
            </div>
          ) : (
            <div className="flex flex-col w-full h-fit gap-y-6">
              {version === "admin" ? (
                /* ADMIN VERSION - Agent Requests */
                records.map((record) => (
                  <VerificationCard
                    key={record.id}
                    version="admin"
                    requestId={record.id}
                    branchId={record.PoliceBranch?.id || "N/A"}
                    branchContact={record.PoliceBranch?.contactNumber || "N/A"}
                    username={record.PoliceAgentRequestsTemp?.username || ""}
                    password={record.PoliceAgentRequestsTemp?.password || ""}
                    requestDate={
                      record.PoliceAgentRequestsTemp?.createdAt
                        ? new Date(record.PoliceAgentRequestsTemp.createdAt).toLocaleDateString()
                        : "N/A"
                    }
                    onApprove={handleRecordProcessed}
                    onReject={handleRecordProcessed}
                  />
                ))
              ) : (
                /* POLICE VERSION - Crime Reports */
                records.map((record) => (
                  <VerificationCard
                    key={record.id}
                    version="police"

                    submissionId={record.submissionId}   // ✔ literal field

                    title={record.title || "No Title"}   // ✔ from Crime table

                    fullName={record.submitterName || "Unknown"}   // ✔ literal field
                    contact={record.submitterContact || "N/A"}     // ✔ literal field
                    cnic={record.submitterCnic || "N/A"}           // ✔ literal field

                    crimeType={record.CrimeType?.name || "Unknown"}   // ✔ still included
                    date={new Date(record.incidentDate).toLocaleDateString()}

                    address={record.address || ""}
                    description={record.description || ""}

                    zone={record.Zone?.id || record.zoneId}   // ✔ zone has ONLY id

                    onApprove={handleRecordProcessed}
                    onReject={handleRecordProcessed}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
// ////VerificationPage/components/Verification.tsx
// import { useState, useEffect } from "react";
// import BackButton from "../../../components/BackButton";
// import VerificationCard from "./VerificationCard";

// interface AllRecordsProps {
//   version: "admin" | "police" | "user" | null;
// }

// export default function AllRecords({ version }: AllRecordsProps) {
//   const [records, setRecords] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   // Fetch pending records on mount
//   useEffect(() => {
//     fetchRecords();
//   }, [version]);

//   const fetchRecords = async () => {
//     setLoading(true);
//     setError("");

//     try {
//       let endpoint = "";

//       if (version === "admin") {
//         endpoint = `${API_BASE_URL}/agent/pending`;
//       } else {
//         endpoint = `${API_BASE_URL}/user/pending`;
//       }

//       const response = await fetch(endpoint);
//       const data = await response.json();

//       if (data.success) {
//         setRecords(data.data || []);
//       } else {
//         setError(data.message || "Failed to fetch records");
//       }
//     } catch (err) {
//       console.error("Fetch Error:", err);
//       setError("Server error. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Handle successful approval/rejection
//   const handleRecordProcessed = () => {
//     fetchRecords(); // Refresh the list
//   };

//   return (
//     <section className="flex flex-row h-screen w-full">
//       <div className="flex flex-col gap-y-4 pl-76 p-4 w-full overflow-y-auto">
//         {/* Top section with title */}
//         <div className="bg-[#fefefe] p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] flex flex-col gap-y-4">
//           <div className="flex flex-row justify-between items-start w-full">
//             {/* Left Text Section */}
//             <div className="flex flex-col gap-y-2">
//               {version === "admin" ? (
//                 <>
//                   <div className="font-outfit font-semibold text-4xl text-black">
//                     Verify New Agent
//                   </div>
//                   <div className="font-outfit text-md text-[#A0A0A0]">
//                     Review and authorize a new agent registration requests
//                     submitted by police branches.
//                   </div>
//                 </>
//               ) : (
//                 <>
//                   <div className="font-outfit font-semibold text-4xl text-black">
//                     Verify Report
//                   </div>
//                   <div className="font-outfit text-md text-[#A0A0A0]">
//                     Review newly submitted crime reports and verify their
//                     authenticity before approval.
//                   </div>
//                 </>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* Records Section */}
//         <div className="p-6 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] flex justify-stretch">
//           {loading ? (
//             <div className="w-full flex items-center justify-center py-12">
//               <p className="text-lg text-gray-600 font-outfit">Loading records...</p>
//             </div>
//           ) : error ? (
//             <div className="w-full flex items-center justify-center py-12">
//               <div className="bg-red-50 border border-red-200 rounded-lg p-4">
//                 <p className="text-red-600 font-outfit">{error}</p>
//                 <button
//                   onClick={fetchRecords}
//                   className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
//                 >
//                   Retry
//                 </button>
//               </div>
//             </div>
//           ) : records.length === 0 ? (
//             <div className="w-full flex items-center justify-center py-12">
//               <p className="text-lg text-gray-400 font-outfit">
//                 No pending records to review.
//               </p>
//             </div>
//           ) : (
//             <div className="flex flex-col w-full h-fit gap-y-6">
//               {version === "admin" ? (
//                 /* ADMIN VERSION - Agent Requests */
//                 records.map((record) => (
//                   <VerificationCard
//                     key={record.id}
//                     version="admin"
//                     requestId={record.id}
//                     branchId={record.PoliceBranch?.id || "N/A"}
//                     branchContact={record.PoliceBranch?.contactNumber || "N/A"}
//                     username={record.PoliceAgentRequestsTemp?.username || ""}
//                     password={record.PoliceAgentRequestsTemp?.password || ""}
//                     requestDate={
//                       record.PoliceAgentRequestsTemp?.createdAt
//                         ? new Date(record.PoliceAgentRequestsTemp.createdAt).toLocaleDateString()
//                         : "N/A"
//                     }
//                     onApprove={handleRecordProcessed}
//                     onReject={handleRecordProcessed}
//                   />
//                 ))
//               ) : (
//                 /* POLICE VERSION - Crime Reports */
//                 records.map((record) => (
//                   <VerificationCard
//                     key={record.id}
//                     version="police"
//                     submissionId={record.id}
//                     title={record.CrimeId?.title || "No Title"}
//                     fullName={
//                       record.CrimeReportsSubmitter?.submitterName || "Unknown"
//                     }
//                     contact={
//                       record.CrimeReportsSubmitter?.submitterContact || "N/A"
//                     }
//                     cnic={record.CrimeReportsSubmitter?.submitterCnic || "N/A"}
//                     crimeType={record.CrimeType?.name || "Unknown"}
//                     date={new Date(record.incidentDate).toLocaleDateString()}
//                     address={record.address || ""}
//                     description={record.description || ""}
//                     zone={record.Zone?.zoneNumber || record.zoneId}
//                     onApprove={handleRecordProcessed}
//                     onReject={handleRecordProcessed}
//                   />
//                 ))
//               )}
//             </div>
//           )}
//         </div>
//       </div>
//     </section>
//   );
// }
