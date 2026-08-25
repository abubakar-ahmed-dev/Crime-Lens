import SectionWrapper from "./shared/SectionWrapper";
import LogowithText from "../../../assets/LogowithText.svg";
import MainBackground from "../../../assets/MainBackground.png";
import { ArrowRight } from "lucide-react";

const SolidShieldIcon = ({ className = "w-4 h-4 text-[#145332]" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M12 2.5 4.5 5.5V11c0 5 3.1 9.2 7.5 11.5 4.4-2.3 7.5-6.5 7.5-11.5V5.5L12 2.5z" />
  </svg>
);

const HeroSection = () => {
  return (
    <SectionWrapper className="min-h-screen flex items-start relative overflow-hidden !pt-6 md:!pt-8 lg:!pt-10 !pb-16 md:!pb-20 lg:!pb-24">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-[#f7fcf8] to-white"></div>
      <div className="absolute -top-24 right-[-8rem] h-[24rem] w-[34rem] rotate-12 rounded-none bg-[#edf9ef] opacity-75"></div>
      <div className="absolute top-1/3 right-24 h-60 w-60 rotate-45 rounded-none bg-[#f2fbf5] opacity-70"></div>
      <div className="absolute bottom-[-9rem] left-[-6rem] h-[22rem] w-[34rem] -rotate-12 rounded-none bg-[#eefaf0] opacity-80"></div>

      <div className="max-w-7xl mx-auto w-full relative z-10">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-12 lg:gap-20">
          <div className="flex-1 space-y-7 pt-1 md:pt-2">
            <img
              src={LogowithText}
              alt="CrimeLens Logo"
              className="w-48 md:w-56 lg:w-60 h-auto"
            />

            <div className="inline-flex items-center gap-2 px-4 py-2 mt-8 rounded-full bg-green-50 border border-green-100">
              <SolidShieldIcon />
              <span className="text-sm font-semibold text-[#145332]">Data Driven, Community Focused. Safer Tomorrow.</span>
            </div>

            <div className="space-y-8 mt-3">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-gray-900 max-w-xl">
                Stay Informed
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#145332] to-[#237E54] mt-2">
                  Stay One Step Ahead
                </span>
              </h1>

              <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-lg mb-15">
                CrimeLens transforms crime reports into interactive maps and actionable insights.
                Explore verified data, track patterns, and make informed decisions.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => window.location.href = "/dashboard"}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-[#145332] to-[#237E54] text-white font-semibold rounded-lg hover:from-[#145332] hover:to-[#145332] transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Explore Crimes
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => window.location.href = "/login"}
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-[#145332] font-semibold rounded-lg border-2 border-[#237E54] hover:bg-gray-50 transition-all duration-200"
              >
                Login
              </button>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <div className="w-10 h-10 rounded-full bg-[#eaf8ee] flex items-center justify-center flex-shrink-0 ">
                <SolidShieldIcon className="w-5 h-5 text-[#145332]" />
              </div>
              <div className="text-sm font-semibold text-[#237E54]">
                Trusted by thousands of users across multiple regions
              </div>
            </div>
          </div>

          <div className="flex-1 w-full self-center flex items-center justify-center lg:min-h-[580px] mt-20">
            <div className="screenshot-frame w-full max-w-[570px] h-[17rem] lg:h-[37rem] -mr-8 px-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center overflow-hidden">
              <img
                src={MainBackground}
                alt="Dashboard Preview"
                className="h-full w-auto max-w-none rounded-xl object-contain block"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

export default HeroSection;
