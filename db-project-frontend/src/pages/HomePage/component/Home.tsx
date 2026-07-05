import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  FileText,
  LockKeyhole,
  MapPinned,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import LogowithText from "../../../assets/LogowithText.svg";
import MainBackground from "../../../assets/MainBackground.png";
import MapBackground from "../../../assets/MapBackground.png";
import GreenButton from "../../../components/GreenButton";
import WhiteButton from "../../../components/WhiteButton";
import { useDispatch } from "react-redux";
import { setRole } from "../../../store/features/current_role";

const quickLinks = [
  {
    title: "Live Crime Map",
    description: "Explore approved crime records by area, type, date, and radius.",
    route: "/map",
    icon: MapPinned,
  },
  {
    title: "Crime Statistics",
    description: "Review trends, zone counts, and type-based distributions.",
    route: "/statistics",
    icon: BarChart3,
  },
  {
    title: "Report a Crime",
    description: "Submit a report from your citizen account and track its status.",
    route: "/report-crime",
    icon: FileText,
  },
  {
    title: "Request Agent Access",
    description: "Send a police agent account request for branch approval.",
    route: "/request-agent",
    icon: ShieldCheck,
  },
];

const workflow = [
  "Citizen submits a report with location, type, and incident details.",
  "Police reviews the report and confirms the zone and location.",
  "Approved records appear in public map views and analytics.",
];

const roleAccess = [
  {
    title: "Public",
    description: "View map layers and city-wide statistics without signing in.",
    icon: MapPinned,
  },
  {
    title: "Citizen",
    description: "Submit crime reports and monitor pending, approved, or rejected status.",
    icon: UserRound,
  },
  {
    title: "Police & Admin",
    description: "Verify reports, manage records, branches, agents, and secure imports.",
    icon: LockKeyhole,
  },
];

