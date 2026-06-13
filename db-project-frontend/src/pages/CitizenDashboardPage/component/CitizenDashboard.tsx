import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import StatsCard from "../../../components/StatsCards";
import GreenButton from "../../../components/GreenButton";
import WhiteButton from "../../../components/WhiteButton";
import RedButton from "../../../components/RedButton";
import ArrowButton from "../../../components/ArrowButton";
import StatsCardLiveIcon from "../../../components/StatsCardLiveIcon";

export default function CitizenDashboard() {
  const navigate = useNavigate();
  const { citizen, citizenToken, citizenLogout, isCitizenAuthenticated, refreshCitizenSession } = useAuth();

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: citizen?.fullName || "",
    contact: citizen?.contact || "",
    address: citizen?.address || "",
  });

  // Redirect if not authenticated
  useEffect(() => {
    // Check both state and localStorage for authentication
    const citizenFromStorage = localStorage.getItem("citizen");
    const isAuthenticated = isCitizenAuthenticated || !!citizenFromStorage;

    if (!isAuthenticated) {
      navigate("/login-citizen");
      return;
    }

    // Parse citizen data from state or storage (safely handle "undefined" string)
    let citizenData = citizen;
    if (!citizenData && citizenFromStorage && citizenFromStorage !== "undefined") {
      try {
        citizenData = JSON.parse(citizenFromStorage);
      } catch (e) {
        console.error("Failed to parse citizen data from storage:", e);
        citizenData = null;
      }
    }

    // Redirect to profile completion if not complete
    if (citizenData && !citizenData.isProfileComplete) {
      navigate("/complete-profile");
      return;
    }

    fetchMyReports();
  }, [citizen, isCitizenAuthenticated, navigate]);

  const fetchMyReports = async () => {
    setLoading(true);
    setError("");

    try {
      // Get token from state or localStorage
      let token = citizenToken || localStorage.getItem("citizen_token");

      if (!token) {
        throw new Error("Not authenticated. Please login again.");
      }

      // Try to fetch reports
      let response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/citizens/my-reports`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      // If token expired, try to refresh and retry
      if (response.status === 401) {
        console.log("Token expired, attempting refresh...");

        try {
          await refreshCitizenSession();

          // Get new token after refresh
          token = localStorage.getItem("citizen_token");

          if (!token) {
            throw new Error("Failed to get refreshed token");
          }

          response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/citizens/my-reports`, {
            headers: {
              "Authorization": `Bearer ${token}`,
            },
          });
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          // If refresh fails, logout user
          await citizenLogout();
          navigate("/login-citizen");
          return;
        }
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `Failed to fetch reports (${response.status})`);
      }

      // Handle new standardized response format (data is wrapped in 'data' property)
      const reportsData = data.data || data;
      setReports(reportsData.reports || []);
    } catch (err: any) {
      console.error("Fetch reports error:", err);
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await citizenLogout();
    navigate("/login-citizen");
  };

  const handleProfileUpdate = () => {
    // TODO: Implement backend API call
    console.log("Profile update:", profileData);
    setShowProfileForm(false);
  };

  const filteredReports = reports.filter((report) => {
    if (filter === "all") return true;
    return report.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "approved": return "bg-green-100 text-green-800";
      case "rejected": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const stats = {
    total: reports.length,
    pending: reports.filter((r) => r.status === "pending").length,
    approved: reports.filter((r) => r.status === "approved").length,
    rejected: reports.filter((r) => r.status === "rejected").length,
  };

  return (
    <section className="flex flex-row min-h-screen w-full">
      <div className="flex flex-col gap-y-4 p-4 w-full overflow-y-auto">
        {/* Header Section */}
        <div className="bg-[#fefefe] p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] flex flex-col gap-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 w-full">
            <div className="flex flex-col gap-y-1">
              <div className="font-outfit font-semibold text-2xl sm:text-4xl text-black">
                Citizen Dashboard
              </div>
              <div className="font-outfit text-sm sm:text-md text-[#A0A0A0]">
                Monitor your crime reports, track status, and manage your profile.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Welcome, {citizen?.fullName}</span>
              <RedButton label="Logout" width={100} height={40} onClick={handleLogout} />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Reports"
            value={stats.total}
            subText="All submitted reports"
            bgColor="bg-[#ffffff]"
            gradientBg="linear-gradient(to bottom, #145332, #1C6943, #237E54)"
            width="w-[100%]"
            height="h-[170px]"
            mainTextColor="text-[#ffffff]"
            smallTextColor="text-[#D9D9D9]"
            LiveButton={1}
          />

          <StatsCard
            title="Pending"
            value={stats.pending}
            subText="Awaiting verification"
            bgColor="bg-[#ffffff]"
            width="w-[100%]"
            height="h-[170px]"
            mainTextColor="text-black"
            smallTextColor="text-[#FFA500]"
            LiveButton={1}
          />

          <StatsCard
            title="Approved"
            value={stats.approved}
            subText="Verified reports"
            bgColor="bg-[#ffffff]"
            width="w-[100%]"
            height="h-[170px]"
            mainTextColor="text-black"
            smallTextColor="text-[#237E54]"
            LiveButton={1}
          />

          <StatsCard
            title="Rejected"
            value={stats.rejected}
            subText="Declined reports"
            bgColor="bg-[#ffffff]"
            width="w-[100%]"
            height="h-[170px]"
            mainTextColor="text-black"
            smallTextColor="text-[#FF4C4C]"
            LiveButton={1}
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/report-crime")}
              className="flex items-center justify-center p-4 bg-[#237E54] text-white rounded-lg hover:bg-[#1a6644] transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Report New Crime
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center justify-center p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              View Profile
            </button>
          </div>
        </div>

        {/* My Reports Section */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-800">My Reports</h2>
              <div className="flex gap-2">
                {(["all", "pending", "approved", "rejected"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${filter === status
                        ? "bg-[#237E54] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#237E54]"></div>
                <p className="mt-2 text-gray-600">Loading reports...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-600">{error}</p>
                <button
                  onClick={fetchMyReports}
                  className="mt-4 px-4 py-2 bg-[#237E54] text-white rounded-lg hover:bg-[#1a6644]"
                >
                  Retry
                </button>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">
                  {filter === "all" ? "No reports yet." : `No ${filter} reports.`}
                </p>
                <button
                  onClick={() => navigate("/report-crime")}
                  className="mt-4 px-4 py-2 bg-[#237E54] text-white rounded-lg hover:bg-[#1a6644]"
                >
                  Submit Your First Report
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-600 border-b">
                      <th className="pb-3 font-medium">Title</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Zone</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {filteredReports.map((report) => (
                      <tr key={report.id} className="border-b hover:bg-gray-50">
                        <td className="py-3">
                          <p className="font-medium text-gray-800">{report.title}</p>
                          {report.description && (
                            <p className="text-gray-500 text-xs mt-1 truncate max-w-xs">
                              {report.description}
                            </p>
                          )}
                        </td>
                        <td className="py-3 text-gray-600">{report.crimeType}</td>
                        <td className="py-3 text-gray-600">
                          {new Date(report.incidentDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-gray-600">{report.zone || "N/A"}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(report.status)}`}>
                            {report.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
