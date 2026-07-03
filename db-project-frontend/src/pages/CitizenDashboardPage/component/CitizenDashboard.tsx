import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import StatsCard from "../../../components/StatsCards";
import GreenButton from "../../../components/GreenButton";
import WhiteButton from "../../../components/WhiteButton";

export default function CitizenDashboard() {
  const navigate = useNavigate();
  const { citizen, citizenToken, citizenLogout, isCitizenAuthenticated, refreshCitizenSession } = useAuth();

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileUpdateLoading, setProfileUpdateLoading] = useState(false);
  const [profileUpdateError, setProfileUpdateError] = useState("");
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState("");
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

  // Update profileData when citizen data changes (e.g., after profile update)
  useEffect(() => {
    if (citizen) {
      setProfileData({
        fullName: citizen.fullName || "",
        contact: citizen.contact || "",
        address: citizen.address || "",
      });
    }
  }, [citizen]);

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

  const handleProfileUpdate = async () => {
    setProfileUpdateLoading(true);
    setProfileUpdateError("");
    setProfileUpdateSuccess("");

    try {
      // Get token from state or localStorage
      let token = citizenToken || localStorage.getItem("citizen_token");

      if (!token) {
        throw new Error("Not authenticated. Please login again.");
      }

      // Try to update profile
      let response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/citizens/update-profile`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: profileData.fullName,
          contact: profileData.contact,
          address: profileData.address,
        }),
      });

      // If token expired, try to refresh and retry
      if (response.status === 401) {

        try {
          await refreshCitizenSession();

          // Get new token after refresh
          token = localStorage.getItem("citizen_token");

          if (!token) {
            throw new Error("Failed to get refreshed token");
          }

          response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/citizens/update-profile`, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fullName: profileData.fullName,
              contact: profileData.contact,
              address: profileData.address,
            }),
          });
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          await citizenLogout();
          navigate("/login-citizen");
          return;
        }
      }

      const data = await response.json();


      if (!response.ok) {
        throw new Error(data.error || data.message || `Failed to update profile (${response.status})`);
      }

      // The update-profile endpoint returns the user data at root level (not nested in data)
      // due to how the success() function works
      const updatedUser = data.user;

      if (updatedUser) {

        // Update form data immediately
        setProfileData({
          fullName: updatedUser.fullName || "",
          contact: updatedUser.contact || "",
          address: updatedUser.address || "",
        });

        // Update localStorage with the same structure
        localStorage.setItem("citizen", JSON.stringify(updatedUser));

        // Dispatch custom event to notify AuthContext of the change
        window.dispatchEvent(new CustomEvent('citizen-updated', { detail: updatedUser }));

        // Show success message
        setProfileUpdateSuccess("Profile updated successfully!");
      } else {
        console.error("No user data in response, full response:", data);
        setProfileUpdateError("Failed to get updated user data from server");
      }
    } catch (err: any) {
      console.error("Profile update error:", err);
      setProfileUpdateError(err.message || "Failed to update profile");
    } finally {
      setProfileUpdateLoading(false);
    }
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

        {/* My Reports Section */}
        <div className="bg-[#fefefe] p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] mt-6">
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="font-outfit font-semibold text-xl text-black">My Reports</h3>
              <div className="flex gap-2 flex-wrap">
                {(["all", "pending", "approved", "rejected"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      filter === status
                        ? "bg-[#237E54] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div>
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
        {/* Action Buttons */}
        <div className="bg-[#fefefe] p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)]  mt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <GreenButton
              label="Report Crime"
              width={200}
              height={50}
              onClick={() => navigate("/report-crime")}
            />
            <WhiteButton
              label="Update Profile"
              width={200}
              height={50}
              onClick={() => setShowProfileForm(!showProfileForm)}
            />
          </div>
        </div>

        {/* Update Profile Form */}
        {showProfileForm && (
          <div className="bg-[#fefefe] p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)]">
            <div className="flex flex-col gap-y-4">
              <h3 className="font-outfit font-semibold text-xl text-black">Update Profile</h3>

              {/* Error Message */}
              {profileUpdateError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                  {profileUpdateError}
                </div>
              )}

              {/* Success Message */}
              {profileUpdateSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
                  {profileUpdateSuccess}
                </div>
              )}

              <div className="flex flex-col gap-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    type="text"
                    value={profileData.fullName}
                    onChange={(e) => {
                      setProfileData({...profileData, fullName: e.target.value});
                      setProfileUpdateSuccess("");
                      setProfileUpdateError("");
                    }}
                    disabled={profileUpdateLoading}
                    className="w-full mt-1 border-2 border-[#d9d9d9] rounded-lg px-4 py-2 font-outfit text-sm focus:outline-none focus:border-[#237E54] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Contact Number</label>
                  <input
                    type="text"
                    value={profileData.contact}
                    onChange={(e) => {
                      setProfileData({...profileData, contact: e.target.value});
                      setProfileUpdateSuccess("");
                      setProfileUpdateError("");
                    }}
                    disabled={profileUpdateLoading}
                    className="w-full mt-1 border-2 border-[#d9d9d9] rounded-lg px-4 py-2 font-outfit text-sm focus:outline-none focus:border-[#237E54] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Address</label>
                  <textarea
                    value={profileData.address}
                    onChange={(e) => {
                      setProfileData({...profileData, address: e.target.value});
                      setProfileUpdateSuccess("");
                      setProfileUpdateError("");
                    }}
                    disabled={profileUpdateLoading}
                    className="w-full mt-1 border-2 border-[#d9d9d9] rounded-lg px-4 py-2 font-outfit text-sm focus:outline-none focus:border-[#237E54] resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <GreenButton
                    label={profileUpdateLoading ? "Saving..." : "Save Changes"}
                    width={150}
                    height={45}
                    onClick={handleProfileUpdate}
                    disabled={profileUpdateLoading}
                  />
                  <WhiteButton
                    label="Cancel"
                    width={100}
                    height={45}
                    onClick={() => {
                      setShowProfileForm(false);
                      setProfileUpdateError("");
                      setProfileUpdateSuccess("");
                    }}
                    disabled={profileUpdateLoading}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