const Home = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const goPublicDashboard = () => {
    dispatch(setRole("user"));
    navigate("/dashboard");
  };

  const goTo = (path: string) => {
    setMobileMenuOpen(false);
    if (
      (path === "/dashboard" || path === "/statistics") &&
      !localStorage.getItem("authMode")
    ) {
      dispatch(setRole("user"));
    }
    navigate(path);
  };

  return (
    <section className="min-h-screen bg-[#f6f8f7] font-outfit text-[#101c16]">
      <header className="sticky top-0 z-50 border-b border-[#dfe7e2] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button type="button" onClick={() => goTo("/")} className="flex items-center">
            <img src={LogowithText} alt="CrimeLens" className="h-9 w-auto sm:h-10" />
          </button>

          <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 lg:flex">
            <button onClick={() => goTo("/map")} className="hover:text-[#237E54]">Map</button>
            <button onClick={() => goTo("/statistics")} className="hover:text-[#237E54]">Statistics</button>
            <button onClick={() => goTo("/request-agent")} className="hover:text-[#237E54]">Request Agent</button>
            <button onClick={() => goTo("/meet-developers")} className="hover:text-[#237E54]">Developers</button>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <WhiteButton label="Login" width={96} height={38} onClick={() => goTo("/login")} />
            <GreenButton label="Citizen Portal" width={142} height={38} onClick={() => goTo("/login-citizen")} />
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-[#237E54] hover:bg-green-50 lg:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-[#dfe7e2] bg-white px-4 py-4 lg:hidden">
            <div className="grid gap-2 text-sm font-medium text-gray-700">
              <button onClick={() => goTo("/map")} className="rounded-lg px-3 py-2 text-left hover:bg-green-50">Map</button>
              <button onClick={() => goTo("/statistics")} className="rounded-lg px-3 py-2 text-left hover:bg-green-50">Statistics</button>
              <button onClick={() => goTo("/request-agent")} className="rounded-lg px-3 py-2 text-left hover:bg-green-50">Request Agent</button>
              <button onClick={() => goTo("/login")} className="rounded-lg px-3 py-2 text-left hover:bg-green-50">Login</button>
              <button onClick={() => goTo("/login-citizen")} className="rounded-lg px-3 py-2 text-left hover:bg-green-50">Citizen Portal</button>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#c9ddd2] bg-white px-3 py-1 text-xs font-semibold text-[#237E54]">
              <ShieldCheck size={15} />
              Public safety data with verified records
            </div>

            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[#0f1f17] sm:text-5xl lg:text-6xl">
              CrimeLens
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
              Explore city crime patterns, submit reports as a citizen, and follow verified public safety updates through maps, records, and statistics.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <GreenButton label="View Live Map" height={44} fullWidth onClick={() => goTo("/map")} />
              <WhiteButton label="Report Crime" height={44} fullWidth onClick={() => goTo("/report-crime")} />
              <WhiteButton label="Staff Login" height={44} fullWidth onClick={() => goTo("/login")} />
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-[#dce6df] pt-6">
              <div>
                <p className="text-2xl font-semibold text-[#145332]">Map</p>
                <p className="mt-1 text-xs text-gray-500">Zone visibility</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-[#145332]">Stats</p>
                <p className="mt-1 text-xs text-gray-500">Trend insight</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-[#145332]">Roles</p>
                <p className="mt-1 text-xs text-gray-500">Controlled access</p>
              </div>
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-2xl bg-[#0f1f17] shadow-[0_20px_60px_rgba(15,31,23,0.22)]">
            <img src={MainBackground} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/20 to-black/70" />
            <div className="relative z-10 flex h-full min-h-[420px] flex-col justify-between p-5 sm:p-7">
              <div className="ml-auto rounded-lg border border-white/20 bg-white/90 p-4 text-[#101c16] shadow-lg backdrop-blur max-w-[280px]">
                <p className="text-xs font-semibold uppercase text-[#237E54]">Placeholder</p>
                <p className="mt-1 text-sm font-medium">Replace this hero area with a real dashboard or map screenshot.</p>
              </div>
              <div className="max-w-md text-white">
                <p className="text-sm font-medium text-white/80">Operational view</p>
                <h2 className="mt-2 text-2xl font-semibold">Maps, reports, and verification in one workflow.</h2>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => goTo(item.route)}
                  className="group rounded-lg border border-[#e0e7e2] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#237E54]/40 hover:shadow-md"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-[#237E54]">
                    <Icon size={21} />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-[#14231a]">{item.title}</h3>
                    <ChevronRight size={18} className="mt-0.5 text-gray-300 transition group-hover:text-[#237E54]" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-500">{item.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#237E54]">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#101c16]">From citizen report to public insight.</h2>
            <p className="mt-4 text-sm leading-6 text-gray-600">
              CrimeLens separates public visibility from verification work, so public views stay focused on approved crime records.
            </p>
          </div>
          <div className="grid gap-3">
            {workflow.map((step, index) => (
              <div key={step} className="flex gap-4 rounded-lg border border-[#e0e7e2] bg-white p-4 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#237E54] text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <p className="self-center text-sm leading-6 text-gray-700">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#237E54]">Access paths</p>
                <h2 className="mt-2 text-3xl font-semibold text-[#101c16]">Designed around each user role.</h2>
              </div>
              <WhiteButton label="Proceed as Public User" height={40} onClick={goPublicDashboard} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {roleAccess.map((role) => {
                const Icon = role.icon;
                return (
                  <div key={role.title} className="rounded-lg border border-[#e0e7e2] bg-[#fbfcfb] p-5">
                    <Icon className="text-[#237E54]" size={24} />
                    <h3 className="mt-4 text-lg font-semibold">{role.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{role.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-14">
          <div className="overflow-hidden rounded-2xl bg-[#102119] shadow-lg">
            <div className="relative min-h-[330px]">
              <img src={MapBackground} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" />
              <div className="absolute inset-0 bg-linear-to-t from-[#102119] via-[#102119]/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <p className="text-xs font-semibold uppercase text-white/70">Placeholder</p>
                <h3 className="mt-1 text-2xl font-semibold">Map or statistics screenshot</h3>
                <p className="mt-2 text-sm text-white/75">Replace with a real screenshot once final visuals are ready.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#237E54]">Why it helps</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#101c16]">Clear public views, controlled operational actions.</h2>
            <div className="mt-6 grid gap-3">
              {[
                "Public map and statistics show approved records.",
                "Citizens can track their own submitted reports.",
                "Police verification validates details before approval.",
                "Admin controls support branches, agents, and data upload.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#237E54]" size={19} />
                  <p className="text-sm leading-6 text-gray-700">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <GreenButton label="Open Statistics" height={42} fullWidth onClick={() => goTo("/statistics")} />
              <WhiteButton label="Meet Developers" height={42} fullWidth onClick={() => goTo("/meet-developers")} />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dfe7e2] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <img src={LogowithText} alt="CrimeLens" className="h-8 w-fit" />
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <button onClick={() => goTo("/map")} className="hover:text-[#237E54]">Map</button>
            <button onClick={() => goTo("/statistics")} className="hover:text-[#237E54]">Statistics</button>
            <button onClick={() => goTo("/report-crime")} className="hover:text-[#237E54]">Report Crime</button>
            <button onClick={() => goTo("/request-agent")} className="hover:text-[#237E54]">Request Agent</button>
          </div>
        </div>
      </footer>
    </section>
  );
};

export default Home;
