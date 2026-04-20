import { useEffect, useState } from "react";
import StatsCard from "../../../components/StatsCards";
import MapBackground from "../../../assets/MapBackground.png";
import GreenButton from "../../../components/GreenButton";
import ArrowButton from "../../../components/ArrowButton";
import { useNavigate } from "react-router-dom";
import MapEmbed from "../../../components/MapEmbed";
import { API_BASE_URL } from "../../../config/constants";

const Dashboard = () => {
  const navigate = useNavigate();

  const NavigateStatistics = () => navigate("/statistics");
  const NavigateMap = () => navigate("/map");

  const [totalZones, setTotalZones] = useState(0);
  const [dangerousCount, setDangerousCount] = useState(0);
  const [moderateCount, setModerateCount] = useState(0);
  const [safeCount, setSafeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeverity = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/zones/severity`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) return;

        setTotalZones(data.length);

        // Extract totalSeverity from all zones
        const severities = data.map((z) => z.totalSeverity);
        const maxSeverity = Math.max(...severities);
        const minSeverity = Math.min(...severities);

        // Thresholds: Dangerous > 66%, Moderate 33-66%, Safe < 33%
        const dangerousThreshold =
          minSeverity + (maxSeverity - minSeverity) * 0.66;
        const moderateThreshold =
          minSeverity + (maxSeverity - minSeverity) * 0.33;

        let dangerous = 0;
        let moderate = 0;
        let safe = 0;

        data.forEach((zone) => {
          if (zone.totalSeverity >= dangerousThreshold) dangerous++;
          else if (zone.totalSeverity >= moderateThreshold) moderate++;
          else safe++;
        });

        setDangerousCount(dangerous);
        setModerateCount(moderate);
        setSafeCount(safe);
      } catch (err) {
        console.error("Dashboard severity fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSeverity();
  }, []);

  return (
    <section className="flex flex-row min-h-screen w-full">
      <div className="flex flex-col gap-y-4 p-4 w-full overflow-y-auto">
        {/* STATS SECTION */}
        <div className="bg-[#fefefe] p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.15)] flex flex-col gap-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 w-full">
            <div className="flex flex-col gap-y-1">
              <div className="font-outfit font-semibold text-2xl sm:text-4xl text-black">
                Dashboard
              </div>
              <div className="font-outfit text-sm sm:text-md text-[#A0A0A0]">
                Monitor live updates on crime density, red zones, and incident
                patterns across the city.
              </div>
            </div>

            <div className="flex items-start">
              <GreenButton
                label="View all Statistics"
                width={260}
                height={50}
                onClick={NavigateStatistics}
              />
            </div>
          </div>

          {/* STATS CARDS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Zones"
              value={loading ? "..." : totalZones}
              subText="City region divided in blocks"
              bgColor="bg-[#ffffff]"
              gradientBg="linear-gradient(to bottom, #145332, #1C6943, #237E54)"
              width="w-[100%]"
              height="h-[170px]"
              mainTextColor="text-[#ffffff]"
              smallTextColor="text-[#D9D9D9]"
              LiveButton={1}
            />

            <StatsCard
              title="Red Zones"
              value={loading ? "..." : dangerousCount}
              subText="Zones Marked as 'High-Risk'"
              bgColor="bg-[#ffffff]"
              width="w-[100%]"
              height="h-[170px]"
              mainTextColor="text-black"
              smallTextColor="text-[#FF4C4C]"
              LiveButton={1}
            />

            <StatsCard
              title="Yellow Zones"
              value={loading ? "..." : moderateCount}
              subText="Zones Marked as 'Caution'"
              bgColor="bg-[#ffffff]"
              width="w-[100%]"
              height="h-[170px]"
              mainTextColor="text-black"
              smallTextColor="text-[#FFA500]"
              LiveButton={1}
            />

            <StatsCard
              title="Green Zones"
              value={loading ? "..." : safeCount}
              subText="Zones Marked as 'Safe'"
              bgColor="bg-[#ffffff]"
              width="w-[100%]"
              height="h-[170px]"
              mainTextColor="text-black"
              smallTextColor="text-[#237E54]"
              LiveButton={1}
            />
          </div>
        </div>

        {/* CRIME MAP SECTION */}
        <div
          className="p-4 rounded-2xl shadow-[0_0_5px_rgba(0,0,0,0.5)] min-h-80 sm:min-h-80 lg:h-[420px] relative flex flex-col"
          style={{
            backgroundImage: `url(${MapBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 w-full mb-4">
            <div className="flex flex-col gap-y-1">
              <div className="font-outfit font-semibold text-xl sm:text-3xl text-white">
                City Crime Map
              </div>
              <div className="font-outfit text-sm sm:text-md text-[#efecec]">
                Real-time visualization of crime activity across the city,
                updated directly from police databases.
              </div>
            </div>

            <div className="flex items-start shrink-0">
              <ArrowButton
                size={48}
                bgColor="bg-white"
                iconColor="text-[#237E54]"
                hoverBgColor="hover:bg-green-100"
                hoverIconColor="group-hover:text-green-600"
                onClick={NavigateMap}
              />
            </div>
          </div>

          <div className="w-full h-[200px] sm:h-[260px] lg:h-[calc(100%-85px)] rounded-xl overflow-hidden">
            <MapEmbed />  
          </div>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
