import SectionWrapper from "./shared/SectionWrapper";
import { Users, Shield, Search, ArrowRight } from "lucide-react";

type PersonaCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  linkText: string;
  href: string;
};

const PersonaCard = ({ icon, title, description, linkText, href }: PersonaCardProps) => {
  return (
    <div className="homepage-card p-10 h-full group">
      <div className="flex justify-center mb-6">
        <div className="icon-circle">
          {icon}
        </div>
      </div>
      <h3 className="text-2xl font-semibold text-gray-900 mb-4 text-center">{title}</h3>
      <p className="text-gray-600 leading-relaxed mb-6 text-center flex-1">{description}</p>
      <div className="text-center">
        <a
          href={href}
          className="inline-flex items-center text-[#237E54] font-medium group-hover:text-[#145332] transition-colors"
        >
          {linkText}
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    </div>
  );
};

const UserPersonasSection = () => {
  return (
    <SectionWrapper className="bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Built for everyone who cares about safety
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Whether you're a citizen, police department, or researcher, CrimeLens has tools for you
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <PersonaCard
            icon={<Users className="w-8 h-8 text-white" />}
            title="Citizens"
            description="Report incidents, track local crime patterns, and stay informed about safety in your neighborhood."
            linkText="Get started"
            href="/register"
          />
          <PersonaCard
            icon={<Shield className="w-8 h-8 text-white" />}
            title="Police Departments"
            description="Verify reports, manage crime records, and analyze patterns to allocate resources effectively."
            linkText="Learn more"
            href="/login-admin"
          />
          <PersonaCard
            icon={<Search className="w-8 h-8 text-white" />}
            title="Researchers"
            description="Access verified crime data, study trends, and generate insights for policy and planning."
            linkText="Explore data"
            href="/statistics"
          />
        </div>
      </div>
    </SectionWrapper>
  );
};

export default UserPersonasSection;
