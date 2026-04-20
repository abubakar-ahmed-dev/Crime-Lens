import { useEffect, useState } from "react";
import StatsCard from "../../../components/StatsCards";
import MapBackground from "../../../assets/MapBackground.png";
import BackButton from "../../../components/BackButton";
import StatsCharts from "./StatsCharts";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {API_BASE_URL} from "../../../config/constants";

// ---------------------------
// Types
// ---------------------------
interface CrimeTypeSummary {
  id: number;
  name: string;
  crimeCount: number;
}

interface ZoneSummary {
  id: number;
  name: string;
  crimeCount: number;
}

interface StatsSummary {
  totalZones: number;
  totalCrimes: number;
  topCrimeType: CrimeTypeSummary;
  topZone: ZoneSummary;
}

const Statistics = () => {
  const navigate = useNavigate();

  const [summary, setSummary] = useState<StatsSummary | null>(null);

  // ---------------------------
  // Fetch Summary for Cards
  // ---------------------------
  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stats/summary`);
      setSummary(res.data);
    } catch (err) {
      console.error("Failed to fetch summary:", err);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const NavigateDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <section className="flex flex-row min-h-screen w-full">
      <div className="flex flex-col gap-y-4 p-4 w-full overflow-y-auto">
        {/* STATS CARDS */}
        <div className="bg-[#fefefe] p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] flex flex-col gap-y-2">
          <div className="flex items-start" onClick={NavigateDashboard}>
            <BackButton textSize="text-sm" iconSize={16} />
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start w-full">
            <div className="flex flex-col gap-y-2">
              <div className="font-outfit font-semibold text-2xl sm:text-4xl text-black flex items-start">
                Statistics
              </div>
              <div className="font-outfit text-sm sm:text-md text-[#A0A0A0] flex items-start">
                A detailed overview of crime trends, reports, and key metrics
                derived from live police data.
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-y-4 mt-4 sm:mt-[25px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Total Zones"
                value={summary?.totalZones ?? 0}
                subText="City regions divided into blocks"
                bgColor="bg-[#ffffff]"
                width="w-[100%]"
                height="h-[180px]"
                mainTextColor="text-black"
                smallTextColor="text-[#237E54]"
              />

              <StatsCard
                title="Total Crimes"
                value={summary?.totalCrimes ?? 0}
                subText="Crimes recorded in last 30 Days"
                bgColor="bg-[#ffffff]"
                width="w-[100%]"
                height="h-[180px]"
                mainTextColor="text-black"
                smallTextColor="text-[#237E54]"
              />

              <StatsCard
                title="Top Crime"
                value={summary?.topCrimeType?.name ?? "N/A"}
                subText={`Most frequent crime`}
                bgColor="bg-[#ffffff]"
                width="w-[100%]"
                height="h-[180px]"
                mainTextColor="text-black"
                smallTextColor="text-[#FFD700]"
                fontSize="text-[35px]"
              />

              <StatsCard
                title="Top Zone"
                value={summary?.topZone?.name ?? "N/A"}
                subText={`Most crime-prone zone`}
                bgColor="bg-[#ffffff]"
                width="w-[100%]"
                height="h-[180px]"
                mainTextColor="text-black"
                smallTextColor="text-[#FF6347]"
                fontSize="text-[30px]"              
              />
            </div>
          </div>
        </div>

        {/* GRAPHICAL STATISTICS */}
        <div
          className="bg-[#fefefe] p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)]"
          style={{
            backgroundImage: `url(${MapBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="flex flex-col gap-y-2 w-full">
            <div className="font-outfit font-semibold text-xl sm:text-3xl text-white flex items-start">
              Graphical Statistics
            </div>
            <div className="font-outfit font-normal text-sm sm:text-md text-[#efecec] flex items-start mb-2">
              Dynamic charts showcasing accurate, real-time crime data across
              the city.
            </div>
            <div className="p-3 sm:p-5 overflow-x-auto">
              <StatsCharts />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Statistics;
