import SectionWrapper from "./shared/SectionWrapper";
import { Map, BarChart3, MessageSquare, Search, ArrowRight } from "lucide-react";

type FeatureCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  linkText: string;
  href: string;
};

const FeatureCard = ({ icon, title, description, linkText, href }: FeatureCardProps) => {
  return (
    <div className="homepage-card p-8 group cursor-pointer">
      <div className="flex justify-center mb-6">
        <div className="icon-circle">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center">{title}</h3>
      <p className="text-gray-600 leading-relaxed mb-6 text-center">{description}</p>
      <a
        href={href}
        className="inline-flex items-center justify-center w-full text-[#237E54] font-semibold group-hover:text-[#145332] transition-colors"
      >
        {linkText}
        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </a>
    </div>
  );
};

const CoreFeaturesSection = () => {
  return (
    <SectionWrapper className="bg-white -mb-16">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Everything you need to understand crime data
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Powerful tools designed for citizens, police departments, and researchers
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<Map className="w-7 h-7 text-white" />}
            title="Interactive Maps"
            description="Explore crimes on an interactive map. Filter by location, category, date, zones, and more to find exactly what you need."
            linkText="Explore map"
            href="/map"
          />
          <FeatureCard
            icon={<BarChart3 className="w-7 h-7 text-white" />}
            title="Statistics Dashboard"
            description="Visualize trends, compare regions, and uncover patterns with powerful charts and dashboard."
            linkText="View statistics"
            href="/statistics"
          />
          <FeatureCard
            icon={<MessageSquare className="w-7 h-7 text-white" />}
            title="Community Reporting"
            description="Empower Citizens to report incidents easily and help build safer neighborhoods together."
            linkText="Report crime"
            href="/report-crime"
          />
          <FeatureCard
            icon={<Search className="w-7 h-7 text-white" />}
            title="Radial Search"
            description="Search and Filter crimes around a specific location, and get informed about the nearest and relevant incidents easily."
            linkText="Search records"
            href="/map?mode=radius&radius=500"
          />
        </div>
      </div>
    </SectionWrapper>
  );
};

export default CoreFeaturesSection;
