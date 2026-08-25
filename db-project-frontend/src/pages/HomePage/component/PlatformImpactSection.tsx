import SectionWrapper from "./shared/SectionWrapper";

const iconStroke = "currentColor";

const ReportsIcon = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill={iconStroke} aria-hidden="true" className={className}>
    <path d="M4 20h16v-2H4v2zm2-4h3V9H6v7zm5 0h3V5h-3v11zm5 0h3v-9h-3v9z" />
  </svg>
);

const AreasIcon = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill={iconStroke} aria-hidden="true" className={className}>
    <path d="M12 2C7.6 2 4 5.6 4 10c0 5.2 8 12 8 12s8-6.8 8-12c0-4.4-3.6-8-8-8zm0 11.5A3.5 3.5 0 1 1 12 6.5a3.5 3.5 0 0 1 0 7z" />
  </svg>
);

const UsersIcon = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill={iconStroke} aria-hidden="true" className={className}>
    <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm6 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6v1H3v-1zm11.2-4.8c2.7.5 4.8 2.4 4.8 4.8V21h2v-1c0-2.4-1.7-4.4-4.1-5.4-.7-.3-1.8-.5-2.7-.4z" />
  </svg>
);

const ShieldIcon = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill={iconStroke} aria-hidden="true" className={className}>
    <path d="M12 2 4 5.5v6.2c0 5.1 3.2 9.5 8 10.8 4.8-1.3 8-5.7 8-10.8V5.5L12 2zm0 3.2 5 2.2v4.4c0 4-2.4 7.3-5 8.6-2.6-1.3-5-4.6-5-8.6V7.4l5-2.2z" />
  </svg>
);

const PlatformImpactSection = () => {
  return (
    <SectionWrapper className="bg-gradient-to-br from-[#f8fcf9] via-white to-[#f4fbf6]">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-12 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            <div className="hidden lg:block absolute left-1/4 top-0 bottom-0 w-px bg-gray-200"></div>
            <div className="hidden lg:block absolute left-2/4 top-0 bottom-0 w-px bg-gray-200"></div>
            <div className="hidden lg:block absolute left-3/4 top-0 bottom-0 w-px bg-gray-200"></div>

            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#ecf9ef] flex items-center justify-center mx-auto mb-5 text-[#145332]">
                <ReportsIcon />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-[#145332] my-4">25,000+</div>
              <div className="text-gray-600 font-bold">Crime Reports</div>
            </div>

            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#ecf9ef] flex items-center justify-center mx-auto mb-5 text-[#145332]">
                <AreasIcon />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-[#145332] my-4">120+</div>
              <div className="text-gray-600 font-bold">Areas Covered</div>
            </div>

            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#ecf9ef] flex items-center justify-center mx-auto mb-5 text-[#145332]">
                <UsersIcon />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-[#145332] my-4">300+</div>
              <div className="text-gray-600 font-bold">Daily Active Users</div>
            </div>

            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#ecf9ef] flex items-center justify-center mx-auto mb-5 text-[#145332]">
                <ShieldIcon />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-[#145332] my-4">98%</div>
              <div className="text-gray-600 font-bold">Verified Reports</div>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

export default PlatformImpactSection;
