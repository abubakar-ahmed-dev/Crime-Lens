import SectionWrapper from "./shared/SectionWrapper";
import PrimaryButton from "./shared/PrimaryButton";
import LogowithText from "../../../assets/LogowithText.svg";
import DashboardPreview from "../../../assets/homepage/dashboard-preview.webp";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const HeroSection = () => {
  return (
    <SectionWrapper className="bg-white min-h-screen flex items-center pt-8">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

          {/* Left Side - Content */}
          <div className="flex-1 space-y-10">
            {/* Logo */}
            <img
              src={LogowithText}
              alt="CrimeLens Logo"
              className="w-40 md:w-48 h-auto"
            />

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-100">
              <CheckCircle2 className="w-4 h-4 text-[#237E54]" />
              <span className="text-sm font-medium text-[#145332]">Trusted by communities nationwide</span>
            </div>

            {/* Headline */}
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-gray-900">
                Understand Crime.
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#145332] to-[#237E54] mt-2">
                  Build Safer Communities.
                </span>
              </h1>

              <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-lg">
                CrimeLens transforms crime reports into interactive maps and actionable insights.
                Explore verified data, track patterns, and make informed decisions.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => window.location.href = "/map"}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-[#145332] to-[#237E54] text-white font-semibold rounded-lg hover:from-[#145332] hover:to-[#145332] transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Explore Map
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => window.location.href = "/statistics"}
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-[#145332] font-semibold rounded-lg border-2 border-[#237E54] hover:bg-gray-50 transition-all duration-200"
              >
                View Statistics
              </button>
            </div>

            {/* Trust Indicator */}
            <div className="flex items-center gap-6 pt-6">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 border-2 border-white flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-[#237E54]" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-green-200 border-2 border-white flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-[#237E54]" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-green-300 border-2 border-white flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-[#237E54]" />
                  </div>
                </div>
                <div className="text-sm">
                  <div className="font-semibold text-gray-900">25,000+ reports processed</div>
                  <div className="text-gray-500">Trusted by thousands of users</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Dashboard Preview */}
          <div className="flex-1 w-full">
            <div className="screenshot-frame p-2 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl">
              <img
                src={DashboardPreview}
                alt="Dashboard Preview"
                className="w-full h-auto rounded-xl"
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
